# Server Architecture

Server entry point: `scripts/serve_ui.js`

## Runtime Model

1. Vanilla `http.createServer`.
2. Custom router (`scripts/router.js`) with path params and middleware.
3. Route modules register endpoints using **domain-scoped context objects**.
4. JSON/file-backed persistence under `projects/<id>/`.

## Key Layers

### 1) Bootstrap (`serve_ui.js`)

`serve_ui.js` wires:

1. Constants imported from `scripts/config.js` (regexes, size limits, allowed types).
2. Middleware (body parsing, CORS, static serving, multipart uploads).
3. Service instances (generation, storyboard, auth, pipeline, page-chat).
4. Domain-scoped context objects — each route module receives only the dependencies it uses.

### 2) Configuration (`scripts/config.js`)

Centralized constants shared across server modules:

1. Validation regexes: `PROJECT_ID_REGEX`, `SHOT_ID_REGEX`, `VARIATION_REGEX`, `CHARACTER_REGEX`, `LOCATION_REGEX`.
2. File type constraints: `ALLOWED_MUSIC_TYPES`, `ALLOWED_IMAGE_TYPES`, `ALLOWED_VIDEO_TYPES`, `ALLOWED_CANON_TYPES`.
3. Size limits: `MAX_MUSIC_SIZE`, `MAX_VIDEO_SIZE`, `MAX_IMAGE_SIZE`, `MAX_BODY_SIZE`, `MAX_REFERENCE_IMAGES`.
4. Agent constraints: `AGENT_MODES`, `AGENT_TOOLS`.

### 3) Middleware (`scripts/middleware/`)

1. `body-parser.js` — JSON body parsing with size limit.
2. `busboy-upload.js` — multipart file upload parsing (single-file `parseBusboyUpload` and multi-file `parseMultipartData`).
3. `error-handler.js` — `wrapAsync` for async route error handling.
4. `http-utils.js` — `sendJSON`, `serveFile`, `sendSseEvent`, `corsHeadersForRequest`.
5. `logger.js` — request logging middleware.

### 4) Route Modules (`scripts/routes/*.js`)

Each route file has narrow responsibility:

1. `projects.js` — project CRUD.
2. `auth.js` — GitHub OAuth session endpoints.
3. `content.js` — text/json content save/load + context export.
4. `canon.js` — canon JSON save/load.
5. `references.js` — character/location reference CRUD.
6. `uploads.js` — music/video/image upload flows.
7. `storyboard.js` — previs/sequence/review metadata.
8. `generation.js` — Replicate generation and shot render endpoints.
9. `generation-jobs.js` — async job orchestration + SSE.
10. `agents.js` — in-app prompt agent runs + SSE/revert.
11. `pipeline.js` — compile/lint/reindex orchestration.
12. `page-chat.js` — page copilot chat sessions and proposal apply.
13. `static.js` — static and project file serving.

### 5) Services (`scripts/services/*.js`)

20 domain-logic modules extracted from route handlers:

| Service | Responsibility |
|---------|---------------|
| `generation_task_service.js` | Generation execution and lock dispatch |
| `render_management_service.js` | Continuity/order/render/reference helpers |
| `storyboard_persistence_service.js` | Sequence/previs file persistence |
| `generation_jobs_service.js` | Job state store + event streaming |
| `agent_runtime_service.js` | Agent lifecycle + file writes/revert |
| `agent_file_guard_service.js` | Write scope enforcement and snapshot/revert |
| `agent_prompt_tools.js` | Agent tool definitions |
| `content_file_service.js` | Typed content files with validation |
| `context_bundle_service.js` | Structured context bundles for shots |
| `timed_context_service.js` | Transcript snippet timing resolution |
| `reference_entity_handler.js` | Polymorphic character/location handler |
| `review_metadata_service.js` | Review status/assignee normalization |
| `github_auth_service.js` | OAuth URL/token/profile exchange |
| `github_models_service.js` | GitHub-hosted model API calls |
| `session_service.js` | In-memory session + cookie utilities |
| `pipeline_status_service.js` | Compile/lint/reindex status tracking |
| `page_chat_store_service.js` | Chat message/session persistence |
| `page_chat_context_service.js` | Page context assembly for chat |
| `page_chat_apply_service.js` | Proposal application to project files |
| `page_chat_service.js` | Chat orchestrator (store + context + apply) |

## Domain-Scoped Route Contexts

Each route registration receives a tailored context with only its dependencies:

```
sharedCtx = { sendJSON, wrapAsync, jsonBody, MAX_BODY_SIZE, projectManager, resolveProjectId }

registerAuthRoutes(router, { ...sharedCtx, session methods, OAuth functions, CORS })
registerContentRoutes(router, { ...sharedCtx, getProjectContext, buildContextBundle })
registerGenerationRoutes(router, { ...sharedCtx, replicate, task/render services, regexes })
```

This eliminates the prior monolithic 73-property `routeContext` object.

## Generation Path (SeedDream)

1. `POST /api/generation-jobs` creates job.
2. Job executes `executeGenerateShotTask`.
3. Task resolves continuity and reference set.
4. Calls `replicate_client.createPrediction`.
5. Saves preview or final frames.
6. Emits progress/events to SSE stream.

## Concurrency and Locking

Generation uses scoped lock keys:

- `generate-shot`: `<project>:generate-shot:<shotId>:<variation>`

Behavior:

1. New conflicting run returns lock conflict.
2. UI can attach to active run by job ID.

## Security and Safety

1. Path access uses safe resolvers (`safeResolve`) to prevent traversal.
2. Route-level path/input sanitization via regex.
3. Session token storage is in-memory session store.
4. No raw OAuth token persistence to project files.

## Event Streaming

SSE endpoints:

1. `/api/generation-jobs/:jobId/events`
2. `/api/agents/prompt-runs/:runId/events`

Events are append-only and persisted in run/job folders for diagnostics.

## File Persistence Conventions

- Shot renders: `projects/<id>/rendered/shots/<SHOT_ID>/`
- Shot previews: `.../preview/`
- Generation jobs: `.../rendered/storyboard/generation_jobs/<jobId>/`
- Agent runs: `.../rendered/storyboard/agent_runs/<runId>/`

## Extension Guidelines

1. Put new business logic in `scripts/services/*`.
2. Keep route files as thin validation + transport handlers.
3. Add constants to `scripts/config.js`.
4. When wiring new routes, create a domain-scoped context — do not add to a shared bag.
5. Preserve additive API compatibility.
