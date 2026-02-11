# UI Layer Architecture

This project now uses a dedicated UI layer on top of a component library.

## Stack

- Component library: `Shoelace` (CDN)
- Reusable layer script: `ui/ui-layer.js`
- Reusable layer styles: `ui/ui-layer.css`
- Base app theme: `ui/styles.css`

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

1. Add/update primitive in `ui/ui-layer.js`
2. Add styles in `ui/ui-layer.css`
3. Consume primitive from page/app script
4. For nav links, prefer declarative mounts over hardcoded buttons

This keeps styling and behavior centralized so new pages can scale without duplicating component logic.
