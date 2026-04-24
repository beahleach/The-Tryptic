# The Tryptic

![Status: Beta](https://img.shields.io/badge/status-beta-7c3aed)

The Tryptic is a triangular cryptic-style word puzzle game. Solve three clues around a triangle, use hints or reveals when needed, and work your way toward a clean solve.

## Play

The latest public build is available here:

https://beahleach.github.io/The-Tryptic/

The GitHub Pages site is the public player build.

**Playtester note:** The public app includes five sample puzzles in the Settings menu. Open `Settings`, then choose `Load preset (playtest)` to try the bundled playtest set.

Repo-native How to Play:

[HOW_TO_PLAY.md](HOW_TO_PLAY.md)

The app is currently in beta, so puzzle content, layout, and support tooling may still change.

## Run Locally

From the project folder:

```sh
./RUN
```

`RUN` installs dependencies if needed, starts the local app, and opens it in your default browser.

Manual equivalent:

```sh
npm install
npm run dev
```

## Development

```sh
npm run dev
npm run dev:client
npm run dev:server
npm run build
npm run proof:playtester
```

- `npm run dev` starts the full local dev stack: Vite plus the local backend API.
- `npm run dev:client` starts only the Vite frontend.
- `npm run dev:server` starts only the local backend API.
- `npm run build` creates a static production build in `dist/`.
- `npm run proof:playtester` verifies the app can build and run from a temporary copy without the local `Puzzles/` folder.

## Puzzle Data

The public app ships with bundled puzzle data and five bundled playtest presets, so the deployed player does not depend on local `.try` files on disk.

Local `.try` files are still supported for maintainer testing and authoring workflows.

## Deployment

GitHub Pages deploys automatically from `.github/workflows/deploy-pages.yml`.

Every push to `main` runs:

```sh
npm ci
npm run build
```

and publishes the resulting `dist/` folder to GitHub Pages.

## Maintainer Notes

If you are only playing or playtesting, you do not need local secrets, Render setup, or the authoring API.

Maintainer-only scripts:

```sh
npm run publish:triangle-debuts
npm run publish:app
```

- `npm run publish:triangle-debuts` publishes the current preset and debut config to GitHub `main`.
- `npm run publish:app` builds the current workspace, commits it if needed, and pushes the current app state to GitHub `main`.

For authenticated local publishing or hosted authoring, copy `.env.example` to `.env.local` and set the values you need:

- `VITE_API_BASE_URL`
- `TRYPTIC_GITHUB_TOKEN`
- `TRYPTIC_GITHUB_REPO`
- `TRYPTIC_GITHUB_BRANCH`
- `TRYPTIC_ADMIN_PASSWORD`
- `TRYPTIC_SESSION_SECRET`
- `TRYPTIC_ALLOWED_ORIGINS`

The repo includes a starter Render config in `render.yaml` for the authoring API. GitHub repository secrets and variables are also used for hosted deploy and alert workflows.
