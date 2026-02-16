# UI Style + DOM Contract

This contract lists selectors that JavaScript depends on directly. Renaming/removing them without updating JS will break behavior.

## Global (all app pages)

Required mounts used by `ui/ui-layer.js`:

- `[data-ui-nav-brand]`
- `[data-ui-project-selector]`
- `[data-ui-nav-stats]`
- `[data-ui-nav-footer]`
- `[data-ui-workflow-nav]`
- `[data-ui-resource-nav]`
- `[data-ui-guide-nav]`
- `[data-ui-new-project-modal]`
- `[data-ui-analysis-prompt-modal]`
- `[data-ui-toast-container]`
- `#projectSelector`
- `.main-layout`

## Shared project shell

- `#mobileNavToggle`
- `#mobilePanelOverlay`
- `#pageToolbarHeading`
- `#pageToolbarSubtitle`

## Step 1/2/3/4 content pages (`ui/app.js`)

- `.collapsible-card`
- `.collapsible-header`
- `.collapse-toggle`
- `.collapse-icon`
- `#musicDropZone`
- `#musicFileInput`
- `#musicFilename`
- `#musicControls`
- `#musicPlayer`
- `#musicFileInfo`

## Step 5 shots page (`ui/app.js` + modules)

Core selection/rendering:

- `#shotList`
- `#shotSelector`
- `#shotListPanel`
- `#toggleShotListBtn`
- `#platformFilter`
- `#search`
- `#lintFilter`
- `#promptViewer`
- `#emptyState`
- `.variation-btn`
- `.shot-item`

Generation and readiness:

- `#generateShotBtn`
- `#generateRefImageBtn`
- `#autoUploadRefSetBtn`
- `#shotReadiness`
- `#readinessReplicate`
- `#readinessPrompt`
- `#readinessContinuity`
- `#readinessRefs`
- `#readinessMessage`
- `#referenceProvenance`
- `#shotRendersGrid`
- `#continuityToggle`
- `#continuityNote`
- `#refSetNote`

Generation history/modals:

- `#generationHistoryList`
- `#generationChoiceModal`
- `#generationChoiceGrid`
- `#quickAcceptGeneratedBtn`
- `#quickAcceptAndNextBtn`
- `#generationJobDetailsModal`

Agent + context drawer:

- `#agentRunPanel`
- `#agentRunStatus`
- `#agentRunFiles`
- `#agentRunLog`
- `#previewContextBtn`
- `#contextDrawer`
- `#contextDrawerOverlay`

## Storyboard page (`ui/storyboard.js`)

View/layout:

- `#gridView`
- `#timelineView`
- `#shotGrid`
- `#timelineTrack`
- `#timelineFilmstrip`
- `.view-tab`
- `.shot-card`
- `.timeline-shot`
- `.filmstrip-item`

Stats/readiness/manifest:

- `#stat-shots`
- `#stat-ready`
- `#stat-passed`
- `#stat-failed`
- `#readinessBar`
- `#readinessSummary`
- `#readinessBarToggle`
- `#manifestToggleBtn`
- `#manifestBody`
- `#assetTableBody`
- `#assetCount`

Storyboard media and modals:

- `#musicDropZone`
- `#musicFileInput`
- `#musicFilename`
- `#storyboardAudio`
- `#shotModal`
- `#commentsModal`

## CSS structure

Base stylesheet is now split into:

- `ui/styles/base.css`
- `ui/styles/layout.css`
- `ui/styles/components.css`
- `ui/styles/pages/home.css`
- `ui/styles/pages/index.css`
- `ui/styles/pages/storyboard.css`

`ui/styles.css` is the import aggregator and should remain the page include target.
