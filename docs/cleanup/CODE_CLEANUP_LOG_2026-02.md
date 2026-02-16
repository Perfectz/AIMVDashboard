# Code Cleanup Log (2026-02)

## Scope

Conservative cleanup pass focused on deduplication, dead-code removal, and deprecation-first API hygiene.

## Completed Changes

### Frontend project context consolidation

- Added `ui/modules/project-context.js` as the canonical project context helper module.
- Added `ui/modules/project-actions.js` as the shared new/delete project modal binder.
- Migrated shared project action wiring in:
  - `ui/app.js`
  - `ui/storyboard.js`
  - `ui/home.html` (inline script)
- Updated `ui/ui-layer.js` to consume `ProjectContext` APIs where available.

### Service wiring fix

- Ensured `ui/services/reference-library-service.js` is loaded on pages that run `app.js`:
  - `ui/index.html`
  - `ui/step1.html`
  - `ui/step2.html`
  - `ui/step3.html`
  - `ui/step4.html`
- Added explicit runtime error in `ui/app.js` when `ReferenceLibraryService` is missing.

### Dead-code and legacy cleanup

- Removed dead function from `ui/app.js`:
  - `renderReferenceManifest`
- Removed dead functions from `ui/storyboard.js`:
  - `getDefaultCharacterRef`
  - `getDefaultLocationRef`
  - `saveShotPrevisOverride`
  - `resetShotPrevisOverride`
  - `ensureStoryboardMetadata`
  - `getProjectQueryParam`
- Marked `scripts/generate_prompts_seedream.js` as legacy in file header comments.

### API deprecation (non-breaking)

- Deprecated `POST /api/generate-shot` in `scripts/routes/generation.js` with:
  - `Deprecation: true`
  - `Sunset: Wed, 30 Sep 2026 00:00:00 GMT`
- Added deprecation warning log on invocation.
- Endpoint behavior remains intact for compatibility.

### CSS/UI cleanup

- Removed orphaned sidebar-era selectors in `ui/styles.css`:
  - `.sidebar*` cluster
  - `.platform-filters`
  - `.platform-filter-btn*`
  - `.sidebar-divider`
  - `.sidebar-section-header*`
  - mobile sidebar-open remnants
- Kept active shot-list selectors (`.shot-item*`, `.tool-tag*`) intact.

### Tooling/docs sync

- Added missing `package.json` scripts:
  - `lint:architecture`
  - `scaffold:feature`
- Updated `docs/UI_LAYER.md` for current module layout and include order.

### Artifact cleanup

- Removed stray root artifact file:
  - `cUserspzgamDesktopAIMusicVideotmp_index_check.json`

## Retained Legacy Items (Intentional)

- `POST /api/generate-shot` remains callable until sunset date.
- `scripts/generate_prompts_seedream.js` remains available for backwards compatibility.
