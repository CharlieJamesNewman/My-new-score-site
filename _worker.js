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

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}

async function footballDataRequest(path, env) {
  if (!env.FootballDataToken) {
    return jsonResponse(
      {
        error: "FootballDataToken secret is missing."
      },
      500
    );
  }

  const response = await fetch(`${DATA_API}${path}`, {
    headers: {
      "X-Auth-Token": env.FootballDataToken
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
    return jsonResponse(
      {
        error: "football-data.org request failed.",
        api: data
      },
      response.status
    );
  }

  return jsonResponse(data);
}

function getLeague(url) {
  const leagueKey = url.searchParams.get("league") || "premier";
  return LEAGUES[leagueKey] || null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    /*
      --------------------------------------------------
      FOOTBALL API ROUTES
      --------------------------------------------------
    */

    if (url.pathname.startsWith("/api/")) {
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

      /*
        LIVE SCORES

        football-data.org supports LIVE / IN_PLAY / PAUSED
        match statuses.
      */
      if (url.pathname === "/api/live-scores") {
        const path =
          `/competitions/${league.code}/matches` +
          `?status=LIVE`;

        return footballDataRequest(path, env);
      }

      /*
        UPCOMING MATCHES

        Gets upcoming matches from the current season.
      */
      if (url.pathname === "/api/upcoming") {
        const today = new Date();

        const from = today.toISOString().slice(0, 10);

        const futureDate = new Date(today);
        futureDate.setDate(futureDate.getDate() + 30);

        const to = futureDate.toISOString().slice(0, 10);

        const path =
          `/competitions/${league.code}/matches` +
          `?dateFrom=${from}` +
          `&dateTo=${to}`;

        return footballDataRequest(path, env);
      }

      /*
        RECENT RESULTS

        Gets matches from the previous 30 days.
      */
      if (url.pathname === "/api/results") {
        const today = new Date();

        const to = today.toISOString().slice(0, 10);

        const pastDate = new Date(today);
        pastDate.setDate(pastDate.getDate() - 30);

        const from = pastDate.toISOString().slice(0, 10);

        const path =
          `/competitions/${league.code}/matches` +
          `?dateFrom=${from}` +
          `&dateTo=${to}` +
          `&status=FINISHED`;

        return footballDataRequest(path, env);
      }

      /*
        LEAGUE TABLE
      */
      if (url.pathname === "/api/standings") {
        const path =
          `/competitions/${league.code}/standings`;

        return footballDataRequest(path, env);
      }

      /*
        COMPETITION INFORMATION

        Useful for getting the current season,
        current matchday, league name, etc.
      */
      if (url.pathname === "/api/competition") {
        const path =
          `/competitions/${league.code}`;

        return footballDataRequest(path, env);
      }

      return jsonResponse(
        {
          error: "Unknown API endpoint.",
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
      through to the website's static assets.
    */

    return env.ASSETS.fetch(request);
  }
};
