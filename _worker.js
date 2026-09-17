const DATA_API = "https://api.football-data.org/v4";

const LEAGUES = {
  premier: { code: "PL", name: "Premier League" },
  laliga: { code: "PD", name: "La Liga" },
  seriea: { code: "SA", name: "Serie A" },
  bundesliga: { code: "BL1", name: "Bundesliga" },
  ligue1: { code: "FL1", name: "Ligue 1" }
};

const CACHE_TTL = {
  live: 60,
  standings: 300,
  results: 600,
  upcoming: 600,
  competition: 86400,
  match: 120,
  team: 600,
  teamMatches: 300,
  scorers: 600
};

function jsonResponse(data, status = 200, extraHeaders = {}) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    ...extraHeaders
  };

  return new Response(JSON.stringify(data), {
    status,
    headers
  });
}

async function footballDataRequest(
  path,
  env,
  cacheKey,
  ttl,
  ctx,
  options = {}
) {
  if (!env.FootballDataToken) {
    return jsonResponse(
      { error: "FootballDataToken secret is missing." },
      500
    );
  }

  const cache = caches.default;

  const cached = await cache.match(cacheKey);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(`${DATA_API}${path}`, {
      method: "GET",
      cache: "no-store",
      headers: {
        "X-Auth-Token": env.FootballDataToken,
        "Accept": "application/json",
        ...options.headers
      }
    });

    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      data = {
        raw: text
      };
    }

    if (!response.ok) {
      const headers = {};

      const resetSeconds =
        response.headers.get("X-RequestCounter-Reset");

      if (resetSeconds) {
        headers["Retry-After"] = resetSeconds;
      }

      return jsonResponse(
        {
          error: "football-data.org request failed.",
          api: data
        },
        response.status,
        headers
      );
    }

    const result = jsonResponse(
      data,
      200,
      {
        "Cache-Control": `public, max-age=${ttl}`
      }
    );

    ctx.waitUntil(
      cache.put(cacheKey, result.clone())
    );

    return result;

  } catch (error) {
    return jsonResponse(
      {
        error: "Unable to contact football-data.org.",
        details: error.message
      },
      500
    );
  }
}

function getLeague(url) {
  const leagueKey =
    url.searchParams.get("league") || "premier";

  return LEAGUES[leagueKey] || null;
}

function getCacheKey(url) {
  return new Request(
    url.toString(),
    {
      method: "GET"
    }
  );
}

function getMatchId(url) {
  const value = url.searchParams.get("matchId");

  if (!value || !/^\d+$/.test(value)) {
    return null;
  }

  return value;
}

function getTeamId(url) {
  const value = url.searchParams.get("teamId");

  if (!value || !/^\d+$/.test(value)) {
    return null;
  }

  return value;
}

function getLeagueFromTeamUrl(url) {
  const leagueKey =
    url.searchParams.get("league") || "premier";

  return LEAGUES[leagueKey] || null;
}

async function getJson(path, env, options = {}) {
  const response = await fetch(`${DATA_API}${path}`, {
    method: "GET",
    cache: "no-store",
    headers: {
      "X-Auth-Token": env.FootballDataToken,
      "Accept": "application/json",
      ...options.headers
    }
  });

  const text = await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    data = {
      raw: text
    };
  }

  if (!response.ok) {
    throw new Error(
      `football-data.org returned ${response.status}`
    );
  }

  return data;
}

export default {
  async fetch(request, env, ctx) {

    const url = new URL(request.url);

    /*
     * CORS
     */

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }

    /*
     * API ROUTES
     */

    if (url.pathname.startsWith("/api/")) {

      /*
       * SINGLE MATCH
       *
       * /api/match?matchId=123456
       */

      if (url.pathname === "/api/match") {

        const matchId = getMatchId(url);

        if (!matchId) {
          return jsonResponse(
            {
              error: "A valid numeric matchId is required."
            },
            400
          );
        }

        const cacheKey = getCacheKey(url);

        return footballDataRequest(
          `/matches/${matchId}`,
          env,
          cacheKey,
          CACHE_TTL.match,
          ctx,
          {
            headers: {
              "X-Unfold-Goals": "true",
              "X-Unfold-Bookings": "true"
            }
          }
        );
      }

      /*
       * TEAM PROFILE
       *
       * /api/team?teamId=57&league=premier
       *
       * Returns:
       * - club information
       * - crest
       * - stadium
       * - founded
       * - website
       * - current competitions
       */

      if (url.pathname === "/api/team") {

        const teamId = getTeamId(url);

        if (!teamId) {
          return jsonResponse(
            {
              error: "A valid numeric teamId is required."
            },
            400
          );
        }

        const cacheKey = getCacheKey(url);

        return footballDataRequest(
          `/teams/${teamId}`,
          env,
          cacheKey,
          CACHE_TTL.team,
          ctx
        );
      }

      /*
       * TEAM MATCHES
       *
       * /api/team-matches?teamId=57&league=premier
       *
       * Gets the team's current-season matches.
       */

      if (url.pathname === "/api/team-matches") {

        const teamId = getTeamId(url);

        if (!teamId) {
          return jsonResponse(
            {
              error: "A valid numeric teamId is required."
            },
            400
          );
        }

        const league = getLeagueFromTeamUrl(url);

        if (!league) {
          return jsonResponse(
            {
              error: "Unknown league.",
              availableLeagues: Object.keys(LEAGUES)
            },
            400
          );
        }

        const today = new Date();

        const fromDate = new Date(today);
        fromDate.setDate(fromDate.getDate() - 90);

        const toDate = new Date(today);
        toDate.setDate(toDate.getDate() + 30);

        const from =
          fromDate.toISOString().slice(0, 10);

        const to =
          toDate.toISOString().slice(0, 10);

        const path =
          `/teams/${teamId}/matches` +
          `?dateFrom=${from}` +
          `&dateTo=${to}` +
          `&competitions=${league.code}`;

        const cacheKey = getCacheKey(url);

        return footballDataRequest(
          path,
          env,
          cacheKey,
          CACHE_TTL.teamMatches,
          ctx,
          {
            headers: {
              "X-Unfold-Goals": "true"
            }
          }
        );
      }

      /*
       * TEAM SCORERS
       *
       * /api/team-scorers?teamId=57&league=premier
       *
       * Gets competition scorers and filters them
       * down to the selected team.
       */

      if (url.pathname === "/api/team-scorers") {

        const teamId = getTeamId(url);

        if (!teamId) {
          return jsonResponse(
            {
              error: "A valid numeric teamId is required."
            },
            400
          );
        }

        const league = getLeagueFromTeamUrl(url);

        if (!league) {
          return jsonResponse(
            {
              error: "Unknown league.",
              availableLeagues: Object.keys(LEAGUES)
            },
            400
          );
        }

        const path =
          `/competitions/${league.code}/scorers?limit=100`;

        const cacheKey = getCacheKey(url);

        const response =
          await footballDataRequest(
            path,
            env,
            cacheKey,
            CACHE_TTL.scorers,
            ctx
          );

        if (!response.ok) {
          return response;
        }

        try {

          const data = await response.json();

          const scorers =
            Array.isArray(data.scorers)
              ? data.scorers
              : [];

          const teamScorers =
            scorers.filter(item => {

              const scorerTeamId =
                item?.team?.id;

              return String(scorerTeamId) === String(teamId);
            });

          return jsonResponse({
            count: teamScorers.length,
            competition:
              data.competition || null,
            season:
              data.season || null,
            scorers: teamScorers
          });

        } catch (error) {

          return jsonResponse(
            {
              error:
                "Unable to process scorer data.",
              details: error.message
            },
            500
          );
        }
      }

      /*
       * LIVE SCORES
       */

      const league = getLeague(url);

      if (!league) {
        return jsonResponse(
          {
            error: "Unknown league.",
            availableLeagues: Object.keys(LEAGUES)
          },
          400
        );
      }

      const cacheKey = getCacheKey(url);

      if (url.pathname === "/api/live-scores") {

        const path =
          `/competitions/${league.code}/matches?status=LIVE`;

        return footballDataRequest(
          path,
          env,
          cacheKey,
          CACHE_TTL.live,
          ctx
        );
      }

      /*
       * UPCOMING
       */

      if (url.pathname === "/api/upcoming") {

        const today = new Date();

        const from =
          today.toISOString().slice(0, 10);

        const futureDate = new Date(today);

        futureDate.setDate(
          futureDate.getDate() + 30
        );

        const to =
          futureDate.toISOString().slice(0, 10);

        const path =
          `/competitions/${league.code}/matches` +
          `?dateFrom=${from}` +
          `&dateTo=${to}`;

        return footballDataRequest(
          path,
          env,
          cacheKey,
          CACHE_TTL.upcoming,
          ctx
        );
      }

      /*
       * RESULTS
       */

      if (url.pathname === "/api/results") {

        const today = new Date();

        const to =
          today.toISOString().slice(0, 10);

        const pastDate = new Date(today);

        pastDate.setDate(
          pastDate.getDate() - 30
        );

        const from =
          pastDate.toISOString().slice(0, 10);

        const path =
          `/competitions/${league.code}/matches` +
          `?dateFrom=${from}` +
          `&dateTo=${to}` +
          `&status=FINISHED`;

        return footballDataRequest(
          path,
          env,
          cacheKey,
          CACHE_TTL.results,
          ctx
        );
      }

      /*
       * STANDINGS
       */

      if (url.pathname === "/api/standings") {

        const path =
          `/competitions/${league.code}/standings`;

        return footballDataRequest(
          path,
          env,
          cacheKey,
          CACHE_TTL.standings,
          ctx
        );
      }

      /*
       * COMPETITION
       */

      if (url.pathname === "/api/competition") {

        const path =
          `/competitions/${league.code}`;

        return footballDataRequest(
          path,
          env,
          cacheKey,
          CACHE_TTL.competition,
          ctx
        );
      }

      /*
       * UNKNOWN API
       */

      return jsonResponse(
        {
          error: "Unknown API endpoint.",
          availableEndpoints: [
            "/api/live-scores?league=premier",
            "/api/upcoming?league=premier",
            "/api/results?league=premier",
            "/api/standings?league=premier",
            "/api/competition?league=premier",
            "/api/match?matchId=327117",
            "/api/team?teamId=57&league=premier",
            "/api/team-matches?teamId=57&league=premier",
            "/api/team-scorers?teamId=57&league=premier"
          ]
        },
        404
      );
    }

    /*
     * WEBSITE
     */

    return env.ASSETS.fetch(request);
  }
};
