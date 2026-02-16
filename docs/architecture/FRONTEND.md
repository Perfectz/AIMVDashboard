# Frontend Architecture

## Primary Page Scripts

1. `ui/app.js` (~2,023 lines) — multi-step app orchestration (Step 1-5 views).
2. `ui/storyboard.js` — storyboard-specific page logic.
3. `ui/ui-layer.js` — reusable nav/stats/list/modal primitives.

## Pages

| Page | Script | Purpose |
|------|--------|---------|
| `home.html` | `app.js` | Project dashboard and high-level status |
| `step1.html` | `app.js` | Theme and concept input |
| `step2.html` | `app.js` | Music upload and AI analysis |
| `step3.html` | `app.js` | Content blueprint (shot list, canon, transcript) |
| `step4.html` | `app.js` | Reference images for characters/locations |
| `index.html` | `app.js` | Step 5: shot review, generation, prompts |
| `storyboard.html` | `storyboard.js` | Visual storyboard, sequence, readiness |
| `guide.html` | `ui-layer.js` | Production guide reference |

All pages load `ui-layer.js` for shared navigation, project selector, and stats.

## Layering Model

```
┌─────────────────────────────────────────┐
│  UI Layer (pages, DOM events, render)   │   app.js, storyboard.js, ui-layer.js
├─────────────────────────────────────────┤
│  Modules (extracted feature areas)      │   ui/modules/*.js
├─────────────────────────────────────────┤
│  Features (use-case orchestration)      │   ui/features/*.js
├─────────────────────────────────────────┤
│  Domain (validation, pure rules)        │   ui/domain/*.js
├─────────────────────────────────────────┤
│  Services (HTTP transport adapters)     │   ui/services/*.js
├─────────────────────────────────────────┤
│  Controllers (DI wiring)               │   ui/controllers/app-deps.js
└─────────────────────────────────────────┘
```

## State Management

Global state manager: `ui/modules/state.js` -> `window.AppState`

`app.js` builds scoped views on top of `AppState`:

1. `projectState`
2. `promptsState`
3. `generationState`
4. `agentState`
5. `reviewState`

## Shared Utilities (`ui/modules/shared-utils.js`)

`window.SharedUtils` provides canonical implementations of:

1. `el(id)` — DOM element lookup (used by all modules).
2. `escapeHtml(str)` — HTML escaping.
3. `getProjectId()` — unified project ID resolution (AppState -> selector -> localStorage -> 'default').
4. `showToast()` / `dismissToast()` — notification system.
5. `copyText()` — clipboard operations.
6. `showLoading()` / `hideLoading()` — loading overlays.
7. `downloadJson()` — JSON file download.
8. `renderContextDrawer()` / `bundleToMarkdown()` — context preview rendering.

**Rule**: All modules use `SharedUtils` for these utilities. No local copies.

## Auto-Save System (`ui/modules/auto-save.js`)

Text fields on Step 1-3 auto-save with 800ms debounce. No manual Save buttons.

`window.AutoSave.attach(textarea, options)` supports two save paths:
- `type: 'content'` — saves via `/api/save/:contentType`
- `type: 'canon'` — saves via `/api/save/canon/:canonType`

Status indicator shows: idle -> "Saving..." -> "Saved" (fades) or "Save failed".

## Extracted Modules (`ui/modules/`)

| Module | Responsibility |
|--------|---------------|
| `state.js` | Global `AppState` key-value store |
| `shared-utils.js` | Canonical utility functions |
| `auto-save.js` | Debounced auto-save for text fields |
| `canon-editor.js` | Canon tab navigation and collapsible sections |
| `prompt-viewer.js` | Prompt display and platform switching |
| `generation-workflow.js` | Generation jobs, preflight, history, SSE |
| `agent-integration.js` | Agent run panel, OAuth, SSE, revert |
| `reference-manager.js` | Character/location reference CRUD UI |
| `pipeline.js` | Pipeline action buttons and status display |
| `page-chat.js` | Page copilot chat shell and message rendering |
| `page-chat-adapters.js` | Page-specific bridge adapters for chat |

## Service Layer (`ui/services/`)

All HTTP calls to the backend should go through service modules:

| Service | API Coverage |
|---------|-------------|
| `http-client.js` | Normalized request wrapper |
| `service-base.js` | Shared dependency/HTTP resolution |
| `content-service.js` | `/api/save/*`, `/api/load/*` |
| `project-service.js` | `/api/projects` |
| `review-service.js` | `/api/review/*`, `/api/storyboard/*` |
| `reference-upload-service.js` | `/api/upload/reference-image`, `/api/upload/shot-render` |
| `reference-library-service.js` | `/api/references/*`, `/api/add-*`, `/api/delete/*` |
| `storyboard-upload-service.js` | Shot upload APIs |
| `storyboard-page-service.js` | Storyboard-specific API wrappers |
| `page-chat-service.js` | `/api/page-chat/*` |

**Rule**: New API calls go in `ui/services/*`. Legacy direct `fetch()` in `app.js` is tracked via `docs/architecture/fetch-allowlist.json`.

## DI Container (`ui/controllers/app-deps.js`)

`window.AppDeps.createAppDeps()` provides lazy-initialized service factories:

- `getReferenceUploadService()`
- `getContentService()`
- `getProjectService()`
- `getReferenceFeature()`
- `getContentFeature()`
- `getProjectFeature()`

## Step 5 (Shots) Responsibilities

`ui/index.html` + `ui/app.js` handle:

1. Shot selection/filtering/search.
2. Prompt load and variation switching.
3. SeedDream frame generation and save flows.
4. Continuity toggle and render slots.
5. Generation history/retry/details.
6. Preflight readiness display.

## Testing Strategy

1. Unit tests for domain/service logic: `node --test tests/unit/*.test.js` (26 tests).
2. Playwright specs for cross-module Step 5 behavior: `npm run test:ui`.
3. Health script: `npm run health` (route boot + endpoint stability).

## Extension Guidelines

1. Add validation in domain files first.
2. Add endpoint calls in service files.
3. Keep page files focused on rendering and event wiring.
4. Use `AppState` keys for shared mutable state.
5. Use `SharedUtils` for common utilities — never duplicate `el()`, `escapeHtml()`, or `getProjectId()`.
