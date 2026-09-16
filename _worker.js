const API_BASE = "https://v3.football.api-sports.io";

const LEAGUES = {
  premier: {
    id: 39,
    name: "Premier League"
  },
  laliga: {
    id: 140,
    name: "La Liga"
  },
  seriea: {
    id: 135,
    name: "Serie A"
  },
  bundesliga: {
    id: 78,
    name: "Bundesliga"
  },
  ligue1: {
    id: 61,
    name: "Ligue 1"
  },
  scottish: {
    id: 179,
    name: "Scottish Premiership"
  },
  danish: {
    id: 119,
    name: "Danish Superliga"
  }
};

const LIVE_LEAGUE_IDS = Object.values(LEAGUES)
  .map(league => league.id)
  .join("-");

const LIVE_CACHE = new Map();

async function apiFootball(path, env) {
  const token = env.FootballScoresWebsite;

  if (!token) {
    throw new Error("FootballScoresWebsite secret is not configured.");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "x-apisports-key": token
    }
  });

  const data = await response.json();

  if (!response.ok || data.errors && Object.keys(data.errors).length > 0) {
    return {
      ok: false,
      data
    };
  }

  return {
    ok: true,
    data
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store"
    }
  });
}

function getLeague(request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("league") || "premier";

  return LEAGUES[key] || null;
}

/* ---------------------------------------------------------
   LIVE SCORES
--------------------------------------------------------- */

async function liveScores(request, env) {
  const league = getLeague(request);

  if (!league) {
    return json({
      error: "Unknown league."
    }, 400);
  }

  const cacheKey = `live-${league.id}`;

  const cached = LIVE_CACHE.get(cacheKey);

  if (cached && Date.now() - cached.time < 10000) {
    return json(cached.data);
  }

  const result = await apiFootball(
    `/fixtures?live=${LIVE_LEAGUE_IDS}`,
    env
  );

  if (!result.ok) {
    return json({
      error: "API-Football request failed.",
      api: result.data
    }, 502);
  }

  const matches = (result.data.response || [])
    .filter(match => Number(match.league?.id) === league.id);

  const output = {
    data: matches,
    websiteLeague: league,
    api: {
      results: matches.length
    }
  };

  LIVE_CACHE.set(cacheKey, {
    time: Date.now(),
    data: output
  });

  return json(output);
}

/* ---------------------------------------------------------
   UPCOMING FIXTURES
--------------------------------------------------------- */

async function upcoming(request, env) {
  const league = getLeague(request);

  if (!league) {
    return json({
      error: "Unknown league."
    }, 400);
  }

  /*
    IMPORTANT:

    We deliberately do NOT send:
      season=2026
      from=...
      to=...

    Your free API-Football plan rejects the 2026 season.

    Instead we use the API's next-fixtures functionality.
  */

  const result = await apiFootball(
    `/fixtures?league=${league.id}&next=10`,
    env
  );

  if (!result.ok) {
    return json({
      error: "API-Football request failed.",
      api: result.data
    }, 502);
  }

  return json({
    data: result.data.response || [],
    websiteLeague: league,
    api: {
      results: result.data.results || 0
    }
  });
}

/* ---------------------------------------------------------
   RECENT RESULTS
--------------------------------------------------------- */

async function recentResults(request, env) {
  const league = getLeague(request);

  if (!league) {
    return json({
      error: "Unknown league."
    }, 400);
  }

  /*
    Same idea as upcoming fixtures.

    We use last=10 instead of asking for the 2026 season,
    because your free API-Football plan does not provide
    the current 2026 season through the normal season query.
  */

  const result = await apiFootball(
    `/fixtures?league=${league.id}&last=10`,
    env
  );

  if (!result.ok) {
    return json({
      error: "API-Football request failed.",
      api: result.data
    }, 502);
  }

  return json({
    data: result.data.response || [],
    websiteLeague: league,
    api: {
      results: result.data.results || 0
    }
  });
}

/* ---------------------------------------------------------
   STANDINGS
--------------------------------------------------------- */

async function standings(request, env) {
  const league = getLeague(request);

  if (!league) {
    return json({
      error: "Unknown league."
    }, 400);
  }

  /*
    Standings require a season.

    Your current free API-Football subscription does not
    provide the 2026 season, so we are leaving this endpoint
    disabled rather than showing an incorrect old table.
  */

  return json({
    error: "Current standings require access to the 2026 season.",
    websiteLeague: league
  }, 403);
}

/* ---------------------------------------------------------
   MAIN WORKER
--------------------------------------------------------- */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {

      if (url.pathname === "/api/live-scores") {
        return await liveScores(request, env);
      }

      if (url.pathname === "/api/upcoming") {
        return await upcoming(request, env);
      }

      if (url.pathname === "/api/results") {
        return await recentResults(request, env);
      }

      if (url.pathname === "/api/standings") {
        return await standings(request, env);
      }

      /*
        Let Cloudflare serve the normal website files.
      */

      if (env.ASSETS) {
        return env.ASSETS.fetch(request);
      }

      return new Response("Not found", {
        status: 404
      });

    } catch (error) {

      return json({
        error: error.message || "Worker error."
      }, 500);

    }
  }
};
