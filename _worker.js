export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Allow the browser to make the API request
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // Sportmonks live scores endpoint
    if (url.pathname === "/api/live-scores") {
      if (!env.footballScoresToken) {
        return new Response(
          JSON.stringify({
            error: "footballScoresToken is not configured.",
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }

      try {
        const sportmonksUrl =
          "https://api.sportmonks.com/v3/football/livescores/inplay" +
          "?include=participants;scores;periods;events;league.country;round";

        const response = await fetch(sportmonksUrl, {
          method: "GET",
          headers: {
            "Authorization": env.footballScoresToken,
            "Accept": "application/json",
          },
        });

        const data = await response.json();

        if (!response.ok) {
          return new Response(
            JSON.stringify({
              error: "Sportmonks API error",
              status: response.status,
              details: data,
            }),
            {
              status: response.status,
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders,
              },
            }
          );
        }

        return new Response(JSON.stringify(data), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
            ...corsHeaders,
          },
        });
      } catch (error) {
        return new Response(
          JSON.stringify({
            error: "Unable to contact Sportmonks.",
            details: error.message,
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }
    }

    // Everything else is handled by your normal website assets
    return env.ASSETS.fetch(request);
  },
};
