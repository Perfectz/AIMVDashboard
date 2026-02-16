# UI Module Map

Practical ownership map for all frontend files. All pages use vanilla HTML/CSS/JS with zero framework dependencies.

---

## Pages (8)

| Page | Script | Purpose |
|------|--------|---------|
| `home.html` | `app.js` | Project dashboard and high-level status |
| `step1.html` | `app.js` | Theme and concept input (auto-save) |
| `step2.html` | `app.js` | Music upload and AI analysis (auto-save) |
| `step3.html` | `app.js` | Content blueprint: shot list, canon, transcript (auto-save) |
| `step4.html` | `app.js` | Reference images for characters/locations |
| `index.html` | `app.js` | Step 5: shot review, generation, prompts |
| `storyboard.html` | `storyboard.js` | Visual storyboard, sequence, readiness |
| `guide.html` | `ui-layer.js` | Production guide reference |

All pages load `ui-layer.js` for shared navigation, project selector, and stats.

---

## Main Page Scripts (3)

### `ui/app.js` (~2,023 lines)

Runs across Step 1-5 pages. Owns:
- Shot list selection/filtering/search
- Prompt viewer and variation switching
- SeedDream frame generation and save flows
- Continuity toggle and render slots
- Generation history/retry/details
- Agent run panel, OAuth, SSE, revert
- Auto-save initialization for Step 1-3

### `ui/storyboard.js`

Owns storyboard grid/timeline, readiness bars, sequence reorder, manifest filters.

### `ui/ui-layer.js`

Shared nav, stats, project selector, list rendering, and declarative mount system. Loaded by every page.

---

## Extracted Modules (`ui/modules/`) — 11 files

| Module | Global | Responsibility |
|--------|--------|---------------|
| `state.js` | `AppState` | Global key-value state store |
| `shared-utils.js` | `SharedUtils` | Canonical utilities: `el()`, `escapeHtml()`, `getProjectId()`, `showToast()`, `dismissToast()`, `showLoading()`, `hideLoading()`, `copyText()`, `downloadJson()`, `renderContextDrawer()`, `bundleToMarkdown()` |
| `auto-save.js` | `AutoSave` | Debounced auto-save (800ms) for text fields on Step 1-3 |
| `canon-editor.js` | `CanonEditor` | Canon tab navigation and collapsible sections |
| `prompt-viewer.js` | `PromptViewer` | Prompt display and platform switching |
| `generation-workflow.js` | `GenerationWorkflow` | Generation jobs, preflight, history, SSE |
| `agent-integration.js` | `AgentIntegration` | Agent run panel, OAuth, SSE, revert |
| `reference-manager.js` | `ReferenceManager` | Character/location reference CRUD UI |
| `pipeline.js` | `Pipeline` | Pipeline action buttons and status display |
| `page-chat.js` | `PageChat` | Page copilot chat shell and message rendering |
| `page-chat-adapters.js` | `PageChatAdapters` | Page-specific bridge adapters for chat context |

**Rule:** All modules use `SharedUtils` for `el()`, `escapeHtml()`, `getProjectId()`. No local copies.

---

## Service Layer (`ui/services/`) — 10 files

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

**Rule:** New API calls go in `ui/services/*`. Legacy direct `fetch()` in `app.js` is tracked via `docs/architecture/fetch-allowlist.json`.

---

## Domain Layer (`ui/domain/`) — 3 files

| Module | Responsibility |
|--------|---------------|
| `content-domain.js` | Content type/format validation |
| `reference-upload-domain.js` | Upload payload validation |
| `upload-domain.js` | Upload constraints and size limits |

---

## Feature Layer (`ui/features/`) — 3 files

| Feature | Composes |
|---------|----------|
| `content-feature.js` | `content-domain` + `content-service` |
| `project-feature.js` | `project-service` |
| `reference-feature.js` | `reference-upload-domain` + `reference-upload-service` |

These compose domain + service rules for reusable workflows.

---

## DI Container (`ui/controllers/app-deps.js`)

`window.AppDeps.createAppDeps()` provides lazy-initialized service factories:

- `getReferenceUploadService()`
- `getContentService()`
- `getProjectService()`
- `getReferenceFeature()`
- `getContentFeature()`
- `getProjectFeature()`

---

## State Management

Global state: `ui/modules/state.js` → `window.AppState`

`app.js` builds scoped views on top of `AppState`:

1. `projectState` — current project, project list
2. `promptsState` — loaded prompts, current shot/variation/tool
3. `generationState` — generation jobs, preflight status
4. `agentState` — agent run lifecycle, OAuth
5. `reviewState` — review metadata

---

## Auto-Save System

`window.AutoSave.attach(textarea, options)` with two save paths:
- `type: 'content'` → saves via `/api/save/:contentType`
- `type: 'canon'` → saves via `/api/save/canon/:canonType`

Status indicator: idle → "Saving..." → "Saved" (fades) → or "Save failed".

Active on Step 1-3 pages. No manual Save buttons.

---

## Step 5 Key Feature Areas

1. **Shot selection/filter**: `renderShotList`, `selectShot`, `getFilteredShots`
2. **Prompt rendering**: `renderPrompt`, `renderPromptSections`
3. **Continuity/renders**: `loadShotRenders`, frame upload/delete flows
4. **Generation**: preflight, async job run, preview modal, quick accept
5. **Generation history**: list/details/retry/cancel
6. **Agent runs**: OAuth status, run panel, SSE updates, revert

---

## Where to Change What

1. **Add/modify endpoint** → `ui/services/*` first, then call from page script
2. **Add shot generation UX** → `ui/index.html` + `ui/styles.css` + `ui/app.js`
3. **Add shared nav/stat component** → `ui/ui-layer.js`
4. **Add reusable validation** → `ui/domain/*`
5. **Add canonical utility** → `ui/modules/shared-utils.js` (update exports)
6. **Add page chat feature** → `ui/modules/page-chat.js` + `ui/services/page-chat-service.js`

---

## Common Failure Points

1. Missing DOM IDs after HTML changes.
2. `AppState` keys missing from defaults.
3. Route response shape drift not reflected in UI parsing.
4. Modal/button listeners added before elements exist.
5. Duplicate utility functions (always use `SharedUtils`).

## Debug Checklist

1. Open browser console — verify no `ReferenceError`.
2. Verify `project` query param is passed in API requests.
3. Confirm `loadShotRenders` and preflight both succeed for Step 5.
4. Inspect generation job history and SSE events for stuck states.
5. Check `SharedUtils.getProjectId()` returns expected value.
