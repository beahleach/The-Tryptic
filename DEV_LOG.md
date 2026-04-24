# The Tryptic Dev Log

This log is assembled from the available Tryptic Codex context, repository history,
and current project files. It is meant to preserve the decisions, milestones, and
maintenance shape of the project as a living record.

## Project Snapshot

The Tryptic is a triangular cryptic-style word puzzle game. The player solves
three clues around a triangle, with each side reading left to right or top to
bottom depending on orientation. The current public build is a beta player hosted
on GitHub Pages, with a local and hosted authoring workflow for puzzle presets,
triangle debut schedules, and publishing support.

Public player:

https://beahleach.github.io/The-Tryptic/

Current stack:

- React 19
- Vite 7
- Tailwind 4
- Node 22 in CI
- GitHub Pages for the public player
- Render-ready Node API for hosted authoring
- GitHub Actions for deploys and debut notifications

## Timeline

### Playtest App Foundation

The early public-facing work focused on turning the triangle puzzle prototype
into something playtestable outside the local machine.

- Prepared the playtest app and made the Vite build work on GitHub Pages.
- Set the Pages base path correctly for `/The-Tryptic/`.
- Added a `RUN` helper so local startup can be a one-command path.
- Refreshed the README around beta status and the public play link.
- Defaulted the beta app to light mode for a friendlier first load.

### How To Play Became First-Class

The project then gained a clearer teaching layer for players who are new to the
triangle format or cryptic-style clue mechanics.

- Added an interactive How to Play route at `?view=how-to-play`.
- Added a repo-native `HOW_TO_PLAY.md` so the rules are readable outside the app.
- Synced How to Play language between markdown and the app.
- Added direct deep-link startup for the How to Play page.
- Clarified clue anatomy: wordplay, fodder, and definition.
- Documented scoring: tri-star, gold star, hint markers, and reveal markers.
- Documented navigation: arrow keys, typing, clicking squares, and clue boxes.

### Public Player Versus Editor Boundaries

As the app became public, a recurring design theme was separating player-safe
features from maintainer-only authoring tools.

- Limited editor mode to local owner-style runs.
- Kept editor mode separate from publishing authentication.
- Added visible publishing/auth status cues for maintainers.
- Exposed player-appropriate settings in the public build.
- Aligned settings behavior between local and public player modes.

### Bundled Puzzle And Preset Work

The public player needed to work without a local `Puzzles/` folder, while still
supporting maintainer workflows that use local `.try` files.

- Bundled puzzle data into the deployed app.
- Added five sample/playtest presets available from Settings.
- Added a public Settings path: `Settings` -> `Load preset (playtest)`.
- Kept local `.try` file support for authoring and maintainer testing.
- Added `npm run proof:playtester` to verify the app can build and run from a
  temporary playtester package without the local `Puzzles/` directory.

### Debut Scheduling And Publishing

The project grew from static playtest presets into a scheduled public puzzle
pipeline.

- Added `src/puzzlePresets.json` as the public preset config.
- Added `src/triangleDebuts.json` as the debut schedule.
- Added scripts to publish presets and triangle debut schedule changes.
- Added automatic publishing hooks through the backend authoring API.
- Added live debut selection in the app, with fallback to the default public
  preset when no scheduled debut is active.
- Persisted live puzzle state across reloads so public players do not lose
  progress when the active source is stable.

The public schedule language now describes a tri-weekly Monday/Wednesday/Friday
debut cadence planned for April 27, 2026 onward.

### Alerts And Monitoring

The schedule work added a lightweight operational layer so changes and live
transitions do not disappear silently.

- Added GitHub Actions email alerts for triangle debut schedule changes.
- Added preset change alerts.
- Added live-or-fallback alerts when the active public puzzle changes.
- Added `.github/triangle-debut-monitor.json` to track the last active debut.
- Configured the Pages deploy workflow to ignore monitor-only commits so alert
  bookkeeping does not redeploy the player.

### Hosted Authoring API

The backend grew from local helper endpoints into hosted-authoring groundwork.

- Added a Node HTTP API for preferences, presets, triangle debuts, and auth.
- Added local `.env` loading.
- Added password-based authoring sessions with signed cookies.
- Added CORS and secure cookie handling for hosted/cross-site authoring.
- Added GitHub-backed publishing from the API for preset and debut changes.
- Added `render.yaml` so the authoring API has a deployment shape.

### Deployment And Maintenance

The repo now has a few clear maintainer workflows:

- `npm run dev` starts the local frontend and backend together.
- `npm run dev:client` starts only Vite.
- `npm run dev:server` starts only the backend API.
- `npm run build` creates the static player build.
- `npm run publish:triangle-debuts` publishes puzzle preset and debut config.
- `npm run publish:app` builds, commits, and pushes the current app state.
- GitHub Pages deploys automatically on pushes to `main`.

## Design Notes

The Tryptic has stayed centered on the puzzle itself rather than a marketing
shell. The first screen is the game, not a landing page. UI work has mostly
served three goals:

- Make the triangular board readable and playable.
- Help players learn cryptic clue structure through progressive hints.
- Keep maintainer tools accessible without leaking editor controls into the
  public player experience.

The clue hint model is especially important. Hints identify wordplay, fodder,
and definition, then show those roles inside clue boxes with color and underline
treatment. Hover text gives extra explanation without permanently cluttering the
solve surface.

## Current State

Before this log file was added, `main` was clean and aligned with `origin/main`.

The app is in beta. Public play and playtesting are supported. Authoring and
publishing workflows exist, but are still maintainer-oriented and depend on the
right environment variables, GitHub credentials, and hosted API configuration.

The most recent repo work focused on:

- Tri-weekly schedule messaging.
- Puzzle preset updates.
- Triangle debut schedule updates.
- Monitor state updates.
- README and bundled preset cleanup.
- Persistence for live puzzle progress.

## Watch List

- Keep README, in-app How to Play, and `HOW_TO_PLAY.md` synchronized.
- When schedule language changes, update both player UI and docs.
- Treat `src/puzzlePresets.json` and `src/triangleDebuts.json` as public config,
  not scratch files.
- Keep public Settings useful for players, but do not expose maintainer-only
  editing in public builds.
- Re-run `npm run proof:playtester` after changing bundled puzzle or preset
  loading behavior.
- Watch GitHub Actions after debut schedule edits; monitor-state commits are
  expected, but player deploys should come only from player-relevant changes.

## Next Useful Entries

Future dev log entries should include:

- Date.
- Goal.
- Files or systems touched.
- Player-facing impact.
- Maintainer impact.
- Verification run.
- Any deploy or alert result.

Template:

```md
## YYYY-MM-DD - Short Title

Goal:

Changes:

Player impact:

Maintainer impact:

Verification:

Follow-ups:
```
