const FOOTBALL_DATA_API = "https://api.football-data.org/v4";

const LEAGUES = {
  premier: "PL",
  laLiga: "PD",
  serieA: "SA",
  bundesliga: "BL1",
  ligue1: "FL1"
};

const CACHE_TTL = {
  live: 30,
  results: 300,
  upcoming: 300,
  standings: 300,
  competition: 3600,
  match: 120,
  leagueData: 300
};

// Prevent multiple identical upstream requests from happening at the same time.
const inFlight = new Map();

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      ...extraHeaders
    }
  });
}

function getLeagueCode(league) {
  return LEAGUES[String(league || "").toLowerCase()] || null;
}

function getTodayString() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function footballDataRequest(env, path, cacheTtl = 300) {
  if (!env.FootballDataToken) {
    throw new Error("FootballDataToken secret is missing.");
  }

  const cache = caches.default;

  const cacheUrl = `https://cache.score-dash.local${path}`;
  const cacheRequest = new Request(cacheUrl, {
    method: "GET"
  });

  const cached = await cache.match(cacheRequest);

  if (cached) {
    return cached;
  }

  const url = `${FOOTBALL_DATA_API}${path}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "X-Auth-Token": env.FootballDataToken,
      "Accept": "application/json"
    }
  });

  if (!response.ok) {
    const text = await response.text();

    return new Response(
      JSON.stringify({
        error: "Football-data.org request failed",
        status: response.status,
        details: text
      }),
      {
        status: response.status,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store"
        }
      }
    );
  }

  const body = await response.arrayBuffer();

  const headers = new Headers(response.headers);

  headers.set(
    "Cache-Control",
    `public, max-age=${cacheTtl}, stale-while-revalidate=60`
  );

  headers.set(
    "Content-Type",
    "application/json; charset=utf-8"
  );

  const cachedResponse = new Response(body, {
    status: response.status,
    headers
  });

  await cache.put(cacheRequest, cachedResponse.clone());

  return cachedResponse;
}

async function footballDataJson(env, path, cacheTtl = 300) {
  const response = await footballDataRequest(env, path, cacheTtl);

  const text = await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Football-data.org returned invalid JSON.");
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
      data?.error ||
      `Football-data.org returned HTTP ${response.status}.`
    );
  }

  return data;
}

function simplifyTeam(team) {
  if (!team) {
    return null;
  }

  return {
    id: team.id ?? null,
    name: team.name ?? "",
    shortName: team.shortName ?? team.name ?? "",
    tla: team.tla ?? "",
    crest: team.crest ?? ""
  };
}

function simplifyScore(score) {
  if (!score) {
    return null;
  }

  return {
    winner: score.winner ?? null,
    duration: score.duration ?? null,
    fullTime: {
      home: score.fullTime?.home ?? null,
      away: score.fullTime?.away ?? null
    },
    halfTime: {
      home: score.halfTime?.home ?? null,
      away: score.halfTime?.away ?? null
    }
  };
}

function simplifyMatch(match) {
  return {
    id: match.id ?? null,
    utcDate: match.utcDate ?? null,
    status: match.status ?? null,
    matchday: match.matchday ?? null,
    stage: match.stage ?? null,

    homeTeam: simplifyTeam(match.homeTeam),
    awayTeam: simplifyTeam(match.awayTeam),

    score: simplifyScore(match.score),

    competition: match.competition
      ? {
          id: match.competition.id ?? null,
          name: match.competition.name ?? "",
          code: match.competition.code ?? ""
        }
      : null
  };
}

function simplifyStandingRow(row) {
  return {
    position: row.position ?? null,
    team: simplifyTeam(row.team),

    playedGames: row.playedGames ?? 0,
    form: row.form ?? null,

    won: row.won ?? 0,
    draw: row.draw ?? 0,
    lost: row.lost ?? 0,

    points: row.points ?? 0,

    goalsFor: row.goalsFor ?? 0,
    goalsAgainst: row.goalsAgainst ?? 0,
    goalDifference: row.goalDifference ?? 0
  };
}

function simplifyStandings(data) {
  const table =
    data?.standings?.find(
      standing =>
        standing.type === "TOTAL" ||
        standing.stage === "REGULAR_SEASON"
    )?.table ||
    data?.standings?.[0]?.table ||
    [];

  return table.map(simplifyStandingRow);
}

async function getLeagueData(env, league) {
  const code = getLeagueCode(league);

  if (!code) {
    throw new Error(`Unknown league: ${league}`);
  }

  const today = getTodayString();

  const dateFrom = addDays(today, -30);
  const dateTo = addDays(today, 30);

  const matchesPath =
    `/competitions/${code}/matches` +
    `?dateFrom=${dateFrom}` +
    `&dateTo=${dateTo}`;

  const standingsPath =
    `/competitions/${code}/standings`;

  const [matchesData, standingsData] = await Promise.all([
    footballDataJson(env, matchesPath, CACHE_TTL.leagueData),
    footballDataJson(env, standingsPath, CACHE_TTL.standings)
  ]);

  const now = Date.now();

  const matches = Array.isArray(matchesData?.matches)
    ? matchesData.matches
    : [];

  const live = [];
  const results = [];
  const upcoming = [];

  for (const match of matches) {
    const simplified = simplifyMatch(match);

    const status = String(match.status || "").toUpperCase();

    const matchTime = match.utcDate
      ? new Date(match.utcDate).getTime()
      : 0;

    if (
      status === "LIVE" ||
      status === "IN_PLAY" ||
      status === "PAUSED"
    ) {
      live.push(simplified);
      continue;
    }

    if (status === "FINISHED") {
      results.push(simplified);
      continue;
    }

    if (
      (status === "TIMED" || status === "SCHEDULED") &&
      matchTime >= now
    ) {
      upcoming.push(simplified);
    }
  }

  // Most recent results first.
  results.sort((a, b) => {
    return new Date(b.utcDate) - new Date(a.utcDate);
  });

  // Upcoming fixtures soonest first.
  upcoming.sort((a, b) => {
    return new Date(a.utcDate) - new Date(b.utcDate);
  });

  // Live matches by kickoff time.
  live.sort((a, b) => {
    return new Date(a.utcDate) - new Date(b.utcDate);
  });

  const standings = simplifyStandings(standingsData);

  return {
    league,
    code,

    updatedAt: new Date().toISOString(),

    live,
    results,
    upcoming,
    standings
  };
}

async function getLeagueDataCached(env, league) {
  const key = String(league || "").toLowerCase();

  if (inFlight.has(key)) {
    return await inFlight.get(key);
  }

  const promise = getLeagueData(env, league);

  inFlight.set(key, promise);

  try {
    return await promise;
  } finally {
    inFlight.delete(key);
  }
}

async function handleLeagueData(request, env, league) {
  if (!getLeagueCode(league)) {
    return jsonResponse(
      {
        error: "Unknown league.",
        availableLeagues: Object.keys(LEAGUES)
      },
      400
    );
  }

  const cache = caches.default;

  const cacheUrl =
    `https://cache.score-dash.local/api/league-data?league=${encodeURIComponent(
      league
    )}`;

  const cacheRequest = new Request(cacheUrl, {
    method: "GET"
  });

  const cached = await cache.match(cacheRequest);

  if (cached) {
    return cached;
  }

  try {
    const data = await getLeagueDataCached(env, league);

    const response = jsonResponse(data, 200, {
      "Cache-Control":
        `public, max-age=${CACHE_TTL.leagueData}, stale-while-revalidate=60`
    });

    await cache.put(cacheRequest, response.clone());

    return response;
  } catch (error) {
    console.error("league-data error:", error);

    return jsonResponse(
      {
        error: "Unable to load league data.",
        message: error?.message || String(error)
      },
      502,
      {
        "Cache-Control": "no-store"
      }
    );
  }
}

async function handleLiveScores(env, league) {
  const code = getLeagueCode(league);

  if (!code) {
    return jsonResponse({ error: "Unknown league." }, 400);
  }

  const today = getTodayString();

  const dateFrom = addDays(today, -1);
  const dateTo = addDays(today, 1);

  const data = await footballDataJson(
    env,
    `/competitions/${code}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`,
    CACHE_TTL.live
  );

  const matches = Array.isArray(data?.matches)
    ? data.matches
    : [];

  const live = matches
    .filter(match => {
      const status = String(match.status || "").toUpperCase();

      return (
        status === "LIVE" ||
        status === "IN_PLAY" ||
        status === "PAUSED"
      );
    })
    .map(simplifyMatch);

  return jsonResponse({
    league,
    count: live.length,
    matches: live
  });
}

async function handleResults(env, league) {
  const code = getLeagueCode(league);

  if (!code) {
    return jsonResponse({ error: "Unknown league." }, 400);
  }

  const today = getTodayString();

  const dateFrom = addDays(today, -30);
  const dateTo = today;

  const data = await footballDataJson(
    env,
    `/competitions/${code}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`,
    CACHE_TTL.results
  );

  const matches = Array.isArray(data?.matches)
    ? data.matches
    : [];

  const results = matches
    .filter(match => {
      return String(match.status || "").toUpperCase() === "FINISHED";
    })
    .map(simplifyMatch)
    .sort((a, b) => {
      return new Date(b.utcDate) - new Date(a.utcDate);
    });

  return jsonResponse({
    league,
    count: results.length,
    matches: results
  });
}

async function handleUpcoming(env, league) {
  const code = getLeagueCode(league);

  if (!code) {
    return jsonResponse({ error: "Unknown league." }, 400);
  }

  const today = getTodayString();

  const dateFrom = today;
  const dateTo = addDays(today, 30);

  const data = await footballDataJson(
    env,
    `/competitions/${code}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`,
    CACHE_TTL.upcoming
  );

  const matches = Array.isArray(data?.matches)
    ? data.matches
    : [];

  const now = Date.now();

  const upcoming = matches
    .filter(match => {
      const status = String(match.status || "").toUpperCase();

      const matchTime = match.utcDate
        ? new Date(match.utcDate).getTime()
        : 0;

      return (
        (status === "TIMED" || status === "SCHEDULED") &&
        matchTime >= now
      );
    })
    .map(simplifyMatch)
    .sort((a, b) => {
      return new Date(a.utcDate) - new Date(b.utcDate);
    });

  return jsonResponse({
    league,
    count: upcoming.length,
    matches: upcoming
  });
}

async function handleStandings(env, league) {
  const code = getLeagueCode(league);

  if (!code) {
    return jsonResponse({ error: "Unknown league." }, 400);
  }

  const data = await footballDataJson(
    env,
    `/competitions/${code}/standings`,
    CACHE_TTL.standings
  );

  return jsonResponse({
    league,
    standings: simplifyStandings(data)
  });
}

async function handleCompetition(env, league) {
  const code = getLeagueCode(league);

  if (!code) {
    return jsonResponse({ error: "Unknown league." }, 400);
  }

  const data = await footballDataJson(
    env,
    `/competitions/${code}`,
    CACHE_TTL.competition
  );

  return jsonResponse(data);
}

async function handleMatch(env, matchId) {
  if (!matchId) {
    return jsonResponse(
      { error: "Match ID is required." },
      400
    );
  }

  const data = await footballDataJson(
    env,
    `/matches/${encodeURIComponent(matchId)}`,
    CACHE_TTL.match
  );

  return jsonResponse(data);
}

async function handleTest(env) {
  const data = await footballDataJson(
    env,
    `/competitions/PL`,
    CACHE_TTL.competition
  );

  return jsonResponse({
    success: true,
    competition: {
      id: data?.id ?? null,
      name: data?.name ?? null,
      code: data?.code ?? null,
      season: data?.currentSeason
        ? {
            id: data.currentSeason.id ?? null,
            startDate: data.currentSeason.startDate ?? null,
            endDate: data.currentSeason.endDate ?? null
          }
        : null
    }
  });
}

async function serveAsset(request, env) {
  if (!env.ASSETS) {
    return new Response("Asset binding not configured.", {
      status: 500
    });
  }

  return env.ASSETS.fetch(request);
}

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);

      const pathname = url.pathname;
      const league = url.searchParams.get("league");

      // API routes
      if (pathname.startsWith("/api/")) {

        if (pathname === "/api/test-football-data") {
          return await handleTest(env);
        }

        if (pathname === "/api/league-data") {
          return await handleLeagueData(
            request,
            env,
            league
          );
        }

        if (pathname === "/api/live-scores") {
          return await handleLiveScores(
            env,
            league
          );
        }

        if (pathname === "/api/results") {
          return await handleResults(
            env,
            league
          );
        }

        if (pathname === "/api/upcoming") {
          return await handleUpcoming(
            env,
            league
          );
        }

        if (pathname === "/api/standings") {
          return await handleStandings(
            env,
            league
          );
        }

        if (pathname === "/api/competition") {
          return await handleCompetition(
            env,
            league
          );
        }

        if (pathname === "/api/match") {
          const matchId =
            url.searchParams.get("id") ||
            url.searchParams.get("match");

          return await handleMatch(
            env,
            matchId
          );
        }

        return jsonResponse(
          {
            error: "API route not found.",
            path: pathname
          },
          404
        );
      }

      // Everything else is served from the site's assets.
      return await serveAsset(request, env);

    } catch (error) {
      console.error("Worker error:", error);

      return jsonResponse(
        {
          error: "Worker error.",
          message: error?.message || String(error)
        },
        500,
        {
          "Cache-Control": "no-store"
        }
      );
    }
  }
};
