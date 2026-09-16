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

async function footballDataRequest(path, env) {
  if (!env.FootballDataToken) {
    return new Response(
      JSON.stringify({
        error: "FootballDataToken secret is missing."
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      }
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

  return new Response(
    JSON.stringify({
      status: response.status,
      success: response.ok,
      data: data
    }),
    {
      status: response.ok ? 200 : response.status,
      headers: {
        "Content-Type": "application/json"
      }
    }
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    /*
      TEMPORARY TEST

      This checks whether Cloudflare can use the
      FootballDataToken secret to access football-data.org.
    */
    if (url.pathname === "/api/test-football-data") {
      return footballDataRequest("/competitions/PL", env);
    }

    return new Response(
      JSON.stringify({
        message: "Worker is running.",
        test: "/api/test-football-data"
      }),
      {
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  }
};
