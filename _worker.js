const FOOTBALL_DATA_API = "https://api.football-data.org/v4";

/*
  ------------------------------------------------------------
  SCORE DASH — FOOTBALL-DATA.ORG CONFIGURATION
  ------------------------------------------------------------
*/

const FEATURED_COMPETITIONS = {
  premier: {
    code: "PL",
    name: "Premier League",
    shortName: "Premier League",
    country: "England"
  },

  laliga: {
    code: "PD",
    name: "LaLiga",
    shortName: "LaLiga",
    country: "Spain"
  },

  seriea: {
    code: "SA",
    name: "Serie A",
    shortName: "Serie A",
    country: "Italy"
  },

  bundesliga: {
    code: "BL1",
    name: "Bundesliga",
    shortName: "Bundesliga",
    country: "Germany"
  },

  ligue1: {
    code: "FL1",
    name: "Ligue 1",
    shortName: "Ligue 1",
    country: "France"
  }
};

const CACHE_TTL = {
  competitions: 3600,
  leagueData: 60,
  standings: 300,
  match: 120,
  team: 3600,
  teamMatches: 120,
  teamScorers: 300
};

const inFlight = new Map();

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders
    }
  });
}

function getTodayString() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function cacheUrlFor(path) {
  return new Request(
    `https://score-dash-cache.invalid${path}`,
    {
      method: "GET"
    }
  );
}

/*
  ------------------------------------------------------------
  FOOTBALL-DATA.ORG REQUESTS
  ------------------------------------------------------------
*/

async function footballDataRequest(
  env,
  path,
  cacheTtl = 300,
  extraHeaders = {}
) {
  if (!env.FootballDataToken) {
    throw new Error(
      "FootballDataToken is not configured."
    );
  }

  const cache = caches.default;
  const cacheRequest = cacheUrlFor(path);

  const cached = await cache.match(cacheRequest);

  if (cached) {
    return cached;
  }

  const response = await fetch(
    `${FOOTBALL_DATA_API}${path}`,
    {
      method: "GET",
      headers: {
        "X-Auth-Token": env.FootballDataToken,
        "Accept": "application/json",
        ...extraHeaders
      }
    }
  );

  if (!response.ok) {
    let message =
      `football-data.org returned HTTP ${response.status}`;

    try {
      const errorBody =
        await response.clone().json();

      if (errorBody?.message) {
        message = errorBody.message;
      } else if (errorBody?.error) {
        message = errorBody.error;
      }
    } catch (_) {}

    const error = new Error(message);
    error.status = response.status;

    throw error;
  }

  const body = await response.arrayBuffer();

  const cachedResponse = new Response(body, {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("Content-Type") ||
        "application/json; charset=utf-8",

      "Cache-Control":
        `public, max-age=${cacheTtl}`
    }
  });

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

  return response.json();
}

/*
  ------------------------------------------------------------
  COMPETITION HELPERS
  ------------------------------------------------------------
*/

function normaliseKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function featuredCompetitionFromKey(key) {
  const normalised =
    normaliseKey(key);

  return (
    FEATURED_COMPETITIONS[
      normalised
    ] || null
  );
}

async function resolveCompetition(
  env,
  value
) {
  const input =
    String(value || "").trim();

  if (!input) {
    throw new Error(
      "A competition is required."
    );
  }

  const alias =
    featuredCompetitionFromKey(input);

  if (alias) {
    return {
      key: normaliseKey(input),
      code: alias.code,
      name: alias.name,
      shortName: alias.shortName,
      country: alias.country
    };
  }

  const upper =
    input.toUpperCase();

  /*
    First try it as a football-data.org
    competition code.
  */
  try {
    const competition =
      await footballDataJson(
        env,
        `/competitions/${encodeURIComponent(
          upper
        )}`,
        CACHE_TTL.competitions
      );

    return {
      key: slugify(
        competition.code ||
        competition.name
      ),

      code:
        competition.code ||
        upper,

      name:
        competition.name ||
        upper,

      shortName:
        competition.name ||
        upper,

      country:
        competition.area?.name ||
        "",

      emblem:
        competition.emblem ||
        null
    };
  } catch (_) {
    /*
      If it isn't a direct code, search the
      available competitions.
    */

    const competitions =
      await getAvailableCompetitions(
        env
      );

    const found =
      competitions.find(
        (competition) =>
          normaliseKey(
            competition.key
          ) ===
            normaliseKey(input) ||
          normaliseKey(
            competition.code
          ) ===
            normaliseKey(input)
      );

    if (found) {
      return found;
    }

    throw new Error(
      `Competition "${input}" was not found.`
    );
  }
}

/*
  ------------------------------------------------------------
  AVAILABLE COMPETITIONS
  ------------------------------------------------------------
*/

async function getAvailableCompetitions(
  env
) {
  const data =
    await footballDataJson(
      env,
      "/competitions",
      CACHE_TTL.competitions
    );

  const competitions =
    Array.isArray(
      data?.competitions
    )
      ? data.competitions
      : [];

  const result = [];

  for (const competition of competitions) {
    if (!competition?.code) {
      continue;
    }

    const code =
      competition.code;

    let key =
      slugify(code);

    for (
      const [
        alias,
        config
      ] of Object.entries(
        FEATURED_COMPETITIONS
      )
    ) {
      if (
        config.code ===
        code
      ) {
        key = alias;
        break;
      }
    }

    result.push({
      key,

      code,

      name:
        competition.name ||
        code,

      shortName:
        competition.name ||
        code,

      country:
        competition.area?.name ||
        "",

      areaCode:
        competition.area?.code ||
        "",

      type:
        competition.type ||
        "",

      emblem:
        competition.emblem ||
        null,

      plan:
        competition.plan ||
        null
    });
  }

  /*
    Keep the five featured leagues available.
  */
  for (
    const [
      key,
      config
    ] of Object.entries(
      FEATURED_COMPETITIONS
    )
  ) {
    const exists =
      result.some(
        (item) =>
          item.code ===
          config.code
      );

    if (!exists) {
      result.push({
        key,
        code: config.code,
        name: config.name,
        shortName:
          config.shortName,
        country:
          config.country,
        areaCode: "",
        type: "LEAGUE",
        emblem: null,
        plan: null
      });
    }
  }

  /*
    Featured leagues first,
    everything else alphabetically.
  */
  const featuredOrder =
    Object.keys(
      FEATURED_COMPETITIONS
    );

  result.sort((a, b) => {
    const aIndex =
      featuredOrder.indexOf(
        a.key
      );

    const bIndex =
      featuredOrder.indexOf(
        b.key
      );

    const aFeatured =
      aIndex !== -1;

    const bFeatured =
      bIndex !== -1;

    if (
      aFeatured &&
      bFeatured
    ) {
      return aIndex - bIndex;
    }

    if (aFeatured) {
      return -1;
    }

    if (bFeatured) {
      return 1;
    }

    return a.name.localeCompare(
      b.name
    );
  });

  return result;
}

/*
  ------------------------------------------------------------
  TEAM HELPERS
  ------------------------------------------------------------
*/

function simplifyTeam(team) {
  if (!team) {
    return null;
  }

  return {
    id: team.id,

    name:
      team.name ||
      "Unknown team",

    shortName:
      team.shortName ||
      team.name ||
      "Unknown",

    tla:
      team.tla ||
      "",

    crest:
      team.crest ||
      team.crestURI ||
      null,

    website:
      team.website ||
      null,

    venue:
      team.venue ||
      null,

    founded:
      team.founded ||
      null,

    area: team.area
      ? {
          id:
            team.area.id ||
            null,

          name:
            team.area.name ||
            "",

          code:
            team.area.code ||
            ""
        }
      : null
  };
}

function simplifyScore(score) {
  if (!score) {
    return {
      winner: null,

      duration: null,

      fullTime: {
        home: null,
        away: null
      },

      halfTime: {
        home: null,
        away: null
      }
    };
  }

  return {
    winner:
      score.winner ||
      null,

    duration:
      score.duration ||
      null,

    fullTime: {
      home:
        score.fullTime?.home ??
        null,

      away:
        score.fullTime?.away ??
        null
    },

    halfTime: {
      home:
        score.halfTime?.home ??
        null,

      away:
        score.halfTime?.away ??
        null
    }
  };
}

function simplifyMatch(match) {
  return {
    id: match.id,

    utcDate:
      match.utcDate ||
      match.date ||
      null,

    status:
      match.status ||
      null,

    minute:
      match.minute ??
      null,

    injuryTime:
      match.injuryTime ??
      null,

    matchday:
      match.matchday ??
      null,

    stage:
      match.stage ||
      null,

    group:
      match.group ||
      null,

    competition:
      match.competition
        ? {
            id:
              match.competition.id,

            name:
              match.competition.name,

            code:
              match.competition.code,

            emblem:
              match.competition
                .emblem ||
              null
          }
        : null,

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
      )
  };
}

/*
  ------------------------------------------------------------
  STANDINGS
  ------------------------------------------------------------
*/

function simplifyStandingRow(
  row
) {
  return {
    position:
      row.position,

    team:
      simplifyTeam(
        row.team
      ),

    playedGames:
      row.playedGames ??
      0,

    won:
      row.won ??
      0,

    draw:
      row.draw ??
      0,

    lost:
      row.lost ??
      0,

    points:
      row.points ??
      0,

    goalsFor:
      row.goalsFor ??
      0,

    goalsAgainst:
      row.goalsAgainst ??
      0,

    goalDifference:
      row.goalDifference ??
      0
  };
}

function simplifyStandings(
  data
) {
  const output = {
    TOTAL: [],
    HOME: [],
    AWAY: []
  };

  const standings =
    Array.isArray(
      data?.standings
    )
      ? data.standings
      : [];

  for (
    const section of standings
  ) {
    const type =
      section.type;

    if (
      type !== "TOTAL" &&
      type !== "HOME" &&
      type !== "AWAY"
    ) {
      continue;
    }

    if (
      !Array.isArray(
        section.table
      )
    ) {
      continue;
    }

    output[type] =
      section.table.map(
        simplifyStandingRow
      );
  }

  return output;
}

/*
  ------------------------------------------------------------
  LEAGUE DATA
  ------------------------------------------------------------
*/

async function getLeagueData(
  env,
  league
) {
  const competition =
    await resolveCompetition(
      env,
      league
    );

  const today =
    getTodayString();

  const dateFrom =
    addDays(
      today,
      -30
    );

  const dateTo =
    addDays(
      today,
      30
    );

  const matchesPath =
    `/competitions/${encodeURIComponent(
      competition.code
    )}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`;

  const standingsPath =
    `/competitions/${encodeURIComponent(
      competition.code
    )}/standings`;

  const [
    matchesData,
    standingsData
  ] = await Promise.all([
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

  const matches =
    Array.isArray(
      matchesData?.matches
    )
      ? matchesData.matches
      : [];

  const simplifiedMatches =
    matches.map(
      simplifyMatch
    );

  const liveStatuses =
    new Set([
      "IN_PLAY",
      "LIVE",
      "PAUSED",
      "SUSPENDED"
    ]);

  const finishedStatuses =
    new Set([
      "FINISHED"
    ]);

  const cancelledStatuses =
    new Set([
      "POSTPONED",
      "CANCELLED",
      "SUSPENDED"
    ]);

  const live =
    simplifiedMatches
      .filter((match) =>
        liveStatuses.has(
          match.status
        )
      )
      .sort(
        (a, b) =>
          new Date(
            a.utcDate
          ) -
          new Date(
            b.utcDate
          )
      );

  const results =
    simplifiedMatches
      .filter((match) =>
        finishedStatuses.has(
          match.status
        )
      )
      .sort(
        (a, b) =>
          new Date(
            b.utcDate
          ) -
          new Date(
            a.utcDate
          )
      );

  const upcoming =
    simplifiedMatches
      .filter(
        (match) =>
          !liveStatuses.has(
            match.status
          ) &&
          !finishedStatuses.has(
            match.status
          ) &&
          !cancelledStatuses.has(
            match.status
          )
      )
      .sort(
        (a, b) =>
          new Date(
            a.utcDate
          ) -
          new Date(
            b.utcDate
          )
      );

  return {
    league:
      competition.key,

    code:
      competition.code,

    competition: {
      key:
        competition.key,

      code:
        competition.code,

      name:
        competition.name,

      shortName:
        competition.shortName,

      country:
        competition.country,

      emblem:
        competition.emblem ||
        null
    },

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
        results.slice(
          0,
          20
        )
    },

    upcoming: {
      count:
        upcoming.length,

      matches:
        upcoming.slice(
          0,
          20
        )
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
    `league-data:${normaliseKey(
      league
    )}`;

  if (
    inFlight.has(key)
  ) {
    return inFlight.get(
      key
    );
  }

  const promise =
    getLeagueData(
      env,
      league
    ).finally(() => {
      inFlight.delete(
        key
      );
    });

  inFlight.set(
    key,
    promise
  );

  return promise;
}

/*
  ------------------------------------------------------------
  API: COMPETITIONS
  ------------------------------------------------------------
*/

async function handleCompetitions(
  env
) {
  const competitions =
    await getAvailableCompetitions(
      env
    );

  return jsonResponse({
    count:
      competitions.length,

    featured:
      Object.keys(
        FEATURED_COMPETITIONS
      ),

    competitions
  });
}

/*
  ------------------------------------------------------------
  API: LEAGUE DATA
  ------------------------------------------------------------
*/

async function handleLeagueData(
  env,
  request
) {
  const url =
    new URL(
      request.url
    );

  const league =
    url.searchParams.get(
      "league"
    );

  if (!league) {
    return jsonResponse(
      {
        error:
          "Missing league parameter."
      },
      400
    );
  }

  const data =
    await getLeagueDataCached(
      env,
      league
    );

  return jsonResponse(
    data
  );
}

/*
  ------------------------------------------------------------
  API: STANDINGS
  ------------------------------------------------------------
*/

async function handleStandings(
  env,
  request
) {
  const url =
    new URL(
      request.url
    );

  const league =
    url.searchParams.get(
      "league"
    );

  if (!league) {
    return jsonResponse(
      {
        error:
          "Missing league parameter."
      },
      400
    );
  }

  const competition =
    await resolveCompetition(
      env,
      league
    );

  const data =
    await footballDataJson(
      env,
      `/competitions/${encodeURIComponent(
        competition.code
      )}/standings`,
      CACHE_TTL.standings
    );

  return jsonResponse({
    league:
      competition.key,

    code:
      competition.code,

    competition: {
      key:
        competition.key,

      code:
        competition.code,

      name:
        competition.name
    },

    standings:
      simplifyStandings(
        data
      )
  });
}

/*
  ------------------------------------------------------------
  API: TEAMS
  ------------------------------------------------------------
*/

async function handleTeams(
  env,
  request
) {
  const url =
    new URL(
      request.url
    );

  const league =
    url.searchParams.get(
      "league"
    );

  if (!league) {
    return jsonResponse(
      {
        error:
          "Missing league parameter."
      },
      400
    );
  }

  const competition =
    await resolveCompetition(
      env,
      league
    );

  const data =
    await footballDataJson(
      env,
      `/competitions/${encodeURIComponent(
        competition.code
      )}/teams`,
      CACHE_TTL.team
    );

  const teams =
    Array.isArray(
      data?.teams
    )
      ? data.teams.map(
          simplifyTeam
        )
      : [];

  return jsonResponse({
    league:
      competition.key,

    code:
      competition.code,

    competition: {
      key:
        competition.key,

      code:
        competition.code,

      name:
        competition.name
    },

    teams
  });
}

/*
  ------------------------------------------------------------
  API: SINGLE TEAM
  ------------------------------------------------------------
*/

async function handleTeam(
  env,
  request
) {
  const url =
    new URL(
      request.url
    );

  const teamId =
    url.searchParams.get(
      "teamId"
    );

  if (!teamId) {
    return jsonResponse(
      {
        error:
          "Missing teamId parameter."
      },
      400
    );
  }

  const data =
    await footballDataJson(
      env,
      `/teams/${encodeURIComponent(
        teamId
      )}`,
      CACHE_TTL.team
    );

  return jsonResponse({
    team:
      simplifyTeam(
        data
      )
  });
}

/*
  ------------------------------------------------------------
  API: TEAM MATCHES
  ------------------------------------------------------------
*/

async function handleTeamMatches(
  env,
  request
) {
  const url =
    new URL(
      request.url
    );

  const teamId =
    url.searchParams.get(
      "teamId"
    );

  const league =
    url.searchParams.get(
      "league"
    );

  if (!teamId) {
    return jsonResponse(
      {
        error:
          "Missing teamId parameter."
      },
      400
    );
  }

  const competition =
    league
      ? await resolveCompetition(
          env,
          league
        )
      : null;

  const today =
    getTodayString();

  const dateFrom =
    addDays(
      today,
      -90
    );

  const dateTo =
    addDays(
      today,
      90
    );

  let path =
    `/teams/${encodeURIComponent(
      teamId
    )}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}&limit=100`;

  if (competition) {
    path +=
      `&competitions=${encodeURIComponent(
        competition.code
      )}`;
  }

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
      ? data.matches.map(
          simplifyMatch
        )
      : [];

  return jsonResponse({
    teamId:
      Number(teamId),

    league:
      competition?.key ||
      null,

    code:
      competition?.code ||
      null,

    matches
  });
}

/*
  ------------------------------------------------------------
  API: TEAM SCORERS
  ------------------------------------------------------------
*/

async function handleTeamScorers(
  env,
  request
) {
  const url =
    new URL(
      request.url
    );

  const teamId =
    url.searchParams.get(
      "teamId"
    );

  const league =
    url.searchParams.get(
      "league"
    );

  if (!teamId) {
    return jsonResponse(
      {
        error:
          "Missing teamId parameter."
      },
      400
    );
  }

  if (!league) {
    return jsonResponse({
      teamId:
        Number(teamId),

      scorers: []
    });
  }

  const competition =
    await resolveCompetition(
      env,
      league
    );

  const data =
    await footballDataJson(
      env,
      `/competitions/${encodeURIComponent(
        competition.code
      )}/scorers?limit=100`,
      CACHE_TTL.teamScorers
    );

  const scorers =
    Array.isArray(
      data?.scorers
    )
      ? data.scorers
          .filter(
            (item) =>
              Number(
                item.team?.id
              ) ===
              Number(teamId)
          )
          .map(
            (item) => ({
              player: {
                id:
                  item.player
                    ?.id ||
                  null,

                name:
                  item.player
                    ?.name ||
                  "Unknown player"
              },

              team:
                simplifyTeam(
                  item.team
                ),

              goals:
                item.goals ??
                0,

              assists:
                item.assists ??
                0,

              penalties:
                item.penalties ??
                0
            })
          )
      : [];

  return jsonResponse({
    teamId:
      Number(teamId),

    league:
      competition.key,

    code:
      competition.code,

    scorers
  });
}

/*
  ------------------------------------------------------------
  API: LEAGUE TOP SCORERS
  ------------------------------------------------------------
*/

async function handleScorers(
  env,
  request
) {
  const url =
    new URL(
      request.url
    );

  const league =
    url.searchParams.get(
      "league"
    );

  if (!league) {
    return jsonResponse(
      {
        error:
          "Missing league parameter."
      },
      400
    );
  }

  const competition =
    await resolveCompetition(
      env,
      league
    );

  const data =
    await footballDataJson(
      env,
      `/competitions/${encodeURIComponent(
        competition.code
      )}/scorers?limit=20`,
      CACHE_TTL.teamScorers
    );

  const scorers =
    Array.isArray(
      data?.scorers
    )
      ? data.scorers.map(
          (item) => ({
            player: {
              id:
                item.player
                  ?.id ||
                null,

              name:
                item.player
                  ?.name ||
                "Unknown player"
            },

            team:
              simplifyTeam(
                item.team
              ),

            goals:
              item.goals ??
              0,

            assists:
              item.assists ??
              0,

            penalties:
              item.penalties ??
              0
          })
        )
      : [];

  return jsonResponse({
    league:
      competition.key,

    code:
      competition.code,

    competition: {
      key:
        competition.key,

      code:
        competition.code,

      name:
        competition.name
    },

    scorers
  });
}

/*
  ------------------------------------------------------------
  API: MATCH
  ------------------------------------------------------------
*/

async function handleMatch(
  env,
  request
) {
  const url =
    new URL(
      request.url
    );

  const matchId =
    url.searchParams.get(
      "matchId"
    );

  if (!matchId) {
    return jsonResponse(
      {
        error:
          "Missing matchId parameter."
      },
      400
    );
  }

  const data =
    await footballDataJson(
      env,
      `/matches/${encodeURIComponent(
        matchId
      )}`,
      CACHE_TTL.match,
      {
        "X-Unfold-Goals":
          "true",

        "X-Unfold-Bookings":
          "true"
      }
    );

  return jsonResponse({
    match:
      simplifyMatch(
        data
      )
  });
}

/*
  ------------------------------------------------------------
  API TEST
  ------------------------------------------------------------
*/

async function handleTest(
  env
) {
  const data =
    await footballDataJson(
      env,
      "/competitions/PL",
      300
    );

  return jsonResponse({
    ok: true,

    message:
      "football-data.org connection is working.",

    competition: {
      id:
        data.id,

      name:
        data.name,

      code:
        data.code,

      area:
        data.area?.name ||
        ""
    }
  });
}

/*
  ------------------------------------------------------------
  ERROR HANDLING
  ------------------------------------------------------------
*/

function friendlyError(
  error
) {
  const message =
    error?.message ||
    "Unknown error";

  if (
    message.includes(
      "403"
    )
  ) {
    return {
      message:
        "This competition or resource is not available on the current football-data.org plan."
    };
  }

  if (
    message.includes(
      "429"
    )
  ) {
    return {
      message:
        "football-data.org rate limit reached. Please wait a moment and try again."
    };
  }

  return {
    message
  };
}

/*
  ------------------------------------------------------------
  STATIC ASSETS
  ------------------------------------------------------------
*/

async function serveAsset(
  env,
  request
) {
  return env.ASSETS.fetch(
    request
  );
}

/*
  ------------------------------------------------------------
  MAIN WORKER
  ------------------------------------------------------------
*/

export default {
  async fetch(
    request,
    env
  ) {
    const url =
      new URL(
        request.url
      );

    try {
      if (
        url.pathname ===
        "/api/test-football-data"
      ) {
        return await handleTest(
          env
        );
      }

      if (
        url.pathname ===
        "/api/competitions"
      ) {
        return await handleCompetitions(
          env
        );
      }

      if (
        url.pathname ===
        "/api/league-data"
      ) {
        return await handleLeagueData(
          env,
          request
        );
      }

      if (
        url.pathname ===
        "/api/standings"
      ) {
        return await handleStandings(
          env,
          request
        );
      }

      if (
        url.pathname ===
        "/api/teams"
      ) {
        return await handleTeams(
          env,
          request
        );
      }

      if (
        url.pathname ===
        "/api/team"
      ) {
        return await handleTeam(
          env,
          request
        );
      }

      if (
        url.pathname ===
        "/api/team-matches"
      ) {
        return await handleTeamMatches(
          env,
          request
        );
      }

      if (
        url.pathname ===
        "/api/team-scorers"
      ) {
        return await handleTeamScorers(
          env,
          request
        );
      }

      if (
        url.pathname ===
        "/api/scorers"
      ) {
        return await handleScorers(
          env,
          request
        );
      }

      if (
        url.pathname ===
        "/api/match"
      ) {
        return await handleMatch(
          env,
          request
        );
      }

      /*
        Compatibility endpoints
      */

      if (
        url.pathname ===
        "/api/live-scores"
      ) {
        return await handleLeagueData(
          env,
          request
        );
      }

      if (
        url.pathname ===
        "/api/results"
      ) {
        return await handleLeagueData(
          env,
          request
        );
      }

      if (
        url.pathname ===
        "/api/upcoming"
      ) {
        return await handleLeagueData(
          env,
          request
        );
      }

      return await serveAsset(
        env,
        request
      );

    } catch (error) {
      console.error(
        error
      );

      const friendly =
        friendlyError(
          error
        );

      return jsonResponse(
        {
          error:
            friendly.message
        },

        error?.status >= 400 &&
        error?.status < 600
          ? error.status
          : 500
      );
    }
  }
};
