# The Tryptic

![Status: Beta](https://img.shields.io/badge/status-beta-7c3aed)

The Tryptic is a triangular cryptic-style word puzzle game. Solve three clues around a triangle, use hints or reveals when needed, and switch into the editor to load or shape new `.try` puzzles.

## Play

The latest GitHub Pages build is published here:

https://beahleach.github.io/The-Tryptic/

Interactive How to Play:

https://beahleach.github.io/The-Tryptic/#how-to-play

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

## Development

```sh
npm run dev
npm run build
npm run proof:playtester
```

- `npm run dev` starts the local Vite server.
- `npm run build` creates a static production build in `dist/`.
- `npm run proof:playtester` verifies the app can build and run from a temporary copy without the local `Puzzles/` folder.

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
