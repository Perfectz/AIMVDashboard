# UI Layer Architecture

This project now uses a dedicated UI layer on top of a component library.

## Stack

- Component library: `Shoelace` (CDN)
- Reusable layer script: `ui/ui-layer.js`
- Reusable layer styles: `ui/ui-layer.css`
- Base app theme: `ui/styles.css`
- Shared project context helpers: `ui/modules/project-context.js`
- Shared project action binder: `ui/modules/project-actions.js`
- Domain layer (business validation): `ui/domain/*.js`
- Service layer (API access): `ui/services/*.js`
- Feature layer (workflow orchestration): `ui/features/*.js`

## Global Includes

Each UI page (`ui/*.html`) loads:

1. `styles.css`
2. Shoelace dark theme CSS
3. `ui-layer.css`
4. Shoelace autoloader script
5. `modules/project-context.js`
6. `modules/project-actions.js` (pages with project create/delete controls)
7. `ui-layer.js`
8. `window.UILayer.init()`

## Reusable Primitives

`window.UILayer` exposes:

- `init()` - bootstraps shared UI behaviors
- `wireDataNav(root)` - binds navigation for `[data-nav-url]` / `[data-workspace-url]`
- `createStatTile(config)` - reusable stat metric tile
- `renderStatGrid(container, items)` - render a full stats grid
- `createListItem(item)` - reusable list/action row
- `renderList(container, items, emptyItem)` - render list with empty fallback
- `createShotSidebarItem(config)` - reusable shot row for left sidebars
- `renderMetaItems(container, items, className)` - render key/value metadata rows
- `renderNavBrand(root)` - render standardized sidebar brand header by mode
- `renderProjectSelectorSection(root)` - render standardized project selector block
- `renderNavStats(root)` - render standardized sidebar stats block
- `renderNavFooter(root)` - render standardized version/footer block
- `renderWorkflowNavs(root)` - generate workflow nav buttons from declarative mounts
- `renderResourceNavs(root)` - generate resources nav buttons from declarative mounts
- `renderGuideNavs(root)` - generate guide sidebar nav from declarative mount

## Current Adoption

- `ui/home.html` now renders dashboard stats and action lists through `UILayer` functions.
- `ui/app.js` now renders Step 5 shot sidebar rows through `UILayer.createShotSidebarItem`.
- `ui/storyboard.js` now renders shot metadata rows through `UILayer.renderMetaItems`.
- All pages now share the same UI library and layer includes.
- Workflow and resource navigation across `home/index/step1/step2/step3/step4/storyboard` now use declarative mounts:
  - `<div data-ui-workflow-nav ...>`
  - `<div data-ui-resource-nav ...>`
- `ui/guide.html` now uses declarative guide navigation:
  - `<div data-ui-guide-nav ...>`
- Sidebar brand/project/stats blocks are now declarative on app pages:
  - `<div data-ui-nav-brand ...>`
  - `<div data-ui-project-selector ...>`
  - `<div data-ui-nav-stats ...>`
- Sidebar footer/version is now declarative:
  - `<div data-ui-nav-footer ...>`

## Extension Pattern

When adding UI:

1. Put business rules in `ui/domain/*` (pure functions, no DOM/network).
2. Put API calls in `ui/services/*` (no direct DOM manipulation).
3. Put workflow/use-case orchestration in `ui/features/*` (compose domain + services, no direct DOM).
4. Add/update visual primitives in `ui/ui-layer.js`.
5. Consume features from page scripts (`ui/app.js`, `ui/storyboard.js`).
6. For app pages, load dependency composition from `ui/controllers/app-deps.js` before `ui/app.js`.
7. For nav links, prefer declarative mounts over hardcoded buttons.

This keeps styling and behavior centralized so new pages can scale without duplicating component logic.

## Four-Layer Frontend Architecture

The frontend is organized into four layers:

- UI Layer: rendering, reusable visual primitives, and page wiring.
- Feature Layer: workflow orchestration and use-cases.
- Domain Layer: pure business rules and validation.
- API Layer: HTTP/API adapters and server interaction.

Data flow should generally move UI -> Feature -> Domain/API.

## Shared Service Result Contract

New and refactored services use a standardized return shape:

```js
{ ok: boolean, data?: object, error?: string, code?: string, status?: number }
```

This keeps UI handling consistent for retries, toast rendering, and error taxonomy mapping.

## Bootstrap + Runtime Services

App/page startup now prefers one bootstrap service call over scattered startup fetches:

- `ui/services/bootstrap-service.js`
  - `loadBootstrap({ projectId, pageId })`
  - calls `GET /api/app/bootstrap`
  - returns projects, current project, auth status, generation capability, pipeline snapshot, and page defaults

Generation orchestration modules now rely on dedicated services instead of direct network calls:

- `ui/services/generation-jobs-service.js`
- `ui/services/generation-readiness-service.js`
- `ui/services/context-bundle-service.js`
- `ui/services/agent-runtime-service.js`
- `ui/services/pipeline-service.js`
- `ui/services/lint-report-service.js`
- `ui/services/auto-save-service.js`

State transitions for Step 5 shot flow are centralized in:

- `ui/modules/shot-flow-state.js` (`createShotFlowStore`, reducer-style dispatch/events)

## Service/Domain Slice (Implemented)

Storyboard upload flow now uses:

- `ui/domain/upload-domain.js`
  - `validateKlingVideoUpload(input)` for upload validation.
- `ui/services/http-client.js`
  - `createHttpClient()` to centralize JSON request handling.
- `ui/services/storyboard-upload-service.js`
  - `uploadKlingVariation(input)` to call `/api/upload/shot`.

`ui/storyboard.js` now delegates upload logic to this service instead of calling `fetch` directly in the view code.
Additional storyboard page API calls now route through `ui/services/storyboard-page-service.js`.

Prompts/reference upload flow now uses:

- `ui/domain/reference-upload-domain.js`
  - `validateReferenceImageFile(file)`
  - `validateShotRenderUpload(input)`
- `ui/services/reference-upload-service.js`
  - `uploadCharacterReference(input)`
  - `uploadLocationReference(input)`
  - `uploadShotRenderFrame(input)`

`ui/app.js` now routes character, location, and shot-frame image uploads through this service layer.
Feature orchestration for those uploads now lives in `ui/features/reference-feature.js`.

Reference library CRUD now uses:

- `ui/services/reference-library-service.js`
  - `listCharacters(projectId)`
  - `listLocations(projectId)`
  - `addCharacter(projectId, characterName)`
  - `deleteCharacter(projectId, characterName)`
  - `deleteCharacterImage(projectId, characterName, slotNum)`
  - `addLocation(projectId, locationName)`
  - `deleteLocation(projectId, locationName)`
  - `deleteLocationImage(projectId, locationName, slotNum)`

`ui/app.js` now routes character/location listing and add/delete operations through this service layer.

Step 1/2 text content flow now uses:

- `ui/domain/content-domain.js`
  - `validateContentType(contentType)`
  - `validateNonEmptyContent(content)`
  - `validateAnalysisJsonContent(content)`
- `ui/services/content-service.js`
  - `saveContent({ projectId, contentType, content })`
  - `loadContent({ projectId, contentType })`

`ui/app.js` now routes concept/inspiration/mood/genre/suno/song-info/analysis save-load calls through this service layer.

Project + storyboard review flow now uses:

- `ui/services/project-service.js`
  - `listProjects()`
  - `createProject({ name, description })`
- `ui/services/review-service.js`
  - `loadPrevisMap(projectId)`
  - `savePrevisMapEntry({ projectId, shotId, entry })`
  - `resetPrevisMapEntry({ projectId, shotId })`
  - `loadReviewSequence(projectId)`
  - `loadReviewMetadata(projectId)`
  - `saveReviewMetadata({ projectId, payload })`
  - `saveStoryboardSequence({ projectId, payload })`

`ui/app.js` and `ui/storyboard.js` now route project-management/review-metadata calls through services.

Project context and actions are consolidated through shared modules:

- `ui/modules/project-context.js`
  - query/localStorage project resolution
  - project-preserving navigation URL building
- `ui/modules/project-actions.js`
  - shared new/delete project modal wiring for `home`, `index`, and `storyboard`


## AI-Centric Iteration Enhancements

- Task-manifest workflow: `docs/AI_AGENT_WORKFLOW.md`
- Task template: `templates/agent-task.template.json`
- Machine-readable dependency map: `docs/architecture/deps.json`
- Feature scaffolder command:
  - `npm run scaffold:feature -- <feature-name> [--with-domain] [--with-service] [--dry-run] [--force]`

These additions make it easier for AI agents to execute constrained, repeatable changes.
- Architecture guardrail check: `npm run lint:architecture` (enforces service-layer fetch policy with explicit legacy allowlist).
- Style/DOM selector contract: `docs/architecture/STYLE_CONTRACT.md` (IDs/classes/data-attrs JavaScript depends on).

## Test Separation

- Domain/service unit tests (no browser): `tests/unit/*`
  - `tests/unit/reference-feature.test.js`
  - `tests/unit/content-feature.test.js`
  - `tests/unit/project-feature.test.js`
  - `tests/unit/upload-domain.test.js`
  - `tests/unit/storyboard-upload-service.test.js`
  - `tests/unit/reference-upload-domain.test.js`
  - `tests/unit/reference-upload-service.test.js`
  - `tests/unit/content-domain.test.js`
  - `tests/unit/content-service.test.js`
  - `tests/unit/project-service.test.js`
  - `tests/unit/review-service.test.js`
- UI/e2e tests (browser): `tests/ui.smoke.spec.js`
