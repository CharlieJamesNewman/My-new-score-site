export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    if (!env.footballScoresToken) {
      return json(
        { error: "footballScoresToken is not configured." },
        500,
        corsHeaders
      );
    }

    // Leagues currently available on the Sportmonks Free Football plan.
    const leagueIds = {
      scotland: {
        id: 501,
        name: "Scottish Premiership",
      },
      denmark: {
        id: 271,
        name: "Danish Superliga",
      },

      // These are kept so the website can recognise the buttons,
      // but they require a Sportmonks plan that includes those leagues.
      premier: {
        id: 8,
        name: "Premier League",
      },
      laliga: {
        id: 564,
        name: "LaLiga",
      },
      seriea: {
        id: 384,
        name: "Serie A",
      },
      bundesliga: {
        id: 82,
        name: "Bundesliga",
      },
      ligue1: {
        id: 301,
        name: "Ligue 1",
      },
    };

    const leagueKey = url.searchParams.get("league") || "scotland";
    const league = leagueIds[leagueKey];

    if (
      url.pathname !== "/" &&
      url.pathname.startsWith("/api/") &&
      !league
    ) {
      return json(
        {
          error: "Unknown league.",
          league: leagueKey,
        },
        400,
        corsHeaders
      );
    }

    /*
     * LIVE SCORES
     *
     * Returns only live matches for the selected league.
     */
    if (url.pathname === "/api/live-scores") {
      const sportmonksUrl =
        "https://api.sportmonks.com/v3/football/livescores/inplay" +
        "?include=participants;scores;periods;events;league.country;round" +
        `&filters=fixtureLeagues:${league.id}`;

      return sportmonks(
        sportmonksUrl,
        env,
        corsHeaders,
        league
      );
    }

    /*
     * RECENT RESULTS
     *
     * Gets the last 30 days of fixtures for the selected league.
     */
    if (url.pathname === "/api/results") {
      const now = new Date();

      const end = now.toISOString().slice(0, 10);

      const past = new Date(now);
      past.setDate(past.getDate() - 30);

      const start = past.toISOString().slice(0, 10);

      const sportmonksUrl =
        "https://api.sportmonks.com/v3/football/fixtures/between/" +
        `${start}/${end}` +
        "?include=participants;scores;state;league;round" +
        `&filters=fixtureLeagues:${league.id}`;

      return sportmonks(
        sportmonksUrl,
        env,
        corsHeaders,
        league
      );
    }

    /*
     * UPCOMING FIXTURES
     *
     * Gets the next 14 days of fixtures for the selected league.
     */
    if (url.pathname === "/api/upcoming") {
      const now = new Date();

      const start = now.toISOString().slice(0, 10);

      const future = new Date(now);
      future.setDate(future.getDate() + 14);

      const end = future.toISOString().slice(0, 10);

      const sportmonksUrl =
        "https://api.sportmonks.com/v3/football/fixtures/between/" +
        `${start}/${end}` +
        "?include=participants;scores;state;league;round" +
        `&filters=fixtureLeagues:${league.id}`;

      return sportmonks(
        sportmonksUrl,
        env,
        corsHeaders,
        league
      );
    }

    /*
     * LEAGUE TABLE
     *
     * First finds the current season for the selected league.
     * Then retrieves the standings for that season.
     */
    if (url.pathname === "/api/standings") {
      const leagueUrl =
        `https://api.sportmonks.com/v3/football/leagues/${league.id}` +
        "?include=currentSeason";

      const leagueResponse = await fetch(leagueUrl, {
        method: "GET",
        headers: {
          "Authorization": env.footballScoresToken,
          "Accept": "application/json",
        },
      });

      const leagueData = await leagueResponse.json();

      if (!leagueResponse.ok) {
        return new Response(JSON.stringify(leagueData), {
          status: leagueResponse.status,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        });
      }

      const currentSeason =
        leagueData?.data?.currentSeason ||
        leagueData?.data?.currentseason;

      if (!currentSeason?.id) {
        return json(
          {
            error: "Could not determine the current season.",
            league: league.name,
            sportmonks: leagueData,
          },
          500,
          corsHeaders
        );
      }

      const standingsUrl =
        `https://api.sportmonks.com/v3/football/standings/seasons/${currentSeason.id}` +
        "?include=participant;details.type;form";

      return sportmonks(
        standingsUrl,
        env,
        corsHeaders,
        league
      );
    }

    /*
     * If the request isn't an API request, let Cloudflare serve
     * the website files normally.
     */
    return env.ASSETS.fetch(request);
  },
};


/*
 * Make a request to Sportmonks and return the response.
 */
async function sportmonks(
  url,
  env,
  corsHeaders,
  league
) {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": env.footballScoresToken,
        "Accept": "application/json",
      },
    });

    const data = await response.json();

    /*
     * Add a little information that makes the response easier
     * for our website to understand.
     */
    if (data && typeof data === "object") {
      data.websiteLeague = {
        key: findLeagueKey(league.id),
        id: league.id,
        name: league.name,
      };
    }

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        ...corsHeaders,
      },
    });
  } catch (error) {
    return json(
      {
        error: "Unable to contact Sportmonks.",
        details: error.message,
      },
      500,
      corsHeaders
    );
  }
}


/*
 * Convert a Sportmonks league ID back to our website league key.
 */
function findLeagueKey(id) {
  const leagues = {
    501: "scotland",
    271: "denmark",
    8: "premier",
    564: "laliga",
    384: "seriea",
    82: "bundesliga",
    301: "ligue1",
  };

  return leagues[id] || null;
}


/*
 * Simple JSON response helper.
 */
function json(data, status, corsHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}
