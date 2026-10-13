# SCOREdash

SCOREdash is a Cloudflare Workers site for football scores, fixtures, league
tables, team pages, and scorer data. It uses football-data.org through a
same-origin Worker API, so the provider token is never sent to a browser.

## Production files

- `index.html` — production home page and league, fixture, table, scorer, and
  team-search UI.
- `team.html` — production team detail page.
- `_worker.js` — production Cloudflare Worker and the only code that calls
  football-data.org.
- `wrangler.jsonc` — Worker and static-assets configuration.
- `scoredash-icon.png` — site icon.
- `manifest.webmanifest` and `sw.js` — installable web-app metadata and an
  offline app shell.

`redesign-options.html` is a standalone design exploration and is not linked
from the production site. `badges.js` is also not loaded by the current
production pages; team crest URLs now come from the football-data.org response.

## Installable app experience

SCOREdash is a progressive web app. Supported browsers expose an **Install app**
button on the home page; after installation it launches in its own window and
keeps the basic app shell available offline. Live `/api/*` calls intentionally
remain network-only, so a score is never presented as current when it is not.

The current personalisation layer is local to a visitor's device: following a
team requires no sign-in and never sends preference data to a third party.
Cross-device accounts, notifications, and durable user preferences should only
be added with a real identity provider and a Cloudflare D1 data model.

## Data flow

The browser calls only same-origin `/api/*` routes. `_worker.js` translates
league keys such as `premier` and `laliga` to football-data.org competition
codes, attaches the `X-Auth-Token` header at the server boundary, and returns a
reduced response to the site. The Worker caches provider responses internally;
the browser never receives the provider token.

## Cloudflare setup

1. In the Cloudflare project, set `FootballDataToken` as a Worker secret. Use
   `wrangler secret put FootballDataToken` if deploying through Wrangler.
2. Keep the token out of Git, HTML, JavaScript served to visitors, and build
   variables that are exposed to the client.
3. Deploy the Worker with static assets enabled. `wrangler.jsonc` routes
   `/api/*` through `_worker.js` and serves the other files as static assets.
4. Verify `/api/test-football-data` after deployment. It reports connection
   status without returning the token.

The current Wrangler configuration also declares `FootballScoresWebsite` as a
required secret, but the Worker does not read it. Confirm with the Cloudflare
project owner whether that deployment requirement is still needed before
removing it.

## Validation before review

- Visit the home page and change leagues repeatedly; the heading, fixtures,
  scorers, and table should remain aligned with the latest selection.
- Verify recent results and fixtures around a season boundary. The Worker uses
  a 90-day look-back and look-ahead window.
- Select a team from a fixture, table, or search result and confirm its team
  page uses the expected competition.
- Check the league table at phone width; it is horizontally scrollable rather
  than clipping columns.
