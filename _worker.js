const API_BASE = "https://v3.football.api-sports.io";

const LEAGUES = {
  premier: { id: 39, name: "Premier League" },
  laliga: { id: 140, name: "LaLiga" },
  seriea: { id: 135, name: "Serie A" },
  bundesliga: { id: 78, name: "Bundesliga" },
  ligue1: { id: 61, name: "Ligue 1" },
  scotland: { id: 179, name: "Scottish Premiership" },
  denmark: { id: 119, name: "Danish Superliga" },
};

export default {
  async fetch(request, env, ctx) {
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

    const apiKey = env.FootballScoresWebsite;

    if (!apiKey) {
      return json(
        {
          error: "FootballScoresWebsite secret is not configured.",
        },
        500,
        corsHeaders
      );
    }

    const leagueKey = url.searchParams.get("league") || "scotland";
    const league = LEAGUES[leagueKey];

    if (url.pathname.startsWith("/api/") && !league) {
      return json(
        {
          error: "Unknown league.",
          league: leagueKey,
          availableLeagues: Object.keys(LEAGUES),
        },
        400,
        corsHeaders
      );
    }

    /*
     * LIVE SCORES
     *
     * Request all of the website's leagues at once,
     * then filter down to the selected league.
     */
    if (url.pathname === "/api/live-scores") {
      const liveLeagueIds = Object.values(LEAGUES)
        .map((item) => item.id)
        .join("-");

      const apiUrl =
        `${API_BASE}/fixtures?live=${liveLeagueIds}`;

      return cachedLiveApiRequest(
        apiUrl,
        apiKey,
        ctx,
        corsHeaders,
        league
      );
    }

    /*
     * RECENT RESULTS
     *
     * Uses the current date range without specifying
     * a season, so we don't force the API to use a
     * season that the free plan may not provide.
     */
    if (url.pathname === "/api/results") {
      const now = new Date();

      const past = new Date(now);
      past.setUTCDate(past.getUTCDate() - 30);

      const from = past.toISOString().slice(0, 10);
      const to = now.toISOString().slice(0, 10);

      const apiUrl =
        `${API_BASE}/fixtures` +
        `?league=${league.id}` +
        `&from=${from}` +
        `&to=${to}` +
        `&timezone=Australia/Sydney`;

      return cachedApiRequest(
        apiUrl,
        apiKey,
        ctx,
        corsHeaders,
        21600,
        league,
        "results"
      );
    }

    /*
     * UPCOMING FIXTURES
     *
     * Uses the current date range without specifying
     * a season.
     */
    if (url.pathname === "/api/upcoming") {
      const now = new Date();

      const future = new Date(now);
      future.setUTCDate(future.getUTCDate() + 14);

      const from = now.toISOString().slice(0, 10);
      const to = future.toISOString().slice(0, 10);

      const apiUrl =
        `${API_BASE}/fixtures` +
        `?league=${league.id}` +
        `&from=${from}` +
        `&to=${to}` +
        `&timezone=Australia/Sydney`;

      return cachedApiRequest(
        apiUrl,
        apiKey,
        ctx,
        corsHeaders,
        21600,
        league,
        "upcoming"
      );
    }

    /*
     * STANDINGS
     *
     * We cannot safely force season=2026 on the free plan
     * because your account previously returned a season
     * access error.
     *
     * This endpoint is left available so we can test the
     * current standings separately.
     */
    if (url.pathname === "/api/standings") {
      return json(
        {
          error:
            "Current standings require a season that is available to the API-Football subscription.",
          league: league.name,
        },
        403,
        corsHeaders
      );
    }

    return env.ASSETS.fetch(request);
  },
};


/*
 * LIVE API REQUEST
 */
async function cachedLiveApiRequest(
  apiUrl,
  apiKey,
  ctx,
  corsHeaders,
  league
) {
  try {
    const cacheKey = new Request(apiUrl, {
      method: "GET",
    });

    const cache = caches.default;

    let cachedResponse = await cache.match(cacheKey);

    if (cachedResponse) {
      const cachedData = await cachedResponse.clone().json();

      return json(
        filterLiveResponse(cachedData, league),
        200,
        corsHeaders
      );
    }

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "x-apisports-key": apiKey,
        "Accept": "application/json",
      },
    });

    const apiData = await response.json();

    if (
      !response.ok ||
      (apiData.errors &&
        Object.keys(apiData.errors).length > 0)
    ) {
      return json(
        {
          error: "API-Football request failed.",
          api: apiData,
        },
        response.ok ? 502 : response.status,
        corsHeaders
      );
    }

    const filteredData = filterLiveResponse(
      apiData,
      league
    );

    const result = new Response(
      JSON.stringify(filteredData),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, s-maxage=300",
          ...corsHeaders,
        },
      }
    );

    ctx.waitUntil(
      cache.put(cacheKey, result.clone())
    );

    return result;
  } catch (error) {
    return json(
      {
        error: "Unable to contact API-Football.",
        details: error.message,
        type: "live",
      },
      500,
      corsHeaders
    );
  }
}


/*
 * FILTER LIVE MATCHES
 */
function filterLiveResponse(apiData, league) {
  const fixtures = Array.isArray(apiData.response)
    ? apiData.response.filter(
        (item) => item.league?.id === league.id
      )
    : [];

  const normalized = fixtures.map(
    normalizeFixture
  );

  return {
    data: normalized,

    websiteLeague: {
      key: findLeagueKey(league.id),
      id: league.id,
      name: league.name,
    },

    api: {
      results: normalized.length,
    },
  };
}


/*
 * NORMAL API REQUEST
 */
async function cachedApiRequest(
  apiUrl,
  apiKey,
  ctx,
  corsHeaders,
  cacheSeconds,
  league,
  type
) {
  try {
    const cacheKey = new Request(apiUrl, {
      method: "GET",
    });

    const cache = caches.default;

    let cachedResponse = await cache.match(cacheKey);

    if (cachedResponse) {
      return addCorsHeaders(
        cachedResponse,
        corsHeaders
      );
    }

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "x-apisports-key": apiKey,
        "Accept": "application/json",
      },
    });

    const apiData = await response.json();

    if (
      !response.ok ||
      (apiData.errors &&
        Object.keys(apiData.errors).length > 0)
    ) {
      return json(
        {
          error: "API-Football request failed.",
          api: apiData,
        },
        response.ok ? 502 : response.status,
        corsHeaders
      );
    }

    const fixtures = Array.isArray(apiData.response)
      ? apiData.response
      : [];

    const normalized = fixtures.map(
      normalizeFixture
    );

    const output = {
      data: normalized,

      websiteLeague: {
        key: findLeagueKey(league.id),
        id: league.id,
        name: league.name,
      },

      api: {
        results:
          apiData.results ||
          normalized.length,
      },
    };

    const result = new Response(
      JSON.stringify(output),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control":
            `public, s-maxage=${cacheSeconds}`,
          ...corsHeaders,
        },
      }
    );

    ctx.waitUntil(
      cache.put(cacheKey, result.clone())
    );

    return result;
  } catch (error) {
    return json(
      {
        error: "Unable to contact API-Football.",
        details: error.message,
        type,
      },
      500,
      corsHeaders
    );
  }
}


/*
 * NORMALIZE FIXTURE
 */
function normalizeFixture(item) {
  const fixture = item.fixture || {};
  const teams = item.teams || {};
  const goals = item.goals || {};

  const home = teams.home || {};
  const away = teams.away || {};

  let startingAt = null;

  if (fixture.date) {
    startingAt = new Date(
      fixture.date
    )
      .toISOString()
      .replace(".000Z", "");
  }

  return {
    id: fixture.id,

    participants: [
      {
        id: home.id,
        name: home.name || "Home",
        image_path: home.logo || null,
        meta: {
          location: "home",
        },
      },

      {
        id: away.id,
        name: away.name || "Away",
        image_path: away.logo || null,
        meta: {
          location: "away",
        },
      },
    ],

    starting_at: startingAt,

    state: {
      short_name:
        fixture.status?.short || "",

      name:
        fixture.status?.long || "",
    },

    scores: [
      {
        participant_id: home.id,

        description: "CURRENT",

        score: {
          goals: goals.home,
        },
      },

      {
        participant_id: away.id,

        description: "CURRENT",

        score: {
          goals: goals.away,
        },
      },
    ],

    league: {
      id: item.league?.id,

      name:
        item.league?.name || "",
    },

    round: {
      name:
        item.league?.round || "",
    },
  };
}


/*
 * FIND LEAGUE KEY
 */
function findLeagueKey(id) {
  for (
    const [key, league] of Object.entries(
      LEAGUES
    )
  ) {
    if (league.id === id) {
      return key;
    }
  }

  return null;
}


/*
 * ADD CORS HEADERS
 */
function addCorsHeaders(
  response,
  corsHeaders
) {
  const headers = new Headers(
    response.headers
  );

  for (
    const [key, value] of Object.entries(
      corsHeaders
    )
  ) {
    headers.set(key, value);
  }

  return new Response(
    response.body,
    {
      status: response.status,
      statusText: response.statusText,
      headers,
    }
  );
}


/*
 * JSON RESPONSE
 */
function json(
  data,
  status,
  corsHeaders
) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type":
          "application/json",
        ...corsHeaders,
      },
    }
  );
}
