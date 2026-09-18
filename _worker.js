const FOOTBALL_DATA_API = "https://api.football-data.org/v4";

const LEAGUES = {
  premier: "PL",
  laliga: "PD",
  seriea: "SA",
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
  leagueData: 120,
  team: 3600,
  teamMatches: 120,
  teamScorers: 300
};

const inFlight = new Map();

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders
    }
  });
}

function getLeagueCode(league) {
  const key = String(league || "").trim().toLowerCase();
  return LEAGUES[key] || null;
}

function getTodayString() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}


/* =========================================================
   FOOTBALL-DATA.ORG REQUEST
   ========================================================= */

async function footballDataRequest(
  env,
  path,
  cacheTtl = 300,
  extraHeaders = {}
) {
  if (!env.FootballDataToken) {
    throw new Error("FootballDataToken secret is missing.");
  }

  const cache = caches.default;

  /*
    IMPORTANT:
    The cache key includes the complete API path.

    This prevents:
      Premier League
      LaLiga
      Serie A
      Bundesliga
      Ligue 1

    from accidentally sharing cached responses.
  */

  const cacheUrl =
    `https://cache.score-dash.local${path}`;

  const cacheRequest =
    new Request(cacheUrl, {
      method: "GET"
    });

  const cached =
    await cache.match(cacheRequest);

  if (cached) {
    return cached;
  }

  const url =
    `${FOOTBALL_DATA_API}${path}`;

  const response =
    await fetch(url, {
      method: "GET",

      headers: {
        "X-Auth-Token":
          env.FootballDataToken,

        "Accept":
          "application/json",

        ...extraHeaders
      }
    });

  const body =
    await response.arrayBuffer();

  if (!response.ok) {
    const text =
      new TextDecoder().decode(body);

    return new Response(
      JSON.stringify({
        error:
          "Football-data.org request failed.",

        status:
          response.status,

        details:
          text
      }),
      {
        status:
          response.status,

        headers: {
          "Content-Type":
            "application/json; charset=utf-8",

          "Cache-Control":
            "no-store"
        }
      }
    );
  }

  const headers =
    new Headers(response.headers);

  headers.set(
    "Content-Type",
    "application/json; charset=utf-8"
  );

  headers.set(
    "Cache-Control",
    `public, max-age=${cacheTtl}, stale-while-revalidate=60`
  );

  const cachedResponse =
    new Response(
      body,
      {
        status:
          response.status,

        headers
      }
    );

  await cache.put(
    cacheRequest,
    cachedResponse.clone()
  );

  return cachedResponse;
}


async function footballDataJson(
  env,
  path,
  cacheTtl = 300,
  extraHeaders = {}
) {
  const response =
    await footballDataRequest(
      env,
      path,
      cacheTtl,
      extraHeaders
    );

  const text =
    await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      "Football-data.org returned invalid JSON."
    );
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


/* =========================================================
   SIMPLIFIERS
   ========================================================= */

function simplifyTeam(team) {
  if (!team) {
    return null;
  }

  return {
    id:
      team.id ?? null,

    name:
      team.name ?? "",

    shortName:
      team.shortName ??
      team.name ??
      "",

    tla:
      team.tla ?? "",

    crest:
      team.crest ?? "",

    venue:
      team.venue ?? "",

    founded:
      team.founded ?? null
  };
}


function simplifyScore(score) {
  if (!score) {
    return null;
  }

  return {
    winner:
      score.winner ?? null,

    duration:
      score.duration ?? null,

    fullTime: {
      home:
        score.fullTime?.home ?? null,

      away:
        score.fullTime?.away ?? null
    },

    halfTime: {
      home:
        score.halfTime?.home ?? null,

      away:
        score.halfTime?.away ?? null
    }
  };
}


function simplifyMatch(match) {
  return {
    id:
      match.id ?? null,

    utcDate:
      match.utcDate ?? null,

    status:
      match.status ?? null,

    minute:
      match.minute ?? null,

    injuryTime:
      match.injuryTime ?? null,

    matchday:
      match.matchday ?? null,

    stage:
      match.stage ?? null,

    homeTeam:
      simplifyTeam(
        match.homeTeam
      ),

    awayTeam:
      simplifyTeam(
        match.awayTeam
      ),

    score:
      simplifyScore(
        match.score
      ),

    competition:
      match.competition
        ? {
            id:
              match.competition.id ??
              null,

            name:
              match.competition.name ??
              "",

            code:
              match.competition.code ??
              ""
          }
        : null
  };
}


function simplifyStandingRow(row) {
  return {
    position:
      row.position ?? null,

    team:
      simplifyTeam(row.team),

    playedGames:
      row.playedGames ?? 0,

    form:
      row.form ?? null,

    won:
      row.won ?? 0,

    draw:
      row.draw ?? 0,

    lost:
      row.lost ?? 0,

    points:
      row.points ?? 0,

    goalsFor:
      row.goalsFor ?? 0,

    goalsAgainst:
      row.goalsAgainst ?? 0,

    goalDifference:
      row.goalDifference ?? 0
  };
}


/* =========================================================
   STANDINGS
   ========================================================= */

function simplifyStandings(data) {
  const groups =
    Array.isArray(data?.standings)
      ? data.standings
      : [];

  function getGroup(type) {
    const group =
      groups.find(
        item =>
          String(
            item?.type || ""
          ).toUpperCase() === type
      );

    return Array.isArray(group?.table)
      ? group.table.map(
          simplifyStandingRow
        )
      : [];
  }

  return {
    TOTAL:
      getGroup("TOTAL"),

    HOME:
      getGroup("HOME"),

    AWAY:
      getGroup("AWAY")
  };
}


/* =========================================================
   LEAGUE DATA
   ========================================================= */

async function getLeagueData(
  env,
  league
) {
  const code =
    getLeagueCode(league);

  if (!code) {
    throw new Error(
      `Unknown league: ${league}`
    );
  }

  const today =
    getTodayString();

  const dateFrom =
    addDays(today, -30);

  const dateTo =
    addDays(today, 30);

  const matchesPath =
    `/competitions/${code}/matches` +
    `?dateFrom=${dateFrom}` +
    `&dateTo=${dateTo}`;

  const standingsPath =
    `/competitions/${code}/standings`;

  const [
    matchesData,
    standingsData
  ] =
    await Promise.all([
      footballDataJson(
        env,
        matchesPath,
        CACHE_TTL.leagueData
      ),

      footballDataJson(
        env,
        standingsPath,
        CACHE_TTL.standings
      )
    ]);

  const now =
    Date.now();

  const matches =
    Array.isArray(
      matchesData?.matches
    )
      ? matchesData.matches
      : [];

  const live = [];
  const results = [];
  const upcoming = [];

  for (const match of matches) {
    const simplified =
      simplifyMatch(match);

    const status =
      String(
        match.status || ""
      ).toUpperCase();

    const matchTime =
      match.utcDate
        ? new Date(
            match.utcDate
          ).getTime()
        : 0;

    if (
      status === "LIVE" ||
      status === "IN_PLAY" ||
      status === "PAUSED" ||
      status === "EXTRA_TIME" ||
      status === "PENALTY_SHOOTOUT"
    ) {
      live.push(
        simplified
      );

      continue;
    }

    if (
      status === "FINISHED"
    ) {
      results.push(
        simplified
      );

      continue;
    }

    if (
      (
        status === "TIMED" ||
        status === "SCHEDULED"
      ) &&
      matchTime >= now
    ) {
      upcoming.push(
        simplified
      );
    }
  }

  results.sort(
    (a, b) =>
      new Date(b.utcDate) -
      new Date(a.utcDate)
  );

  upcoming.sort(
    (a, b) =>
      new Date(a.utcDate) -
      new Date(b.utcDate)
  );

  live.sort(
    (a, b) =>
      new Date(a.utcDate) -
      new Date(b.utcDate)
  );

  return {
    league:
      String(league).toLowerCase(),

    code,

    updatedAt:
      new Date().toISOString(),

    live: {
      count:
        live.length,

      matches:
        live
    },

    results: {
      count:
        results.length,

      matches:
        results
    },

    upcoming: {
      count:
        upcoming.length,

      matches:
        upcoming
    },

    standings:
      simplifyStandings(
        standingsData
      )
  };
}


async function getLeagueDataCached(
  env,
  league
) {
  const key =
    String(
      league || ""
    ).toLowerCase();

  if (
    inFlight.has(key)
  ) {
    return await inFlight.get(key);
  }

  const promise =
    getLeagueData(
      env,
      key
    );

  inFlight.set(
    key,
    promise
  );

  try {
    return await promise;
  } finally {
    inFlight.delete(key);
  }
}


/* =========================================================
   LEAGUE DATA ENDPOINT
   ========================================================= */

async function handleLeagueData(
  env,
  league
) {
  const key =
    String(
      league || ""
    ).toLowerCase();

  if (!getLeagueCode(key)) {
    return jsonResponse(
      {
        error:
          "Unknown league.",

        availableLeagues:
          Object.keys(LEAGUES)
      },

      400
    );
  }

  try {
    const data =
      await getLeagueDataCached(
        env,
        key
      );

    return jsonResponse(
      data,
      200,
      {
        "Cache-Control":
          `public, max-age=${CACHE_TTL.leagueData}, stale-while-revalidate=60`
      }
    );

  } catch (error) {
    console.error(
      "league-data error:",
      error
    );

    return jsonResponse(
      {
        error:
          "Unable to load league data.",

        message:
          error?.message ||
          String(error)
      },

      502
    );
  }
}


/* =========================================================
   LIVE SCORES
   ========================================================= */

async function handleLiveScores(
  env,
  league
) {
  const code =
    getLeagueCode(league);

  if (!code) {
    return jsonResponse(
      {
        error:
          "Unknown league."
      },
      400
    );
  }

  const today =
    getTodayString();

  const dateFrom =
    addDays(today, -1);

  const dateTo =
    addDays(today, 1);

  try {
    const data =
      await footballDataJson(
        env,

        `/competitions/${code}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`,

        CACHE_TTL.live
      );

    const matches =
      Array.isArray(
        data?.matches
      )
        ? data.matches
        : [];

    const live =
      matches
        .filter(match => {
          const status =
            String(
              match.status || ""
            ).toUpperCase();

          return (
            status === "LIVE" ||
            status === "IN_PLAY" ||
            status === "PAUSED" ||
            status === "EXTRA_TIME" ||
            status === "PENALTY_SHOOTOUT"
          );
        })
        .map(
          simplifyMatch
        );

    return jsonResponse({
      league,
      count:
        live.length,
      matches:
        live
    });

  } catch (error) {
    return jsonResponse(
      {
        error:
          "Unable to load live scores.",

        message:
          error?.message ||
          String(error)
      },
      502
    );
  }
}


/* =========================================================
   RESULTS
   ========================================================= */

async function handleResults(
  env,
  league
) {
  const code =
    getLeagueCode(league);

  if (!code) {
    return jsonResponse(
      {
        error:
          "Unknown league."
      },
      400
    );
  }

  const today =
    getTodayString();

  const dateFrom =
    addDays(today, -30);

  try {
    const data =
      await footballDataJson(
        env,

        `/competitions/${code}/matches?dateFrom=${dateFrom}&dateTo=${today}`,

        CACHE_TTL.results
      );

    const matches =
      Array.isArray(
        data?.matches
      )
        ? data.matches
        : [];

    const results =
      matches
        .filter(
          match =>
            String(
              match.status || ""
            ).toUpperCase() ===
            "FINISHED"
        )
        .map(
          simplifyMatch
        )
        .sort(
          (a, b) =>
            new Date(b.utcDate) -
            new Date(a.utcDate)
        );

    return jsonResponse({
      league,
      count:
        results.length,
      matches:
        results
    });

  } catch (error) {
    return jsonResponse(
      {
        error:
          "Unable to load results.",

        message:
          error?.message ||
          String(error)
      },
      502
    );
  }
}


/* =========================================================
   UPCOMING
   ========================================================= */

async function handleUpcoming(
  env,
  league
) {
  const code =
    getLeagueCode(league);

  if (!code) {
    return jsonResponse(
      {
        error:
          "Unknown league."
      },
      400
    );
  }

  const today =
    getTodayString();

  const dateTo =
    addDays(today, 30);

  try {
    const data =
      await footballDataJson(
        env,

        `/competitions/${code}/matches?dateFrom=${today}&dateTo=${dateTo}`,

        CACHE_TTL.upcoming
      );

    const matches =
      Array.isArray(
        data?.matches
      )
        ? data.matches
        : [];

    const now =
      Date.now();

    const upcoming =
      matches
        .filter(match => {
          const status =
            String(
              match.status || ""
            ).toUpperCase();

          const matchTime =
            match.utcDate
              ? new Date(
                  match.utcDate
                ).getTime()
              : 0;

          return (
            (
              status === "TIMED" ||
              status === "SCHEDULED"
            ) &&
            matchTime >= now
          );
        })
        .map(
          simplifyMatch
        )
        .sort(
          (a, b) =>
            new Date(a.utcDate) -
            new Date(b.utcDate)
        );

    return jsonResponse({
      league,
      count:
        upcoming.length,
      matches:
        upcoming
    });

  } catch (error) {
    return jsonResponse(
      {
        error:
          "Unable to load upcoming fixtures.",

        message:
          error?.message ||
          String(error)
      },
      502
    );
  }
}


/* =========================================================
   STANDINGS
   ========================================================= */

async function handleStandings(
  env,
  league
) {
  const code =
    getLeagueCode(league);

  if (!code) {
    return jsonResponse(
      {
        error:
          "Unknown league."
      },
      400
    );
  }

  try {
    const data =
      await footballDataJson(
        env,

        `/competitions/${code}/standings`,

        CACHE_TTL.standings
      );

    /*
      Return exactly the same structure used
      by /api/league-data.
    */

    return jsonResponse({
      league,

      code,

      standings:
        simplifyStandings(data)
    });

  } catch (error) {
    return jsonResponse(
      {
        error:
          "Unable to load standings.",

        message:
          error?.message ||
          String(error)
      },
      502
    );
  }
}


/* =========================================================
   COMPETITION
   ========================================================= */

async function handleCompetition(
  env,
  league
) {
  const code =
    getLeagueCode(league);

  if (!code) {
    return jsonResponse(
      {
        error:
          "Unknown league."
      },
      400
    );
  }

  try {
    const data =
      await footballDataJson(
        env,

        `/competitions/${code}`,

        CACHE_TTL.competition
      );

    return jsonResponse(
      data
    );

  } catch (error) {
    return jsonResponse(
      {
        error:
          "Unable to load competition.",

        message:
          error?.message ||
          String(error)
      },
      502
    );
  }
}


/* =========================================================
   SINGLE MATCH
   ========================================================= */

async function handleMatch(
  env,
  matchId
) {
  if (!matchId) {
    return jsonResponse(
      {
        error:
          "Match ID is required."
      },
      400
    );
  }

  try {
    const data =
      await footballDataJson(
        env,

        `/matches/${encodeURIComponent(matchId)}`,

        CACHE_TTL.match,

        {
          "X-Unfold-Goals":
            "true",

          "X-Unfold-Bookings":
            "true"
        }
      );

    return jsonResponse(
      data
    );

  } catch (error) {
    return jsonResponse(
      {
        error:
          "Unable to load match.",

        message:
          error?.message ||
          String(error)
      },
      502
    );
  }
}


/* =========================================================
   TEAM
   ========================================================= */

async function handleTeam(
  env,
  teamId
) {
  if (!teamId) {
    return jsonResponse(
      {
        error:
          "Team ID is required."
      },
      400
    );
  }

  try {
    const data =
      await footballDataJson(
        env,

        `/teams/${encodeURIComponent(teamId)}`,

        CACHE_TTL.team
      );

    return jsonResponse({
      id:
        data?.id ?? null,

      name:
        data?.name ?? "",

      shortName:
        data?.shortName ??
        data?.name ??
        "",

      tla:
        data?.tla ?? "",

      crest:
        data?.crest ?? "",

      venue:
        data?.venue ?? "",

      founded:
        data?.founded ?? null,

      address:
        data?.address ?? "",

      website:
        data?.website ?? "",

      area:
        data?.area ?? null
    });

  } catch (error) {
    return jsonResponse(
      {
        error:
          "Unable to load team.",

        message:
          error?.message ||
          String(error)
      },
      502
    );
  }
}


/* =========================================================
   TEAM MATCHES
   ========================================================= */

async function handleTeamMatches(
  env,
  teamId,
  league
) {
  if (!teamId) {
    return jsonResponse(
      {
        error:
          "Team ID is required."
      },
      400
    );
  }

  const code =
    getLeagueCode(league);

  if (!code) {
    return jsonResponse(
      {
        error:
          "Unknown league."
      },
      400
    );
  }

  const today =
    getTodayString();

  const dateFrom =
    addDays(today, -120);

  const dateTo =
    addDays(today, 60);

  const path =
    `/teams/${encodeURIComponent(teamId)}/matches` +
    `?dateFrom=${dateFrom}` +
    `&dateTo=${dateTo}` +
    `&competitions=${encodeURIComponent(code)}` +
    `&limit=100`;

  try {
    const data =
      await footballDataJson(
        env,
        path,
        CACHE_TTL.teamMatches
      );

    const matches =
      Array.isArray(
        data?.matches
      )
        ? data.matches
            .map(
              simplifyMatch
            )
            .sort(
              (a,b) =>
                new Date(b.utcDate) -
                new Date(a.utcDate)
            )
        : [];

    return jsonResponse({
      teamId:
        String(teamId),

      league,

      code,

      count:
        matches.length,

      matches
    });

  } catch (error) {
    return jsonResponse(
      {
        error:
          "Unable to load team matches.",

        message:
          error?.message ||
          String(error)
      },
      502
    );
  }
}


/* =========================================================
   TEAM SCORERS
   ========================================================= */

async function handleTeamScorers(
  env,
  teamId,
  league
) {
  if (!teamId) {
    return jsonResponse(
      {
        error:
          "Team ID is required."
      },
      400
    );
  }

  const code =
    getLeagueCode(league);

  if (!code) {
    return jsonResponse(
      {
        error:
          "Unknown league."
      },
      400
    );
  }

  try {
    /*
      football-data.org provides competition
      scorers, not a separate "team scorers"
      endpoint.

      We therefore retrieve the competition
      scorer list and keep only this team.
    */

    const data =
      await footballDataJson(
        env,

        `/competitions/${code}/scorers?limit=100`,

        CACHE_TTL.teamScorers
      );

    const scorers =
      Array.isArray(
        data?.scorers
      )
        ? data.scorers
            .filter(item =>
              String(
                item?.team?.id
              ) ===
              String(teamId)
            )
            .map(item => ({
              player:
                item?.player
                  ? {
                      id:
                        item.player.id ??
                        null,

                      name:
                        item.player.name ??
                        ""
                    }
                  : null,

              team:
                item?.team
                  ? simplifyTeam(
                      item.team
                    )
                  : null,

              goals:
                item?.goals ?? 0,

              assists:
                item?.assists ?? 0,

              penalties:
                item?.penalties ?? 0
            }))
        : [];

    return jsonResponse({
      teamId:
        String(teamId),

      league,

      code,

      count:
        scorers.length,

      scorers
    });

  } catch (error) {
    return jsonResponse(
      {
        error:
          "Unable to load team scorers.",

        message:
          error?.message ||
          String(error)
      },
      502
    );
  }
}


/* =========================================================
   TEST
   ========================================================= */

async function handleTest(
  env
) {
  try {
    const data =
      await footballDataJson(
        env,

        `/competitions/PL`,

        CACHE_TTL.competition
      );

    return jsonResponse({
      success:
        true,

      competition: {
        id:
          data?.id ?? null,

        name:
          data?.name ?? null,

        code:
          data?.code ?? null,

        season:
          data?.currentSeason
            ? {
                id:
                  data.currentSeason.id ??
                  null,

                startDate:
                  data.currentSeason.startDate ??
                  null,

                endDate:
                  data.currentSeason.endDate ??
                  null
              }
            : null
      }
    });

  } catch (error) {
    return jsonResponse(
      {
        success:
          false,

        error:
          error?.message ||
          String(error)
      },
      502
    );
  }
}


/* =========================================================
   STATIC ASSETS
   ========================================================= */

async function serveAsset(
  request,
  env
) {
  if (!env.ASSETS) {
    return new Response(
      "Asset binding not configured.",
      {
        status: 500
      }
    );
  }

  return env.ASSETS.fetch(
    request
  );
}


/* =========================================================
   MAIN WORKER
   ========================================================= */

export default {

  async fetch(
    request,
    env,
    ctx
  ) {

    try {

      const url =
        new URL(
          request.url
        );

      const pathname =
        url.pathname;

      const league =
        String(
          url.searchParams.get(
            "league"
          ) || ""
        ).toLowerCase();


      /* =========================
         API
         ========================= */

      if (
        pathname.startsWith(
          "/api/"
        )
      ) {

        if (
          pathname ===
          "/api/test-football-data"
        ) {
          return await
            handleTest(env);
        }


        if (
          pathname ===
          "/api/league-data"
        ) {
          return await
            handleLeagueData(
              env,
              league
            );
        }


        if (
          pathname ===
          "/api/live-scores"
        ) {
          return await
            handleLiveScores(
              env,
              league
            );
        }


        if (
          pathname ===
          "/api/results"
        ) {
          return await
            handleResults(
              env,
              league
            );
        }


        if (
          pathname ===
          "/api/upcoming"
        ) {
          return await
            handleUpcoming(
              env,
              league
            );
        }


        if (
          pathname ===
          "/api/standings"
        ) {
          return await
            handleStandings(
              env,
              league
            );
        }


        if (
          pathname ===
          "/api/competition"
        ) {
          return await
            handleCompetition(
              env,
              league
            );
        }


        if (
          pathname ===
          "/api/match"
        ) {

          const matchId =
            url.searchParams.get(
              "matchId"
            ) ||
            url.searchParams.get(
              "id"
            ) ||
            url.searchParams.get(
              "match"
            );

          return await
            handleMatch(
              env,
              matchId
            );
        }


        if (
          pathname ===
          "/api/team"
        ) {

          const teamId =
            url.searchParams.get(
              "teamId"
            ) ||
            url.searchParams.get(
              "id"
            );

          return await
            handleTeam(
              env,
              teamId
            );
        }


        if (
          pathname ===
          "/api/team-matches"
        ) {

          const teamId =
            url.searchParams.get(
              "teamId"
            ) ||
            url.searchParams.get(
              "id"
            );

          return await
            handleTeamMatches(
              env,
              teamId,
              league
            );
        }


        if (
          pathname ===
          "/api/team-scorers"
        ) {

          const teamId =
            url.searchParams.get(
              "teamId"
            ) ||
            url.searchParams.get(
              "id"
            );

          return await
            handleTeamScorers(
              env,
              teamId,
              league
            );
        }


        return jsonResponse(
          {
            error:
              "API route not found.",

            path:
              pathname
          },

          404
        );
      }


      /* =========================
         WEBSITE
         ========================= */

      return await
        serveAsset(
          request,
          env
        );

    } catch (error) {

      console.error(
        "Worker error:",
        error
      );

      return jsonResponse(
        {
          error:
            "Worker error.",

          message:
            error?.message ||
            String(error)
        },

        500
      );
    }
  }
};
