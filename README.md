# AI Music Video Dashboard

A local-first production dashboard for building AI music videos with a structured pipeline.

The app is designed to keep creative output consistent by treating prompts and references as production assets, not ad-hoc text. It combines:

1. A step-based workflow UI (theme -> music -> canon -> references -> shots -> storyboard).
2. A Node.js API server (no framework) for project/file operations.
3. SeedDream shot generation with continuity-aware reference assembly.
4. Optional in-app GitHub-authenticated prompt agents for scoped prompt edits.

## What This Project Is For

Use this project when you want to:

1. Keep a repeatable, auditable workflow for AI music video production.
2. Generate and review shot prompts per variation (A/B/C/D).
3. Manage character/location reference libraries and shot frame references.
4. Generate shot previews through Replicate (SeedDream) and decide what to save.
5. Track storyboard readiness and selected variation continuity across shots.

## Core Principles

1. Structured context first: prompts are compiled from canon + shot intent.
2. Continuity first: shot generation prefers previous-shot continuity and validated refs.
3. Human-in-the-loop: generated previews are reviewed before final save.
4. Local ownership: project files remain local and immediately editable.
5. Additive architecture: new APIs/features are added without breaking older clients.

## Architecture at a Glance

### Server

- Entry point: `scripts/serve_ui.js`
- Router: `scripts/router.js`
- Route modules: `scripts/routes/*.js`
- Domain services: `scripts/services/*.js`
- Shared utilities: `scripts/shared.js`

The server uses vanilla `http` with explicit route registration and a shared route context.

### Frontend

- Main shot page: `ui/index.html` + `ui/app.js`
- Storyboard: `ui/storyboard.html` + `ui/storyboard.js`
- Shared UI layer: `ui/ui-layer.js`
- State module: `ui/modules/state.js`
- Service/domain/feature slices under `ui/services`, `ui/domain`, `ui/features`

### Data Model

Projects are isolated under `projects/<projectId>/`.

Key folders:

- `projects/<id>/prompts/`
- `projects/<id>/reference/`
- `projects/<id>/rendered/shots/`
- `projects/<id>/rendered/storyboard/`
- `projects/<id>/music/`

## Step Workflow

1. Step 1 (`/step1.html`): theme, concept, inspiration, mood, genre.
2. Step 2 (`/step2.html`): music context and analysis artifacts.
3. Step 3 (`/step3.html`): canon/bible files (characters, locations, style, script).
4. Step 4 (`/step4.html`): reference libraries and uploads.
5. Step 5 (`/index.html`): shot prompts, generation, continuity, frame saves.
6. Step 6 (`/storyboard.html`): visual review, sequence, readiness.

## Step 5 (Shots) Flow

Current default flow is hybrid:

1. Select shot + variation.
2. Readiness preflight loads (Replicate, prompt, continuity, refs).
3. Click `Generate First + Last Frame`.
4. Review generated previews.
5. Use `Quick Accept` (batch save first+last) or advanced per-image save.
6. Optionally `Quick Accept + Next Shot` to continue rapidly.

Advanced controls are available behind an expandable panel:

- Generate single ref-based image.
- Auto-upload 14-shot reference set.
- Continuity toggle per shot.
- Replicate key management.
- Agent prompt generation.

## API Highlights

- Generation readiness:
  - `GET /api/shot-generation/preflight`
- Generation jobs:
  - `POST /api/generation-jobs`
  - `GET /api/generation-jobs/:jobId/events` (SSE)
- Shot previews and saves:
  - `POST /api/save-shot-preview`
  - `POST /api/save-shot-previews` (batch quick-accept)

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Start server:

```bash
npm run serve
```

3. Open:

```text
http://localhost:8000
```

4. Validate pipeline health:

```bash
npm run health
npm run test:unit
```

## Pipeline Commands

- Compile prompts: `npm run compile`
- Lint prompts: `npm run lint`
- Rebuild index: `npm run index`

The UI also exposes pipeline controls (`run-all`, status).

## Replicate Key Usage

You can configure Replicate token in three ways:

1. Local-only default token (auto-used when running locally).
2. `.env` key (`REPLICATE_API_TOKEN`) for persistent default outside local fallback.
3. Session key in the Step 5 modal (`Replicate Key`) for current server session.

## Documentation Map

See `docs/README.md` for full architecture and module docs.

Recommended first reads:

1. `docs/workflows/SHOT_FLOW.md`
2. `docs/architecture/SERVER.md`
3. `docs/architecture/FRONTEND.md`
4. `docs/troubleshooting/SHOT_GENERATION.md`

## Tech Constraints

1. Vanilla Node.js server (`http` module).
2. File-based JSON/text storage.
3. No server framework dependency.
4. Browser-side JavaScript without build tooling.

## License

MIT
