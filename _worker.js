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
      return json({
        error: "footballScoresToken is not configured."
      }, 500, corsHeaders);
    }

    /*
      Your current Sportmonks plan gives access to:
      Scottish Premiership = league 501
    */

    const leagueIds = {
      scotland: 501,
      premier: 8,
      laliga: 564,
      seriea: 384,
      bundesliga: 82,
      ligue1: 301
    };

    /*
      LIVE SCORES
    */
    if (url.pathname === "/api/live-scores") {
      return sportmonks(
        "https://api.sportmonks.com/v3/football/livescores/inplay" +
        "?include=participants;scores;periods;events;league.country;round",
        env,
        corsHeaders
      );
    }

    /*
      UPCOMING FIXTURES
      Example:
      /api/upcoming?league=scotland
    */
    if (url.pathname === "/api/upcoming") {
      const league = url.searchParams.get("league") || "scotland";
      const leagueId = leagueIds[league];

      if (!leagueId) {
        return json({
          error: "Unknown league."
        }, 400, corsHeaders);
      }

      const now = new Date();

      const start = now.toISOString().slice(0, 10);

      const future = new Date(now);
      future.setDate(future.getDate() + 14);

      const end = future.toISOString().slice(0, 10);

      const sportmonksUrl =
        "https://api.sportmonks.com/v3/football/fixtures/between/" +
        `${start}/${end}` +
        `?include=participants;scores;state;league;round` +
        `&filters=fixtureLeagues:${leagueId}`;

      return sportmonks(
        sportmonksUrl,
        env,
        corsHeaders
      );
    }

    /*
      LIVE LEAGUE TABLE
      Example:
      /api/standings?league=scotland
    */
    if (url.pathname === "/api/standings") {
      const league = url.searchParams.get("league") || "scotland";
      const leagueId = leagueIds[league];

      if (!leagueId) {
        return json({
          error: "Unknown league."
        }, 400, corsHeaders);
      }

      const sportmonksUrl =
        `https://api.sportmonks.com/v3/football/standings/live/league/${leagueId}` +
        "?include=participant;details.type;form";

      return sportmonks(
        sportmonksUrl,
        env,
        corsHeaders
      );
    }

    /*
      Everything else = website
    */
    return env.ASSETS.fetch(request);
  }
};


/*
  SPORTMONKS REQUEST HELPER
*/
async function sportmonks(url, env, corsHeaders) {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": env.footballScoresToken,
        "Accept": "application/json",
      },
    });

    const data = await response.json();

    return new Response(
      JSON.stringify(data),
      {
        status: response.status,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          ...corsHeaders,
        },
      }
    );

  } catch (error) {
    return json({
      error: "Unable to contact Sportmonks.",
      details: error.message
    }, 500, corsHeaders);
  }
}


/*
  JSON RESPONSE HELPER
*/
function json(data, status, corsHeaders) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      }
    }
  );
}
