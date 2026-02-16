# Services Catalog

Backend service modules under `scripts/services/`. Each service is instantiated in `scripts/serve_ui.js` and injected into route modules via domain-scoped contexts.

**Total services:** 20

---

## Generation & Rendering

### `generation_task_service.js`

Purpose: Execute generate-image and generate-shot tasks, start async generation jobs, build shot generation preflight contracts.

Inputs: Project ID, shot, variation, options, Replicate availability, prompt files, render/continuity/reference data.

Outputs: Generated image paths, reference provenance (`referenceManifest`), execution snapshot (`preflightSnapshot`).

Failure modes: Missing Replicate token, missing/invalid prompt file, missing references when required, model timeout/failure/cancel.

Dependencies: `projectManager`, `replicate`, `generationJobs`, `renderManagement`, `storyboardPersistence`.

### `generation_jobs_service.js`

Purpose: Persistent async job registry with lock conflict protection, event append, and SSE subscriber fanout.

Inputs: Job payload, lock key, executor callback.

Outputs: Job lifecycle state, event logs under project job folders, metrics summary.

Failure modes: Lock conflicts, executor failure/cancel, server restart during run (incomplete jobs marked failed).

Dependencies: `projectManager`.

### `render_management_service.js`

Purpose: Parse and list shot renders, resolve continuity (previous shot `A:last`), gather and sync shot reference sets, convert local image paths to data URIs.

Inputs: Project file paths, sequence order and previs map, shot list/canon reference folders.

Outputs: Render slot maps, continuity resolution metadata, ordered reference path candidates.

Failure modes: Missing shot dirs/files, invalid/malformed sequence/previs data, non-image file mismatches.

Dependencies: `projectManager`, `storyboardPersistence`.

---

## Storyboard & Review

### `storyboard_persistence_service.js`

Purpose: Read/write `sequence.json` and `previs_map.json`, normalize/validate sequence scaffolds, normalize review and assignee fields.

Failure modes: Invalid JSON in persisted files, missing files (falls back to defaults).

Dependencies: `projectManager`.

### `review_metadata_service.js`

Purpose: Normalize assignee/comments/status fields, sanitize review metadata stored in sequence selections.

Failure modes: Invalid review status values, oversized/invalid comment payloads.

Dependencies: None (pure functions).

---

## Content & Canon

### `content_file_service.js`

Purpose: Typed save/load for Step 1/2 content files, enforce size limits and JSON validity where required.

Failure modes: Unknown content type, content too large/invalid JSON.

Dependencies: `projectManager` (via constructor).

### `context_bundle_service.js`

Purpose: Build structured context bundles (shot intent, sequence, refs, transcript snippets) for export and agent use.

Failure modes: Missing canon/sequence/music artifacts, partial bundle with warnings.

Dependencies: `projectManager`.

### `timed_context_service.js`

Purpose: Resolve transcript snippets for shot timing windows using music analysis data.

Failure modes: Missing or sparse timing/analysis sections.

Dependencies: None (pure functions operating on data).

---

## References & Uploads

### `reference_entity_handler.js`

Purpose: Shared polymorphic handler for character/location reference entities — list, add, upload, delete logic with configurable behavior.

Failure modes: Invalid entity/slot names, duplicate entities, invalid image extension.

Dependencies: `projectManager` (via caller).

---

## Agent System

### `agent_runtime_service.js`

Purpose: In-app AI prompt run lifecycle — shot-level locking, event streaming, and run revert.

Failure modes: OAuth missing/expired, lock conflict, scoped write guard violations.

Dependencies: `agentFileGuard`, `githubModels`.

### `agent_file_guard_service.js`

Purpose: Enforce write scope for agent runs, snapshot files before writes, support revert to pre-run state.

Failure modes: Path outside allowlist, snapshot/write restore mismatch.

Dependencies: None (filesystem operations).

### `agent_prompt_tools.js`

Purpose: Resolve prompt target paths, load shot context (canon, sequence, transcript, references) for agent prompt editing. Provides `loadShotContext()` and `resolvePromptTargetPath()`.

Inputs: Project path, shot ID, variation, tool type.

Outputs: Structured shot context with canon data, transcript snippets, reference paths, and resolved prompt file paths.

Failure modes: Missing prompt index, missing canon files, invalid shot ID format.

Dependencies: `projectManager`, `timed_context_service`.

---

## Page Chat System

Four services compose the page-aware copilot chat feature:

### `page_chat_service.js`

Purpose: Top-level orchestrator — receives user messages, calls GitHub-hosted model, parses model responses into proposals, delegates apply/reject.

Inputs: Session ID, page ID, project ID, user message, page state.

Outputs: Assistant response with optional edit proposals (content, canon, or shot prompt changes).

Failure modes: Model timeout/rate limit, malformed model JSON response, proposal validation failure.

Dependencies: `page_chat_store_service`, `page_chat_context_service`, `page_chat_apply_service`, `github_models_service`.

### `page_chat_store_service.js`

Purpose: Persistent conversation storage — create/list sessions, append messages, manage pending proposals per session. Stores as JSON files under each project's `chat/` directory.

Inputs: Project ID, page ID, session ID, messages.

Outputs: Session list, message history, pending proposal queue.

Constraints: Max 400 messages per session, max 40 pending proposals.

Failure modes: Invalid page ID, missing project path, corrupt session JSON.

Dependencies: `projectManager`.

### `page_chat_context_service.js`

Purpose: Build page-aware context documents for the chat model — loads relevant content/canon/prompt data based on current page and shot selection.

Inputs: Project ID, page ID, page state (selection, fields).

Outputs: Structured context documents with truncation (max 12K chars per document).

Failure modes: Missing content files (returns empty context gracefully).

Dependencies: `projectManager`, `content_file_service`, `agent_prompt_tools`.

### `page_chat_apply_service.js`

Purpose: Apply or reject model-proposed edits — validates target is editable on current page, performs atomic file writes with content hashing.

Inputs: Project ID, page ID, proposal object (target kind, content).

Outputs: Applied file path, content hash, relative path.

Page scope enforcement:
- `step1`: content types (concept, inspiration, mood, genre)
- `step2`: content types (suno-prompt, song-info, analysis)
- `step3`: canon types (script, youtubeScript, transcript, assets, characters, locations, style, cinematography)
- `index`: shot prompts only

Failure modes: Read-only page, target not editable on page, missing project path.

Dependencies: `projectManager`, `content_file_service`, `page_chat_context_service`.

---

## Auth & Sessions

### `github_auth_service.js`

Purpose: Build OAuth authorize URLs, exchange auth codes for tokens, fetch user profile from GitHub API.

Failure modes: Missing OAuth env config, token exchange/profile request failures.

Dependencies: None (HTTP calls to GitHub).

### `github_models_service.js`

Purpose: Wrapper for GitHub-hosted model inference calls used by agent runtime and page chat.

Failure modes: Auth token invalid, model timeout/rate limit.

Dependencies: None (HTTP calls to GitHub Models API).

### `session_service.js`

Purpose: In-memory session creation and cookie utilities, GitHub auth payload attachment to session.

Failure modes: Expired/missing session ID, invalid cookie values.

Dependencies: None (in-memory state).

---

## Pipeline

### `pipeline_status_service.js`

Purpose: Track last compile/lint/reindex run metadata by project, merge runtime status with prompt index summary.

Failure modes: Missing index artifacts (falls back to zeros).

Dependencies: `projectManager`.
