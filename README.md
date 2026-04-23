# The Tryptic

## Playtester Run Steps

From inside the `The Tryptic` folder:

```sh
./RUN
```

The `RUN` script installs dependencies if `node_modules/` is missing, starts the app, and opens it in your default browser.

You can also run the commands manually:

```sh
npm install
npm run dev
```

Then open the local URL printed by Vite, usually `http://localhost:5173/`.

If the folder already includes `node_modules/`, `npm install` can be skipped. If port `5173` is already busy, Vite will print a different local URL.

## What Playtesters Need

Required files and folders:

- `src/`
- `RUN`
- `index.html`
- `package.json`
- `package-lock.json`
- `vite.config.js`
- `node_modules/`, or internet access to run `npm install`

Not required for playtesting:

- `Puzzles/`
- `dist/`
- `server/`

The five playtest presets and template puzzle layouts are embedded in `src/bundledPuzzles.js`, so the app can run without the local puzzle library.

## Clean Preset State

If a tester has opened an older version of the app at the same URL before, their browser may have local preset overrides saved. For a clean run, use a browser/profile that has not opened the app before, or clear site data for the local app URL.

First-time testers do not need to do anything special.

## Build A Static Copy

To generate a static build:

```sh
npm run build
```

The output goes into `dist/`.

## Proof Script

To verify the playtester package can run without `Puzzles/`:

```sh
npm run proof:playtester
```

The script creates a temporary copy of the playtester files, deliberately omits `Puzzles/`, installs dependencies from `package-lock.json`, builds the app, briefly starts the dev server, and deletes the temporary copy.

## GitHub Pages Auto-Deploy

This repo includes a GitHub Actions workflow at `.github/workflows/deploy-pages.yml`.

After the project is pushed to GitHub, enable Pages in the repository settings:

- Go to `Settings` > `Pages`
- Set `Source` to `GitHub Actions`

After that, every push to `main` will build the app and publish the latest `dist/` output to GitHub Pages.

To connect a local repo to GitHub:

```sh
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```
