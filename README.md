# The Tryptic

![Status: Beta](https://img.shields.io/badge/status-beta-7c3aed)

The Tryptic is a triangular cryptic-style word puzzle game. Solve three clues around a triangle, use hints or reveals when needed, and work your way toward a clean solve.

## Play

The latest GitHub Pages build is published here:

https://beahleach.github.io/The-Tryptic/

The deployed GitHub Pages app is the public player build.

Repo-native How to Play:

[HOW_TO_PLAY.md](HOW_TO_PLAY.md)

The app is currently in beta, so layout, puzzle content, and support tooling may still change.

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

`npm run dev` starts both the Vite frontend and the local backend API used for local testing and publish tooling.

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
- `npm run publish:triangle-debuts` publishes the current puzzle config to GitHub `main`.
- `npm run publish:app` builds the current workspace, commits it if needed, and pushes the current app state to GitHub `main`.

## Puzzle Data

The beta play puzzles and template layouts are embedded in `src/bundledPuzzles.js`, so the public app and local run script do not require the full local puzzle library.

Local `.try` puzzle files are supported for local testing workflows.

## Deployment

GitHub Pages deploys automatically from `.github/workflows/deploy-pages.yml`.

Every push to `main` runs:

```sh
npm ci
npm run build
```

and publishes the resulting `dist/` folder to GitHub Pages.

For publish targeting, copy `.env.example` to `.env.local` and fill in any local overrides you want.

Always-on debut and preset email alerts are handled by `.github/workflows/triangle-debut-alerts.yml`. Add these GitHub repository secrets so alerts can run even when your laptop is closed:

- `ALERT_EMAIL_SMTP_SERVER`
- `ALERT_EMAIL_SMTP_PORT`
- `ALERT_EMAIL_SMTP_USERNAME`
- `ALERT_EMAIL_SMTP_PASSWORD`
- `ALERT_EMAIL_FROM`

That workflow emails `thetryptic@gmail.com` when a debut or preset update is published, when a debut goes live, and when the public build falls back to Triangle 1.
