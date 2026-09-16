const DATA_API = "https://api.football-data.org/v4";

const LEAGUES = {
  premier: {
    code: "PL",
    name: "Premier League"
  },

  laliga: {
    code: "PD",
    name: "La Liga"
  },

  seriea: {
    code: "SA",
    name: "Serie A"
  },

  bundesliga: {
    code: "BL1",
    name: "Bundesliga"
  },

  ligue1: {
    code: "FL1",
    name: "Ligue 1"
  }
};


/*
  How long Cloudflare should keep each type of
  football data before asking football-data.org again.

  This greatly reduces API requests.
*/

const CACHE_TTL = {

  live: 60,

  standings: 300,

  results: 600,

  upcoming: 600,

  competition: 86400

};


/*
  --------------------------------------------------
  JSON RESPONSE
  --------------------------------------------------
*/

function jsonResponse(
  data,
  status = 200,
  extraHeaders = {}
) {

  const headers = {

    "Content-Type":
      "application/json; charset=utf-8",

    "Access-Control-Allow-Origin":
      "*",

    "Access-Control-Allow-Methods":
      "GET, OPTIONS",

    "Access-Control-Allow-Headers":
      "Content-Type",

    ...extraHeaders

  };

  return new Response(
    JSON.stringify(data),
    {
      status,
      headers
    }
  );

}


/*
  --------------------------------------------------
  FOOTBALL-DATA.ORG REQUEST
  --------------------------------------------------
*/

async function footballDataRequest(
  path,
  env,
  cacheKey,
  ttl,
  ctx
) {

  /*
    Make sure the secret exists.
  */

  if (!env.FootballDataToken) {

    return jsonResponse(
      {
        error:
          "FootballDataToken secret is missing."
      },
      500
    );

  }


  /*
    ------------------------------------------------
    CHECK CLOUDFLARE CACHE FIRST
    ------------------------------------------------

    If the data is already cached, return it
    immediately without contacting football-data.org.
  */

  const cache =
    caches.default;

  const cached =
    await cache.match(cacheKey);

  if (cached) {

    return cached;

  }


  /*
    ------------------------------------------------
    CONTACT FOOTBALL-DATA.ORG
    ------------------------------------------------
  */

  try {

    const response =
      await fetch(
        `${DATA_API}${path}`,
        {
          method: "GET",

          cache: "no-store",

          headers: {

            "X-Auth-Token":
              env.FootballDataToken,

            "Accept":
              "application/json"

          }

        }
      );


    const text =
      await response.text();


    let data;


    try {

      data =
        JSON.parse(text);

    } catch {

      data = {
        raw: text
      };

    }


    /*
      ------------------------------------------------
      API ERROR
      ------------------------------------------------
    */

    if (!response.ok) {

      const headers = {};

      /*
        Tell the browser when the rate limit
        should reset if football-data.org sends
        that information.
      */

      const resetSeconds =
        response.headers.get(
          "X-RequestCounter-Reset"
        );

      if (resetSeconds) {

        headers["Retry-After"] =
          resetSeconds;

      }


      return jsonResponse(
        {
          error:
            "football-data.org request failed.",

          api:
            data

        },
        response.status,
        headers
      );

    }


    /*
      ------------------------------------------------
      SUCCESSFUL RESPONSE
      ------------------------------------------------

      Store the result in Cloudflare's cache.
    */

    const result =
      jsonResponse(
        data,
        200,
        {
          "Cache-Control":
            `public, max-age=${ttl}`
        }
      );


    /*
      Put a copy into the Cloudflare cache.

      waitUntil allows the response to be returned
      without making the user wait for the cache
      write to finish.
    */

    ctx.waitUntil(
      cache.put(
        cacheKey,
        result.clone()
      )
    );


    return result;


  } catch (error) {

    return jsonResponse(
      {
        error:
          "Unable to contact football-data.org.",

        details:
          error.message
      },
      500
    );

  }

}


/*
  --------------------------------------------------
  GET LEAGUE
  --------------------------------------------------
*/

function getLeague(url) {

  const leagueKey =
    url.searchParams.get("league")
    || "premier";


  return (
    LEAGUES[leagueKey]
    || null
  );

}


/*
  --------------------------------------------------
  CACHE KEY
  --------------------------------------------------

  Each league and endpoint gets its own cache entry.

  Example:

  /api/standings?league=premier

  is different from:

  /api/standings?league=laliga
  --------------------------------------------------
*/

function getCacheKey(url) {

  return new Request(
    url.toString(),
    {
      method: "GET"
    }
  );

}


/*
  --------------------------------------------------
  WORKER
  --------------------------------------------------
*/

export default {

  async fetch(
    request,
    env,
    ctx
  ) {

    const url =
      new URL(request.url);


    /*
      ------------------------------------------------
      CORS
      ------------------------------------------------
    */

    if (
      request.method ===
      "OPTIONS"
    ) {

      return new Response(
        null,
        {
          status: 204,

          headers: {

            "Access-Control-Allow-Origin":
              "*",

            "Access-Control-Allow-Methods":
              "GET, OPTIONS",

            "Access-Control-Allow-Headers":
              "Content-Type"

          }

        }
      );

    }


    /*
      ------------------------------------------------
      FOOTBALL API ROUTES
      ------------------------------------------------
    */

    if (
      url.pathname.startsWith(
        "/api/"
      )
    ) {


      const league =
        getLeague(url);


      /*
        Unknown league
      */

      if (!league) {

        return jsonResponse(
          {
            error:
              "Unknown league.",

            availableLeagues:
              Object.keys(
                LEAGUES
              )

          },
          400
        );

      }


      /*
        Create the cache key for
        this exact API request.
      */

      const cacheKey =
        getCacheKey(url);


      /*
        ------------------------------------------------
        LIVE SCORES
        ------------------------------------------------

        football-data.org's LIVE filter covers
        matches currently IN_PLAY or PAUSED.

        Cached for 60 seconds.
      */

      if (
        url.pathname ===
        "/api/live-scores"
      ) {

        const path =
          `/competitions/${league.code}/matches` +
          `?status=LIVE`;


        return footballDataRequest(
          path,
          env,
          cacheKey,
          CACHE_TTL.live,
          ctx
        );

      }


      /*
        ------------------------------------------------
        UPCOMING MATCHES
        ------------------------------------------------
      */

      if (
        url.pathname ===
        "/api/upcoming"
      ) {


        const today =
          new Date();


        const from =
          today
            .toISOString()
            .slice(0, 10);


        const futureDate =
          new Date(today);


        futureDate.setDate(
          futureDate.getDate() + 30
        );


        const to =
          futureDate
            .toISOString()
            .slice(0, 10);


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
        ------------------------------------------------
        RECENT RESULTS
        ------------------------------------------------
      */

      if (
        url.pathname ===
        "/api/results"
      ) {


        const today =
          new Date();


        const to =
          today
            .toISOString()
            .slice(0, 10);


        const pastDate =
          new Date(today);


        pastDate.setDate(
          pastDate.getDate() - 30
        );


        const from =
          pastDate
            .toISOString()
            .slice(0, 10);


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
        ------------------------------------------------
        LEAGUE TABLE
        ------------------------------------------------

        Cached for 5 minutes.

        There is no reason to request the table
        every 60 seconds.
      */

      if (
        url.pathname ===
        "/api/standings"
      ) {


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
        ------------------------------------------------
        COMPETITION INFORMATION
        ------------------------------------------------
      */

      if (
        url.pathname ===
        "/api/competition"
      ) {


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
        ------------------------------------------------
        UNKNOWN API ENDPOINT
        ------------------------------------------------
      */

      return jsonResponse(
        {
          error:
            "Unknown API endpoint.",

          availableEndpoints: [

            "/api/live-scores?league=premier",

            "/api/upcoming?league=premier",

            "/api/results?league=premier",

            "/api/standings?league=premier",

            "/api/competition?league=premier"

          ]

        },
        404
      );

    }


    /*
      --------------------------------------------------
      WEBSITE
      --------------------------------------------------

      Anything that isn't an API request gets passed
      through to your website's static assets.
      --------------------------------------------------
    */

    return env.ASSETS.fetch(
      request
    );

  }

};
