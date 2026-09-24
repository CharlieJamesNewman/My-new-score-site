const SPORTMONKS_API =
  "https://api.sportmonks.com/v3/football";

const CACHE_TTL = {
  competitions: 21600,
  competition: 21600,
  leagueData: 60,
  standings: 300,
  match: 120,
  team: 3600,
  teamMatches: 120,
  teamScorers: 300,
  teamSearch: 300
};

const inFlight = new Map();


/* =========================================================
   BASIC HELPERS
   ========================================================= */

function jsonResponse(
  data,
  status = 200,
  extraHeaders = {}
) {
  return new Response(
    JSON.stringify(data),
    {
      status,

      headers: {
        "Content-Type":
          "application/json; charset=utf-8",

        "Cache-Control":
          "no-store",

        ...extraHeaders
      }
    }
  );
}


function getToken(env) {

  const token =
    env.footballScoresToken;

  if (!token) {
    throw new Error(
      "footballScoresToken is not configured."
    );
  }

  return String(token).trim();
}


function getTodayString() {

  return new Date()
    .toISOString()
    .slice(0, 10);

}


function addDays(
  dateString,
  days
) {

  const date =
    new Date(
      `${dateString}T00:00:00Z`
    );

  date.setUTCDate(
    date.getUTCDate() + days
  );

  return date
    .toISOString()
    .slice(0, 10);

}


function slugify(
  value
) {

  return String(
    value || ""
  )

    .toLowerCase()

    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )

    .replace(
      /[^a-z0-9]+/g,
      "-"
    )

    .replace(
      /^-+|-+$/g,
      "");

}


/* =========================================================
   SPORTMONKS REQUEST
   ========================================================= */

async function sportmonksRequest(
  env,
  path,
  cacheTtl = 300
) {

  const token =
    getToken(env);

  const cache =
    caches.default;


  /*
    The cache key deliberately does NOT
    contain the API token.
  */

  const cacheUrl =
    `https://score-dash-cache.local${path}`;

  const cacheRequest =
    new Request(
      cacheUrl,
      {
        method: "GET"
      }
    );


  const cached =
    await cache.match(
      cacheRequest
    );


  if (cached) {
    return cached;
  }


  const url =
    `${SPORTMONKS_API}${path}`;


  const response =
    await fetch(
      url,
      {
        method: "GET",

        headers: {
          "Authorization":
            token,

          "Accept":
            "application/json"
        }
      }
    );


  const body =
    await response.arrayBuffer();


  if (!response.ok) {

    let details = "";

    try {

      details =
        new TextDecoder()
          .decode(body);

    } catch {

      details =
        `HTTP ${response.status}`;

    }


    return new Response(
      JSON.stringify({
        error:
          "Sportmonks request failed.",

        status:
          response.status,

        details
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
    new Headers(
      response.headers
    );


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


async function sportmonksJson(
  env,
  path,
  cacheTtl = 300
) {

  const response =
    await sportmonksRequest(
      env,
      path,
      cacheTtl
    );


  const text =
    await response.text();


  let data;


  try {

    data =
      JSON.parse(text);

  } catch {

    throw new Error(
      "Sportmonks returned invalid JSON."
    );

  }


  if (!response.ok) {

    throw new Error(
      data?.message ||
      data?.error ||
      `Sportmonks returned HTTP ${response.status}.`
    );

  }


  return data;

}


/* =========================================================
   PAGINATION
   ========================================================= */

async function sportmonksPaginated(
  env,
  path,
  cacheTtl = 300,
  maxPages = 20
) {

  const all = [];


  for (
    let page = 1;
    page <= maxPages;
    page++
  ) {

    const separator =
      path.includes("?")
        ? "&"
        : "?";


    const pagePath =
      `${path}${separator}page=${page}`;


    const data =
      await sportmonksJson(
        env,
        pagePath,
        cacheTtl
      );


    const rows =
      Array.isArray(
        data?.data
      )
        ? data.data
        : [];


    all.push(
      ...rows
    );


    const hasMore =
      Boolean(
        data?.meta?.pagination?.has_more
      );


    if (
      !hasMore ||
      rows.length === 0
    ) {

      break;

    }

  }


  return all;

}


/* =========================================================
   TEAM SIMPLIFICATION
   ========================================================= */

function simplifyTeam(
  team
) {

  if (!team) {
    return null;
  }


  return {

    id:
      team.id ??
      null,

    name:
      team.name ??
      "",

    shortName:
      team.short_code ??
      team.name ??
      "",

    tla:
      team.short_code ??
      "",

    crest:
      team.image_path ??
      "",

    venue:
      team.venue?.name ??
      "",

    founded:
      team.founded ??
      null

  };

}


/* =========================================================
   SCORE SIMPLIFICATION
   ========================================================= */

function simplifyScores(
  scores
) {

  const result = {
    home: null,
    away: null
  };


  if (
    !Array.isArray(
      scores
    )
  ) {

    return result;

  }


  for (
    const item of scores
  ) {

    if (
      String(
        item?.description ||
        ""
      ).toUpperCase() !==
      "CURRENT"
    ) {

      continue;

    }


    const participant =
      String(
        item?.score?.participant ||
        ""
      ).toLowerCase();


    const goals =
      item?.score?.goals;


    if (
      participant === "home" &&
      typeof goals ===
        "number"
    ) {

      result.home =
        goals;

    }


    if (
      participant === "away" &&
      typeof goals ===
        "number"
    ) {

      result.away =
        goals;

    }

  }


  return result;

}


/* =========================================================
   STATE
   ========================================================= */

function getStateName(
  fixture
) {

  return String(
    fixture?.state?.short_name ||
    fixture?.state?.developer_name ||
    fixture?.state?.name ||
    ""
  ).toUpperCase();

}


function isFinished(
  fixture
) {

  const state =
    getStateName(
      fixture
    );


  return (
    state === "FT" ||
    state === "AET" ||
    state === "PEN" ||
    state === "FINISHED"
  );

}


function isLive(
  fixture
) {

  const state =
    getStateName(
      fixture
    );


  return (
    state.includes("LIVE") ||
    state === "HT" ||
    state === "1H" ||
    state === "2H" ||
    state === "ET" ||
    state === "P"
  );

}


/* =========================================================
   FIXTURE SIMPLIFICATION
   ========================================================= */

function simplifyFixture(
  fixture
) {

  const participants =
    Array.isArray(
      fixture?.participants
    )
      ? fixture.participants
      : [];


  let home =
    participants.find(
      team =>
        String(
          team?.meta?.location ||
          ""
        ).toLowerCase() ===
        "home"
    );


  let away =
    participants.find(
      team =>
        String(
          team?.meta?.location ||
          ""
        ).toLowerCase() ===
        "away"
    );


  /*
    Fallback if meta.location is not
    included for some reason.
  */

  if (
    !home &&
    participants.length >= 1
  ) {

    home =
      participants[0];

  }


  if (
    !away &&
    participants.length >= 2
  ) {

    away =
      participants[1];

  }


  const score =
    simplifyScores(
      fixture?.scores
    );


  const state =
    getStateName(
      fixture
    );


  return {

    id:
      fixture?.id ??
      null,

    utcDate:
      fixture?.starting_at
        ? new Date(
            fixture.starting_at
          ).toISOString()
        : null,

    status:
      isFinished(
        fixture
      )
        ? "FINISHED"

        : isLive(
            fixture
          )
            ? "LIVE"

            : "SCHEDULED",

    state:
      state,

    minute:
      fixture?.periods?.find?.(
        period =>
          period?.started_at
      )?.minutes ??
      null,

    homeTeam:
      simplifyTeam(
        home
      ),

    awayTeam:
      simplifyTeam(
        away
      ),

    score: {

      winner:
        null,

      duration:
        null,

      fullTime: {

        home:
          score.home,

        away:
          score.away

      },

      halfTime: {

        home:
          null,

        away:
          null

      }

    },

    competition:
      fixture?.league
        ? {

            id:
              fixture.league.id ??
              null,

            name:
              fixture.league.name ??
              "",

            code:
              fixture.league.short_code ??
              ""

          }

        : null,

    round:
      fixture?.round
        ? {

            id:
              fixture.round.id ??
              null,

            name:
              fixture.round.name ??
              ""

          }

        : null,

    resultInfo:
      fixture?.result_info ??
      "",

    events:
      Array.isArray(
        fixture?.events
      )
        ? fixture.events
        : []

  };

}


/* =========================================================
   EVENT SIMPLIFICATION
   ========================================================= */

function simplifyEvents(
  events
) {

  if (
    !Array.isArray(
      events
    )
  ) {

    return {
      goals: [],
      bookings: []
    };

  }


  const goals = [];
  const bookings = [];


  for (
    const event of events
  ) {

    const typeText =
      String(
        event?.type?.developer_name ||
        event?.type?.name ||
        event?.sub_type?.name ||
        ""
      ).toUpperCase();


    const minute =
      event?.minute ??
      event?.period?.minutes ??
      null;


    const playerName =
      event?.player?.name ??
      "";


    const relatedPlayer =
      event?.relatedPlayer?.name ??
      "";


    const participant =
      event?.participant_id ??
      null;


    if (
      typeText.includes(
        "GOAL"
      )
    ) {

      goals.push({

        minute,

        player:
          playerName,

        assist:
          relatedPlayer,

        participantId:
          participant

      });

    }


    if (
      typeText.includes(
        "CARD"
      ) ||
      typeText.includes(
        "YELLOW"
      ) ||
      typeText.includes(
        "RED"
      )
    ) {

      bookings.push({

        minute,

        player:
          playerName,

        card:
          typeText.includes(
            "RED"
          )
            ? "RED"
            : "YELLOW",

        participantId:
          participant

      });

    }

  }


  return {
    goals,
    bookings
  };

}


/* =========================================================
   LEAGUE LOOKUP
   ========================================================= */

async function getLeague(
  env,
  leagueId
) {

  const id =
    Number(
      leagueId
    );


  if (
    !Number.isFinite(id)
  ) {

    throw new Error(
      "A valid Sportmonks league ID is required."
    );

  }


  const data =
    await sportmonksJson(
      env,

      `/leagues/${id}?include=currentSeason;country`,

      CACHE_TTL.competition
    );


  return data?.data ||
    null;

}


/* =========================================================
   COMPETITIONS
   ========================================================= */

async function handleCompetitions(
  env
) {

  try {

    const leagues =
      await sportmonksPaginated(
        env,

        `/leagues?include=country&per_page=50`,

        CACHE_TTL.competitions,

        20
      );


    const competitions =
      leagues

        .filter(
          league =>
            league &&
            league.id
        )

        .map(
          league => ({

            id:
              league.id,

            name:
              league.name ||
              "Competition",

            slug:
              slugify(
                league.name
              ),

            shortCode:
              league.short_code ||
              "",

            country:
              league.country?.name ||
              "",

            countryId:
              league.country_id ??
              null,

            image:
              league.image_path ||
              "",

            active:
              league.active !== false,

            type:
              league.type ||
              "",

            subType:
              league.sub_type ||
              ""

          })
        )

        .sort(
          (a,b) =>
            `${a.country} ${a.name}`
              .localeCompare(
                `${b.country} ${b.name}`
              )
        );


    return jsonResponse({

      count:
        competitions.length,

      competitions

    },

    200,

    {
      "Cache-Control":
        `public, max-age=${CACHE_TTL.competitions}, stale-while-revalidate=3600`
    });

  }

  catch (error) {

    console.error(
      "competitions error:",
      error
    );


    return jsonResponse(
      {

        error:
          "Unable to load competitions.",

        message:
          error?.message ||
          String(error)

      },

      502
    );

  }

}


/* =========================================================
   STANDINGS HELPERS
   ========================================================= */

function detailText(
  detail
) {

  return String(

    detail?.type?.developer_name ||

    detail?.type?.code ||

    detail?.type?.name ||

    ""

  ).toUpperCase();

}


function getStandingValue(
  row,
  keywords
) {

  const details =
    Array.isArray(
      row?.details
    )
      ? row.details
      : [];


  for (
    const detail of details
  ) {

    const text =
      detailText(
        detail
      );


    if (
      keywords.some(
        keyword =>
          text.includes(
            keyword
          )
      )
    ) {

      const value =
        Number(
          detail?.value
        );


      if (
        Number.isFinite(
          value
        )
      ) {

        return value;

      }

    }

  }


  return 0;

}


function simplifyStanding(
  row
) {

  const participant =
    row?.participant;


  return {

    position:
      row?.position ??
      null,

    team:
      simplifyTeam(
        participant
      ),

    playedGames:
      getStandingValue(
        row,
        [
          "MATCHES",
          "PLAYED"
        ]
      ),

    form:
      row?.form ||
      "",

    won:
      getStandingValue(
        row,
        [
          "WON"
        ]
      ),

    draw:
      getStandingValue(
        row,
        [
          "DRAW"
        ]
      ),

    lost:
      getStandingValue(
        row,
        [
          "LOST"
        ]
      ),

    points:
      Number(
        row?.points ??
        0
      ),

    goalsFor:
      getStandingValue(
        row,
        [
          "GOALS_FOR",
          "GOALS SCORED",
          "GOALS_SCORED"
        ]
      ),

    goalsAgainst:
      getStandingValue(
        row,
        [
          "GOALS_AGAINST",
          "GOALS CONCEDED",
          "GOALS_CONCEDED"
        ]
      ),

    goalDifference:
      getStandingValue(
        row,
        [
          "GOAL_DIFFERENCE",
          "GOAL DIFFERENCE",
          "GOAL_DIFF"
        ]
      )

  };

}


/* =========================================================
   STANDINGS
   ========================================================= */

async function getStandings(
  env,
  seasonId
) {

  if (
    !seasonId
  ) {

    return [];

  }


  const data =
    await sportmonksJson(

      env,

      `/standings/seasons/${encodeURIComponent(
        seasonId
      )}?include=participant;details.type&per_page=50`,

      CACHE_TTL.standings

    );


  const rows =
    Array.isArray(
      data?.data
    )
      ? data.data
      : [];


  return rows
    .map(
      simplifyStanding
    )

    .sort(
      (a,b) =>
        Number(
          a.position ||
          999
        ) -
        Number(
          b.position ||
          999
        )
    );

}


/* =========================================================
   LEAGUE DATA
   ========================================================= */

async function getLeagueData(
  env,
  leagueId
) {

  const league =
    await getLeague(
      env,
      leagueId
    );


  if (!league) {

    throw new Error(
      "Sportmonks did not return the requested league."
    );

  }


  const season =
    league?.currentSeason ||
    league?.currentseason ||
    league?.currentSeason?.data ||
    null;


  const seasonId =
    season?.id ??
    null;


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


  const fixturePath =
    `/fixtures/between/${dateFrom}/${dateTo}` +
    `?filters=fixtureLeagues:${encodeURIComponent(
      leagueId
    )}` +
    `&include=participants;scores;state;league;round;events` +
    `&per_page=50`;


  const livePath =
    `/livescores/inplay` +
    `?filters=fixtureLeagues:${encodeURIComponent(
      leagueId
    )}` +
    `&include=participants;scores;state;league;round;events`;


  const [
    fixturesResult,
    liveResult,
    standingsResult
  ] =
    await Promise.allSettled([

      sportmonksPaginated(
        env,
        fixturePath,
        CACHE_TTL.leagueData,
        10
      ),

      sportmonksJson(
        env,
        livePath,
        CACHE_TTL.live ||
        30
      ),

      getStandings(
        env,
        seasonId
      )

    ]);


  const rawFixtures =
    fixturesResult.status ===
      "fulfilled"

      ? fixturesResult.value

      : [];


  const rawLive =
    liveResult.status ===
      "fulfilled"

      ? (
          Array.isArray(
            liveResult.value?.data
          )
            ? liveResult.value.data
            : []
        )

      : [];


  const standings =
    standingsResult.status ===
      "fulfilled"

      ? standingsResult.value

      : [];


  const fixtures =
    rawFixtures.map(
      fixture =>
        simplifyFixture(
          fixture
        )
    );


  const liveFromApi =
    rawLive.map(
      fixture =>
        simplifyFixture(
          fixture
        )
    );


  const liveMap =
    new Map();


  for (
    const match of
      liveFromApi
  ) {

    liveMap.set(
      String(
        match.id
      ),
      match
    );

  }


  /*
    Some plans / fixtures may not return
    exactly the same live feed. Add any
    live-looking fixtures from the date
    range as a fallback.
  */

  for (
    const match of
      fixtures
  ) {

    if (
      match.status ===
      "LIVE"
    ) {

      liveMap.set(
        String(
          match.id
        ),
        match
      );

    }

  }


  const live =
    Array.from(
      liveMap.values()
    );


  const liveIds =
    new Set(
      live.map(
        match =>
          String(
            match.id
          )
      )
    );


  const results =
    fixtures

      .filter(
        match =>
          match.status ===
            "FINISHED" &&
          !liveIds.has(
            String(
              match.id
            )
          )
      )

      .sort(
        (a,b) =>
          new Date(
            b.utcDate
          ) -
          new Date(
            a.utcDate
          )
      );


  const upcoming =
    fixtures

      .filter(
        match => {

          if (
            liveIds.has(
              String(
                match.id
              )
            )
          ) {

            return false;

          }


          if (
            match.status !==
            "SCHEDULED"
          ) {

            return false;

          }


          return (
            new Date(
              match.utcDate
            ).getTime() >=
            Date.now()
          );

        }
      )

      .sort(
        (a,b) =>
          new Date(
            a.utcDate
          ) -
          new Date(
            b.utcDate
          )
      );


  const total =
    standings;


  return {

    league: {

      id:
        league.id,

      name:
        league.name ||
        "",

      slug:
        slugify(
          league.name
        ),

      country:
        league.country?.name ||
        "",

      image:
        league.image_path ||
        "",

      season: {

        id:
          seasonId,

        name:
          season?.name ||
          ""

      }

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
        results

    },

    upcoming: {

      count:
        upcoming.length,

      matches:
        upcoming

    },

    standings: {

      TOTAL:
        total,

      HOME:
        total,

      AWAY:
        total

    }

  };

}


/* =========================================================
   LEAGUE DATA ENDPOINT
   ========================================================= */

async function handleLeagueData(
  env,
  leagueId
) {

  if (
    !leagueId
  ) {

    return jsonResponse(
      {
        error:
          "League ID is required."
      },
      400
    );

  }


  const key =
    String(
      leagueId
    );


  if (
    inFlight.has(
      `league-${key}`
    )
  ) {

    try {

      return jsonResponse(
        await inFlight.get(
          `league-${key}`
        )
      );

    } catch {

      /*
        The original request will handle
        the error.
      */

    }

  }


  const promise =
    getLeagueData(
      env,
      key
    );


  inFlight.set(
    `league-${key}`,
    promise
  );


  try {

    const data =
      await promise;


    return jsonResponse(
      data,
      200,
      {
        "Cache-Control":
          `public, max-age=${CACHE_TTL.leagueData}, stale-while-revalidate=30`
      }
    );

  }

  catch (error) {

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

  finally {

    inFlight.delete(
      `league-${key}`
    );

  }

}


/* =========================================================
   STANDINGS ENDPOINT
   ========================================================= */

async function handleStandings(
  env,
  leagueId
) {

  try {

    const league =
      await getLeague(
        env,
        leagueId
      );


    const season =
      league?.currentSeason ||
      league?.currentseason ||
      null;


    const rows =
      await getStandings(
        env,
        season?.id
      );


    return jsonResponse({

      league:
        league?.id ??
        Number(
          leagueId
        ),

      season:
        season?.id ??
        null,

      standings: {

        TOTAL:
          rows,

        HOME:
          rows,

        AWAY:
          rows

      }

    });

  }

  catch (error) {

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
   LIVE SCORES
   ========================================================= */

async function handleLiveScores(
  env,
  leagueId
) {

  try {

    const data =
      await sportmonksJson(

        env,

        `/livescores/inplay` +
        `?filters=fixtureLeagues:${encodeURIComponent(
          leagueId
        )}` +
        `&include=participants;scores;state;league;round;events`,

        30

      );


    const matches =
      Array.isArray(
        data?.data
      )
        ? data.data.map(
            simplifyFixture
          )
        : [];


    return jsonResponse({

      league:
        Number(
          leagueId
        ),

      count:
        matches.length,

      matches

    });

  }

  catch (error) {

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
   MATCH
   ========================================================= */

async function handleMatch(
  env,
  matchId
) {

  if (
    !matchId
  ) {

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
      await sportmonksJson(

        env,

        `/fixtures/${encodeURIComponent(
          matchId
        )}` +
        `?include=participants;scores;state;league;round;events;events.type;events.player;events.relatedPlayer`,

        CACHE_TTL.match

      );


    const fixture =
      data?.data;


    if (
      !fixture
    ) {

      throw new Error(
        "Match was not found."
      );

    }


    const simplified =
      simplifyFixture(
        fixture
      );


    const eventData =
      simplifyEvents(
        fixture.events
      );


    return jsonResponse({

      ...simplified,

      goals:
        eventData.goals,

      bookings:
        eventData.bookings

    });

  }

  catch (error) {

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

  if (
    !teamId
  ) {

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
      await sportmonksJson(

        env,

        `/teams/${encodeURIComponent(
          teamId
        )}?include=venue;country`,

        CACHE_TTL.team

      );


    const team =
      data?.data;


    if (
      !team
    ) {

      throw new Error(
        "Team was not found."
      );

    }


    return jsonResponse({

      id:
        team.id ??
        null,

      name:
        team.name ??
        "",

      shortName:
        team.short_code ??
        team.name ??
        "",

      tla:
        team.short_code ??
        "",

      crest:
        team.image_path ??
        "",

      venue:
        team.venue?.name ??
        "",

      founded:
        team.founded ??
        null,

      address:
        team.venue?.address ??
        "",

      website:
        "",

      area:
        team.country ??
        null

    });

  }

  catch (error) {

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
   TEAM SEARCH
   ========================================================= */

async function handleTeamSearch(
  env,
  query
) {

  const q =
    String(
      query ||
      ""
    ).trim();


  if (
    q.length < 2
  ) {

    return jsonResponse({

      query:
        q,

      teams:
        []

    });

  }


  try {

    const data =
      await sportmonksJson(

        env,

        `/teams/search/${encodeURIComponent(
          q
        )}` +
        `?per_page=20`,

        CACHE_TTL.teamSearch

      );


    const teams =
      Array.isArray(
        data?.data
      )

        ? data.data
            .map(
              simplifyTeam
            )
            .filter(
              Boolean
            )

        : [];


    return jsonResponse({

      query:
        q,

      teams

    });

  }

  catch (error) {

    return jsonResponse(
      {

        error:
          "Unable to search teams.",

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
  leagueId
) {

  if (
    !teamId
  ) {

    return jsonResponse(
      {
        error:
          "Team ID is required."
      },
      400
    );

  }


  const today =
    getTodayString();


  const dateFrom =
    addDays(
      today,
      -120
    );


  const dateTo =
    addDays(
      today,
      60
    );


  /*
    Sportmonks allows a maximum date range
    of 100 days on this endpoint.

    Therefore split the request into two
    smaller windows.
  */

  const firstFrom =
    addDays(
      today,
      -100
    );


  const firstTo =
    addDays(
      today,
      0
    );


  const secondFrom =
    addDays(
      today,
      1
    );


  const secondTo =
    addDays(
      today,
      60
    );


  try {

    const paths = [

      `/fixtures/between/${firstFrom}/${firstTo}/${encodeURIComponent(
        teamId
      )}` +
      `?include=participants;scores;state;league;round` +
      `&per_page=50`,

      `/fixtures/between/${secondFrom}/${secondTo}/${encodeURIComponent(
        teamId
      )}` +
      `?include=participants;scores;state;league;round` +
      `&per_page=50`

    ];


    const [
      first,
      second
    ] =
      await Promise.all([

        sportmonksPaginated(
          env,
          paths[0],
          CACHE_TTL.teamMatches,
          10
        ),

        sportmonksPaginated(
          env,
          paths[1],
          CACHE_TTL.teamMatches,
          10
        )

      ]);


    let matches =
      [
        ...first,
        ...second
      ];


    /*
      Remove duplicates.
    */

    const unique =
      new Map();


    for (
      const fixture of
        matches
    ) {

      unique.set(
        String(
          fixture.id
        ),
        fixture
      );

    }


    matches =
      Array.from(
        unique.values()
      );


    if (
      leagueId
    ) {

      matches =
        matches.filter(
          fixture =>
            String(
              fixture?.league_id
            ) ===
            String(
              leagueId
            )
        );

    }


    const simplified =
      matches

        .map(
          simplifyFixture
        )

        .sort(
          (a,b) =>
            new Date(
              b.utcDate
            ) -
            new Date(
              a.utcDate
            )
        );


    return jsonResponse({

      teamId:
        String(
          teamId
        ),

      league:
        leagueId
          ? String(
              leagueId
            )
          : null,

      count:
        simplified.length,

      matches:
        simplified

    });

  }

  catch (error) {

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
  leagueId
) {

  if (
    !teamId
  ) {

    return jsonResponse(
      {
        error:
          "Team ID is required."
      },
      400
    );

  }


  try {

    const team =
      await handleTeam(
        env,
        teamId
      );


    /*
      We need the current league season
      to obtain topscorers.
    */

    let seasonId =
      null;


    if (
      leagueId
    ) {

      const league =
        await getLeague(
          env,
          leagueId
        );


      const season =
        league?.currentSeason ||
        league?.currentseason ||
        null;


      seasonId =
        season?.id ??
        null;

    }


    if (
      !seasonId
    ) {

      return jsonResponse({

        teamId:
          String(
            teamId
          ),

        league:
          leagueId
            ? String(
                leagueId
              )
            : null,

        count:
          0,

        scorers:
          []

      });

    }


    const data =
      await sportmonksJson(

        env,

        `/topscorers/seasons/${encodeURIComponent(
          seasonId
        )}` +
        `?include=player;participant;type` +
        `&per_page=50`,

        CACHE_TTL.teamScorers

      );


    const rows =
      Array.isArray(
        data?.data
      )
        ? data.data
        : [];


    const scorers =
      rows

        .filter(
          row =>
            String(
              row?.participant_id
            ) ===
            String(
              teamId
            )
        )

        .map(
          row => ({

            player:
              row?.player
                ? {

                    id:
                      row.player.id ??
                      null,

                    name:
                      row.player.name ??
                      ""

                  }

                : null,

            team:
              row?.participant
                ? simplifyTeam(
                    row.participant
                  )

                : null,

            goals:
              Number(
                row?.total ??
                0
              ),

            assists:
              0,

            penalties:
              0

          })
        );


    return jsonResponse({

      teamId:
        String(
          teamId
        ),

      league:
        leagueId
          ? String(
              leagueId
            )
          : null,

      count:
        scorers.length,

      scorers

    });

  }

  catch (error) {

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
      await sportmonksJson(
        env,
        `/leagues/8`,
        CACHE_TTL.competition
      );


    return jsonResponse({

      success:
        true,

      competition: {

        id:
          data?.data?.id ??
          null,

        name:
          data?.data?.name ??
          null,

        country:
          data?.data?.country_id ??
          null

      }

    });

  }

  catch (error) {

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

  if (
    !env.ASSETS
  ) {

    return new Response(
      "Asset binding not configured.",
      {
        status:
          500
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
        url.searchParams.get(
          "league"
        );


      if (
        pathname.startsWith(
          "/api/"
        )
      ) {


        if (
          pathname ===
          "/api/competitions"
        ) {

          return await
            handleCompetitions(
              env
            );

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
          "/api/match"
        ) {

          const matchId =
            url.searchParams.get(
              "matchId"
            ) ||
            url.searchParams.get(
              "id"
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
          "/api/team-search"
        ) {

          const query =
            url.searchParams.get(
              "q"
            ) ||
            url.searchParams.get(
              "query"
            ) ||
            "";


          return await
            handleTeamSearch(
              env,
              query
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


        if (
          pathname ===
          "/api/test-sportmonks"
        ) {

          return await
            handleTest(
              env
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


      return await
        serveAsset(
          request,
          env
        );

    }

    catch (error) {

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
