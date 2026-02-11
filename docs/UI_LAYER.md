# UI Layer Architecture

This project now uses a dedicated UI layer on top of a component library.

## Stack

- Component library: `Shoelace` (CDN)
- Reusable layer script: `ui/ui-layer.js`
- Reusable layer styles: `ui/ui-layer.css`
- Base app theme: `ui/styles.css`
- Domain layer (business validation): `ui/domain/*.js`
- Service layer (API access): `ui/services/*.js`

## Global Includes

Each UI page (`ui/*.html`) loads:

1. `styles.css`
2. Shoelace dark theme CSS
3. `ui-layer.css`
4. Shoelace autoloader script
5. `ui-layer.js`
6. `window.UILayer.init()`

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
3. Add/update visual primitives in `ui/ui-layer.js`.
4. Consume domain/service from page scripts (`ui/app.js`, `ui/storyboard.js`).
5. For nav links, prefer declarative mounts over hardcoded buttons.

This keeps styling and behavior centralized so new pages can scale without duplicating component logic.

## Service/Domain Slice (Implemented)

Storyboard upload flow now uses:

- `ui/domain/upload-domain.js`
  - `validateKlingVideoUpload(input)` for upload validation.
- `ui/services/http-client.js`
  - `createHttpClient()` to centralize JSON request handling.
- `ui/services/storyboard-upload-service.js`
  - `uploadKlingVariation(input)` to call `/api/upload/shot`.

`ui/storyboard.js` now delegates upload logic to this service instead of calling `fetch` directly in the view code.

Prompts/reference upload flow now uses:

- `ui/domain/reference-upload-domain.js`
  - `validateReferenceImageFile(file)`
  - `validateShotRenderUpload(input)`
- `ui/services/reference-upload-service.js`
  - `uploadCharacterReference(input)`
  - `uploadLocationReference(input)`
  - `uploadShotRenderFrame(input)`

`ui/app.js` now routes character, location, and shot-frame image uploads through this service layer.

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

`ui/app.js` and `ui/storyboard.js` now route project-management/review-metadata calls through services, with legacy fallbacks for pages that have not yet loaded the new service scripts.

## Test Separation

- Domain/service unit tests (no browser): `tests/unit/*`
  - `tests/unit/upload-domain.test.js`
  - `tests/unit/storyboard-upload-service.test.js`
  - `tests/unit/reference-upload-domain.test.js`
  - `tests/unit/reference-upload-service.test.js`
  - `tests/unit/content-domain.test.js`
  - `tests/unit/content-service.test.js`
  - `tests/unit/project-service.test.js`
  - `tests/unit/review-service.test.js`
- UI/e2e tests (browser): `tests/ui.smoke.spec.js`
