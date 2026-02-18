# C4 Architecture Model

A complete system map at four levels of zoom, designed for AI agents and developers to quickly understand the system's structure, data flow, and component responsibilities.

**Last updated:** 2026-02-17

---

## Level 1: System Context

```
+-------------------+          +------------------------+
|   Browser Client  |  HTTP    |   Prompt Compiler      |
|   (User)          |--------->|   Server               |
|                   |<---------|   (Node.js, port 8000) |
+-------------------+          +----------+-------------+
                                          |
                    +---------------------+--------------------+
                    |                     |                    |
              +-----v-----+      +-------v-------+    +------v------+
              | File System|      | Replicate API |    | GitHub API  |
              | (projects/ |      | (AI image &   |    | (OAuth,     |
              |  data/)    |      |  video gen)   |    |  AI models) |
              +------------+      +---------------+    +-------------+
```

### External Systems

| System | Protocol | Purpose |
|--------|----------|---------|
| **Browser Client** | HTTP/SSE | Single-page app; 8 workflow pages |
| **File System** | fs (local) | Project data, canon JSON, reference images, rendered assets, storyboard |
| **Replicate API** | HTTPS | SeedDream image generation, Kling video generation |
| **GitHub API** | HTTPS/OAuth | OAuth authentication, AI model inference (GitHub Models) |
| **OpenAI / Anthropic** | HTTPS | Configurable AI provider for page chat and prompt generation |

---

## Level 2: Container Diagram

```
+------------------------------------------------------------------+
|  Browser (SPA)                                                    |
|  +-----------+ +----------+ +----------+ +---------+ +----------+|
|  | UI Layer  | | Modules  | | Services | | Domain  | | Features ||
|  | (nav,     | | (ref-mgr,| | (http,   | | (content| | (content,||
|  |  toasts)  | |  pipeline| |  bootstrap| |  ref-   | |  project,||
|  |           | |  gen-wf) | |  gen-jobs)| |  upload)| |  ref)    ||
|  +-----------+ +----------+ +----------+ +---------+ +----------+|
+-----------------------------------+----------------------------------+
                                    | HTTP / SSE
+-----------------------------------v----------------------------------+
|  Node.js Server (scripts/serve_ui.js)                                |
|  +--------+ +------------+ +---------+ +---------------------------+ |
|  | Router | | Middleware  | | Routes  | | Services                  | |
|  | (URL   | | (auth, CORS| | (13     | | (20 services: generation, | |
|  |  match)| |  logging,  | |  route  | |  storyboard, render mgmt, | |
|  |        | |  body-parse| |  files) | |  agents, sessions, etc.)  | |
|  +--------+ +------------+ +---------+ +---------------------------+ |
+-----------------------------------+----------------------------------+
                                    |
                +-------------------+-------------------+
                v                   v                   v
     +----------------+   +----------------+   +----------------+
     | File System    |   | External APIs  |   | SQLite / Memory|
     | projects/      |   | Replicate      |   | data/          |
     | bible/         |   | GitHub         |   | (auth tokens,  |
     | reference/     |   | OpenAI/Anthro  |   |  generation    |
     | rendered/      |   |                |   |  history)      |
     +----------------+   +----------------+   +----------------+
```

### Container Summary

| Container | Technology | Responsibility |
|-----------|-----------|----------------|
| **Browser SPA** | Vanilla JS, CSS, HTML | 8 workflow pages, no build step, module loading via `<script>` tags |
| **Node.js Server** | Node.js (zero framework) | HTTP server, API routing, file I/O, AI provider orchestration |
| **File System** | Local disk | Project canon, references, prompts, rendered assets, storyboard data |
| **SQLite / In-Memory** | better-sqlite3 (optional) | Auth tokens, generation history; falls back to in-memory Map |
| **External AI APIs** | Replicate, GitHub, OpenAI, Anthropic | Image generation, video generation, LLM chat |

---

## Level 3: Component Diagram

### 3A. Server Components

```
serve_ui.js (bootstrap)
    |
    +-- router.js .............. Lightweight URL router (pattern matching, params, middleware)
    |
    +-- middleware/
    |   +-- auth.js ............ Session cookie auth, public route whitelist
    |   +-- body-parser.js ..... JSON body parsing with size limits
    |   +-- busboy-upload.js ... Multipart file upload (single + multi-file)
    |   +-- error-handler.js ... wrapAsync + global error formatting
    |   +-- http-utils.js ..... sendJSON, CORS headers, SSE helpers, static file serving
    |   +-- logger.js ......... Request logging with correlation IDs
    |
    +-- routes/ (13 modules, ~70 endpoints)
    |   +-- auth.js ............ GitHub OAuth flow (start, callback, logout, config)
    |   +-- bootstrap.js ....... GET /api/app/bootstrap (session + project + auth state)
    |   +-- projects.js ........ CRUD projects, import/export, active project switching
    |   +-- canon.js ........... Load/save bible files (8 types: characters, locations, etc.)
    |   +-- content.js ......... Load/save workflow content (theme, analysis, suno prompt, etc.)
    |   +-- references.js ...... Character/location reference image CRUD
    |   +-- uploads.js ......... Music, video, frame uploads with type/size validation
    |   +-- generation.js ...... SeedDream image gen, shot render CRUD, Kling video gen
    |   +-- generation-jobs.js . Job queue: create, list, cancel, retry, SSE events stream
    |   +-- agents.js .......... AI agent prompt runs: create, cancel, revert, SSE events
    |   +-- pipeline.js ........ Pipeline status, compile, lint, index operations
    |   +-- storyboard.js ..... Storyboard sequence, previs map, review metadata
    |   +-- page-chat.js ...... Per-page AI chat (send, history, clear, apply)
    |   +-- ai-provider.js .... Switch active AI provider, set API keys
    |   +-- static.js ......... Static file serving (UI assets, project files)
    |
    +-- services/ (20 modules)
        +-- session_service.js ........... Cookie sessions, GitHub OAuth state, TTL cleanup
        +-- github_auth_service.js ....... OAuth token exchange, user profile fetch
        +-- ai_provider_service.js ....... Multi-provider registry (github, openai, anthropic)
        +-- database_service.js .......... SQLite/in-memory auth token + audit storage
        +-- project_manager.js ........... Project CRUD, active project tracking, path resolution
        +-- generation_task_service.js ... Orchestrates generate-shot and generate-image tasks
        +-- generation_jobs_service.js ... In-memory job queue with pub/sub events
        +-- agent_runtime_service.js ..... AI agent execution (create, run, cancel, revert)
        +-- render_management_service.js . Shot render file operations, continuity resolution
        +-- storyboard_persistence.js .... Read/write sequence.json + previs_map.json (atomic)
        +-- review_metadata_service.js ... Storyboard review status sanitization
        +-- pipeline_status_service.js ... 6-step pipeline completion tracking
        +-- context_bundle_service.js .... Aggregate project context for AI consumption
        +-- page_chat_service.js ......... LLM chat orchestration (multi-provider)
        +-- page_chat_store_service.js ... Chat history persistence (per-page, per-project)
        +-- page_chat_context_service.js . Build page-specific context for chat
        +-- page_chat_apply_service.js ... Apply chat suggestions to project data
        +-- replicate_client.js .......... Replicate API client (predictions, polling, download)
        +-- kling_client.js .............. Kling video generation API client
        +-- content_file_service.js ...... Workflow content file I/O (theme, analysis, etc.)
```

### 3B. Client Components

```
Browser SPA (ui/)
    |
    +-- UI Layer (ui-layer.js)
    |   +-- Navigation ........ Workflow step nav, resource links, project selector
    |   +-- Toasts ............ Notification system (success, error, warning, info)
    |   +-- Modals ............ New project, analysis prompt, confirmation dialogs
    |   +-- Loading states .... Spinners for async operations
    |
    +-- Modules (ui/modules/)
    |   +-- reference-manager.js ... Step 4: character/location reference card UI
    |   +-- prompt-viewer.js ....... Step 5: prompt display, copy, variation switching
    |   +-- generation-workflow.js . Generation orchestration, SSE streaming, polling
    |   +-- agent-integration.js ... AI agent prompt run UI
    |   +-- pipeline.js ............ Compile/lint/index pipeline controls
    |   +-- canon-editor.js ........ Step 3: canon JSON editing
    |   +-- page-chat.js .......... AI chat panel for each page
    |   +-- page-chat-adapters.js . Page-specific chat context adapters
    |   +-- shot-flow-state.js .... Step 5: shot selection and flow state machine
    |   +-- command-palette.js .... Keyboard shortcut command palette
    |   +-- project-actions.js .... Project-level actions (new, switch, delete)
    |   +-- shared-utils.js ....... DOM helpers, toast API, clipboard, formatting
    |
    +-- Services (ui/services/)
    |   +-- http-client.js ......... Fetch wrapper with retry, backoff, timeout
    |   +-- bootstrap-service.js ... Initial app state load from /api/app/bootstrap
    |   +-- generation-jobs-service.js .. Job queue polling and state sync
    |   +-- generation-readiness-service.js .. Pre-generation validation
    |   +-- context-bundle-service.js ...... Context aggregation for AI
    |   +-- agent-runtime-service.js ....... Agent run lifecycle management
    |   +-- pipeline-service.js ............ Pipeline API calls
    |   +-- content-service.js ............. Content load/save API calls
    |   +-- project-service.js ............. Project CRUD API calls
    |   +-- reference-upload-service.js .... Reference image upload API
    |   +-- reference-library-service.js ... Reference library listing API
    |   +-- auto-save-service.js ........... Debounced auto-save for editors
    |   +-- lint-report-service.js ......... Lint results fetching
    |   +-- page-chat-service.js ........... Chat API calls
    |
    +-- Domain (ui/domain/)
    |   +-- content-domain.js ........... Content type validation and mapping
    |   +-- reference-upload-domain.js .. Upload validation, FormData construction
    |
    +-- Features (ui/features/)
    |   +-- content-feature.js ... Coordinates content load/save with auto-save
    |   +-- project-feature.js ... Project switching and initialization
    |   +-- reference-feature.js . Reference upload orchestration
    |
    +-- Controllers (ui/controllers/)
    |   +-- app-deps.js ......... DI container: wires services, features, modules
    |
    +-- Pages (8 HTML files)
        +-- home.html .......... Landing / project overview
        +-- step1.html ......... Theme & Concept
        +-- step2.html ......... Music & Analysis
        +-- step3.html ......... Content Blueprint (Canon)
        +-- step4.html ......... References & Assets
        +-- index.html ......... Step 5: Shots & Prompts (main workspace)
        +-- storyboard.html .... Step 6: Storyboard Preview
        +-- guide.html ......... User guide
```

### Client Layering Model

```
  Page HTML (loads scripts)
      |
  app.js (initialization, event wiring)
      |
  Modules (UI rendering, user interactions)
      |
  Features (orchestration, cross-concern coordination)
      |
  Domain (validation, business rules)
      |
  Services (HTTP API calls)
      |
  http-client.js (fetch with retry/backoff/timeout)
```

---

## Level 4: Key Code Patterns

### 4A. Request Processing Pipeline

```
Incoming HTTP Request
    |
    v
[Request Logger] -- assigns correlation ID, logs method/path
    |
    v
[Auth Middleware] -- checks session cookie, whitelist for public routes
    |
    v
[Router.handle()] -- matches URL pattern, extracts params into req.params
    |                  runs matching middleware prefix chain
    v
[Route Handler] -- validates input, calls service, returns JSON
    |
    v
[sendJSON()] -- consistent response format: { success: bool, ...data }
```

### 4B. Domain-Scoped Route Contexts

Each route module receives only its dependencies via a context object:

```javascript
// serve_ui.js wires dependencies:
registerGenerationRoutes(router, {
  ...sharedCtx,           // sendJSON, wrapAsync, jsonBody, MAX_BODY_SIZE, projectManager, resolveProjectId
  sanitizePathSegment,    // input validation
  replicate,              // AI API client
  renderManagement,       // file operations
  storyboardPersistence,  // sequence/previs data
  ...
});
```

### 4C. SSE Event Streaming

```
Client                          Server
  |                               |
  |  GET /api/.../events          |
  |------------------------------>|
  |                               |  res.writeHead(200, 'text/event-stream')
  |  <-- stream_open event        |
  |  <-- historical events        |
  |                               |  subscribe(id, callback)
  |  <-- real-time events         |
  |  <-- : ping (heartbeat)      |  setInterval(15s)
  |  <-- job_completed/failed     |
  |                               |  cleanup: clearInterval + unsubscribe
  |  Connection close             |
  |------------------------------>|
```

### 4D. Generation Job Lifecycle

```
POST /api/generation-jobs (type: generate-shot)
    |
    v
GenerationJobsService.createJob()  -- in-memory, pub/sub
    |
    v
GenerationTaskService.startGenerationJob()
    |
    +-- buildShotGenerationPreflight()  -- resolve refs, prompts, continuity
    |
    +-- executeGenerateShotTask()
    |       |
    |       +-- replicate.createPrediction()  -- start AI generation
    |       +-- replicate.pollPrediction()    -- wait for completion
    |       +-- downloadAndSave()             -- save to rendered/shots/
    |
    v
Emit events: job_progress, job_completed/job_failed
    |
    v
SSE subscribers receive events in real-time
```

### 4E. File System Layout

```
projects/
  {project-id}/
    bible/                    # Canon data (8 JSON files)
      characters.json
      locations.json
      cinematography.json
      visual_style.json
      shot_list.json
      transcript.json
      asset_manifest.json
      youtube_script.json
    reference/                # Visual reference images
      characters/{name}/      # Up to 14 images per character
      locations/{name}/       # Up to 14 images per location
    prompts/                  # Generated prompts (per-platform)
      templates/
      generated/
    rendered/                 # AI-generated assets
      shots/{shot-id}/        # Per-shot renders (seedream_A_first.png, etc.)
      storyboard/
        sequence.json         # Shot order, selections, review status
        previs_map.json       # Shot-to-render mapping
    music/                    # Uploaded music files
    content/                  # Workflow content (theme.json, analysis.json, etc.)
    chat/                     # Per-page chat history

data/                         # Auth tokens, database (SQLite or in-memory)
```

---

## Data Flow Summary

| Flow | Path |
|------|------|
| **Page load** | Browser -> GET /api/app/bootstrap -> session + project + auth state |
| **Canon save** | Browser -> POST /api/save/canon/:type -> write to bible/{type}.json |
| **Ref upload** | Browser -> POST /api/references/:kind/:name/images -> save to reference/ |
| **Generate image** | Browser -> POST /api/generation-jobs -> job queue -> Replicate API -> save to rendered/ |
| **SSE stream** | Browser -> GET /api/generation-jobs/:id/events -> real-time progress |
| **AI chat** | Browser -> POST /api/page-chat/:page/send -> AI provider -> response |
| **Storyboard** | Browser -> GET /api/storyboard/sequence -> sequence.json |
| **Pipeline** | Browser -> POST /api/pipeline/compile -> compile_prompts.js -> prompts/ |

---

## Configuration

All tunable values are centralized in `scripts/config.js` with environment variable overrides:

| Constant | Default | Env Var | Purpose |
|----------|---------|---------|---------|
| REQUEST_TIMEOUT_MS | 30s | REQUEST_TIMEOUT_MS | Standard request timeout |
| LONG_RUNNING_TIMEOUT_MS | 5.5min | LONG_RUNNING_TIMEOUT_MS | SSE/generation routes |
| SSE_HEARTBEAT_MS | 15s | SSE_HEARTBEAT_MS | Keep-alive ping interval |
| MAX_UPLOAD_SIZE | 20MB | MAX_UPLOAD_SIZE | Default per-file upload limit |
| MAX_IMAGE_SIZE | 10MB | MAX_IMAGE_SIZE | Reference image limit |
| MAX_VIDEO_SIZE | 500MB | MAX_VIDEO_SIZE | Video upload limit |
| SESSION_TTL_MS | 12h | SESSION_TTL_MS | Session lifetime |
| SHUTDOWN_TIMEOUT_MS | 10s | SHUTDOWN_TIMEOUT_MS | Graceful shutdown drain |

---

## Cross-Cutting Concerns

| Concern | Implementation |
|---------|---------------|
| **Logging** | `scripts/logger.js` — structured JSON logger (info, warn, error, fatal) |
| **Error handling** | `wrapAsync()` catches async errors; global error handler formats response |
| **CORS** | Per-request origin checking against allowed origins set |
| **Auth** | Cookie-based sessions; public route whitelist in auth middleware |
| **File locking** | Cooperative file locks with stale detection (O_EXCL + retry) |
| **Atomic writes** | Temp file + rename pattern for JSON persistence |
| **Retry/backoff** | Client HTTP: exponential backoff (500ms base, 15s cap) with jitter |
| **SSE resilience** | Client reconnects 3x with backoff, then falls back to polling |
| **Graceful shutdown** | SIGINT/SIGTERM handlers; connection drain with timeout |
| **Crash recovery** | uncaughtException handler initiates graceful shutdown |
