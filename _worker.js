const API_BASE = "https://v3.football.api-sports.io";
const CURRENT_SEASON = 2026;

const LEAGUES = {
  premier: {
    id: 39,
    name: "Premier League",
  },
  laliga: {
    id: 140,
    name: "LaLiga",
  },
  seriea: {
    id: 135,
    name: "Serie A",
  },
  bundesliga: {
    id: 78,
    name: "Bundesliga",
  },
  ligue1: {
    id: 61,
    name: "Ligue 1",
  },
  scotland: {
    id: 179,
    name: "Scottish Premiership",
  },
  denmark: {
    id: 119,
    name: "Danish Superliga",
  },
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

    // IMPORTANT:
    // This is the exact name of the Cloudflare secret you created.
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

    if (
      url.pathname.startsWith("/api/") &&
      !league
    ) {
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

    // ------------------------------------------------------------
    // LIVE SCORES
    // ------------------------------------------------------------

    if (url.pathname === "/api/live-scores") {
      const apiUrl =
        `${API_BASE}/fixtures` +
        `?live=${league.id}`;

      return cachedApiRequest(
        apiUrl,
        apiKey,
        ctx,
        corsHeaders,
        300,
        league,
        "live"
      );
    }

    // ------------------------------------------------------------
    // RECENT RESULTS
    // ------------------------------------------------------------

    if (url.pathname === "/api/results") {
      const now = new Date();

      const past = new Date(now);
      past.setUTCDate(past.getUTCDate() - 30);

      const from = past.toISOString().slice(0, 10);
      const to = now.toISOString().slice(0, 10);

      const apiUrl =
        `${API_BASE}/fixtures` +
        `?league=${league.id}` +
        `&season=${CURRENT_SEASON}` +
        `&from=${from}` +
        `&to=${to}`;

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

    // ------------------------------------------------------------
    // UPCOMING FIXTURES
    // ------------------------------------------------------------

    if (url.pathname === "/api/upcoming") {
      const now = new Date();

      const future = new Date(now);
      future.setUTCDate(future.getUTCDate() + 14);

      const from = now.toISOString().slice(0, 10);
      const to = future.toISOString().slice(0, 10);

      const apiUrl =
        `${API_BASE}/fixtures` +
        `?league=${league.id}` +
        `&season=${CURRENT_SEASON}` +
        `&from=${from}` +
        `&to=${to}`;

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

    // ------------------------------------------------------------
    // LEAGUE STANDINGS
    // ------------------------------------------------------------

    if (url.pathname === "/api/standings") {
      const apiUrl =
        `${API_BASE}/standings` +
        `?league=${league.id}` +
        `&season=${CURRENT_SEASON}`;

      return cachedStandingsRequest(
        apiUrl,
        apiKey,
        ctx,
        corsHeaders,
        3600,
        league
      );
    }

    // ------------------------------------------------------------
    // WEBSITE FILES
    // ------------------------------------------------------------

    return env.ASSETS.fetch(request);
  },
};


// ============================================================
// API REQUEST + CACHE
// ============================================================

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
      return addCorsHeaders(cachedResponse, corsHeaders);
    }

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "x-apisports-key": apiKey,
        "Accept": "application/json",
      },
    });

    const apiData = await response.json();

    if (!response.ok || (apiData.errors && Object.keys(apiData.errors).length > 0)) {
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

    const normalized = fixtures.map(normalizeFixture);

    const output = {
      data: normalized,
      websiteLeague: {
        key: findLeagueKey(league.id),
        id: league.id,
        name: league.name,
      },
      api: {
        results: apiData.results || normalized.length,
      },
    };

    const result = new Response(
      JSON.stringify(output),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": `public, s-maxage=${cacheSeconds}`,
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


// ============================================================
// STANDINGS REQUEST + CACHE
// ============================================================

async function cachedStandingsRequest(
  apiUrl,
  apiKey,
  ctx,
  corsHeaders,
  cacheSeconds,
  league
) {
  try {
    const cacheKey = new Request(apiUrl, {
      method: "GET",
    });

    const cache = caches.default;

    let cachedResponse = await cache.match(cacheKey);

    if (cachedResponse) {
      return addCorsHeaders(cachedResponse, corsHeaders);
    }

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "x-apisports-key": apiKey,
        "Accept": "application/json",
      },
    });

    const apiData = await response.json();

    if (!response.ok || (apiData.errors && Object.keys(apiData.errors).length > 0)) {
      return json(
        {
          error: "API-Football standings request failed.",
          api: apiData,
        },
        response.ok ? 502 : response.status,
        corsHeaders
      );
    }

    const rows =
      apiData?.response?.[0]?.league?.standings?.[0] || [];

    const normalized = rows.map((row) => ({
      participant: {
        id: row.team?.id,
        name: row.team?.name || "Unknown",
        image_path: row.team?.logo || null,
      },

      details: [
        {
          type: { code: "overall-matches-played" },
          value: row.all?.played ?? 0,
        },
        {
          type: { code: "overall-won" },
          value: row.all?.win ?? 0,
        },
        {
          type: { code: "overall-draw" },
          value: row.all?.draw ?? 0,
        },
        {
          type: { code: "overall-lost" },
          value: row.all?.lose ?? 0,
        },
        {
          type: { code: "goals-for" },
          value: row.all?.goals?.for ?? 0,
        },
        {
          type: { code: "goals-against" },
          value: row.all?.goals?.against ?? 0,
        },
        {
          type: { code: "goal-difference" },
          value: row.goalsDiff ?? 0,
        },
        {
          type: { code: "points" },
          value: row.points ?? 0,
        },
      ],

      form: (row.form || "")
        .split("")
        .map((letter, index) => ({
          form: letter,
          sort_order: index,
        })),
    }));

    const output = {
      data: normalized,
      websiteLeague: {
        key: findLeagueKey(league.id),
        id: league.id,
        name: league.name,
      },
    };

    const result = new Response(
      JSON.stringify(output),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": `public, s-maxage=${cacheSeconds}`,
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
        error: "Unable to contact API-Football standings.",
        details: error.message,
      },
      500,
      corsHeaders
    );
  }
}


// ============================================================
// CONVERT API-FOOTBALL FIXTURE TO OUR WEBSITE FORMAT
// ============================================================

function normalizeFixture(item) {
  const fixture = item.fixture || {};
  const teams = item.teams || {};
  const goals = item.goals || {};

  const home = teams.home || {};
  const away = teams.away || {};

  let startingAt = null;

  if (fixture.date) {
    startingAt = new Date(fixture.date)
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
      short_name: fixture.status?.short || "",
      name: fixture.status?.long || "",
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
      name: item.league?.name || "",
    },

    round: {
      name: item.league?.round || "",
    },
  };
}


// ============================================================
// HELPERS
// ============================================================

function findLeagueKey(id) {
  for (const [key, league] of Object.entries(LEAGUES)) {
    if (league.id === id) {
      return key;
    }
  }

  return null;
}


function addCorsHeaders(response, corsHeaders) {
  const headers = new Headers(response.headers);

  for (const [key, value] of Object.entries(corsHeaders)) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}


function json(data, status, corsHeaders) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    }
  );
}
