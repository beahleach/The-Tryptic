# The Tryptic

![Status: Beta](https://img.shields.io/badge/status-beta-7c3aed)

The Tryptic is a triangular cryptic-style word puzzle game. Solve three clues around a triangle, use hints or reveals when needed, and switch into the editor to load or shape new `.try` puzzles.

## Play

The latest GitHub Pages build is published here:

https://beahleach.github.io/The-Tryptic/

The deployed GitHub Pages app is player-only. Editor mode is intentionally limited to local runs on your own machine via `file:`, `localhost`, `127.0.0.1`, or `::1`.

Repo-native How to Play:

[HOW_TO_PLAY.md](HOW_TO_PLAY.md)

The app is currently in beta, so layout, puzzle content, and editor tools may still change.

## Run Locally

From the project folder:

```sh
./RUN
```

`RUN` installs dependencies if needed, starts Vite, and opens the app in your default browser.

Manual equivalent:

```sh
npm install
npm run dev
```

`npm run dev` now starts both the Vite frontend and the local backend API, which is required for preset publishing, debut scheduling, and automatic config pushes.

## Development

```sh
npm run dev
npm run dev:client
npm run dev:server
npm run build
npm run proof:playtester
npm run publish:triangle-debuts
npm run publish:app
```

- `npm run dev` starts the full local dev stack: Vite plus the local backend API.
- `npm run dev:client` starts only the Vite frontend.
- `npm run dev:server` starts only the local backend API.
- `npm run build` creates a static production build in `dist/`.
- `npm run proof:playtester` verifies the app can build and run from a temporary copy without the local `Puzzles/` folder.
- `npm run publish:triangle-debuts` publishes the current preset/debut JSON config to GitHub `main`.
- `npm run publish:app` builds the current workspace, commits it if needed, and pushes the full app state to GitHub `main`.

## Puzzle Data

The beta play puzzles and template layouts are embedded in `src/bundledPuzzles.js`, so the public app and local run script do not require the full local puzzle library.

Local puzzle files can still be loaded and saved as `.try` files from the editor.

## Deployment

GitHub Pages deploys automatically from `.github/workflows/deploy-pages.yml`.

Every push to `main` runs:

```sh
npm ci
npm run build
```

and publishes the resulting `dist/` folder to GitHub Pages.

For publish targeting, copy [.env.example](/Users/leahbeach/Documents/The%20Tryptic/.env.example) to `.env.local` and fill in any local overrides you want.

Always-on debut email alerts are handled by [.github/workflows/triangle-debut-alerts.yml](/Users/leahbeach/Documents/The%20Tryptic/.github/workflows/triangle-debut-alerts.yml:1). Add these GitHub repository secrets so alerts can run even when your laptop is closed:

- `ALERT_EMAIL_SMTP_SERVER`
- `ALERT_EMAIL_SMTP_PORT`
- `ALERT_EMAIL_SMTP_USERNAME`
- `ALERT_EMAIL_SMTP_PASSWORD`
- `ALERT_EMAIL_FROM`

That workflow emails `thetryptic@gmail.com` when a debut is scheduled, updated, deleted, goes live, or falls back to Triangle 1.
