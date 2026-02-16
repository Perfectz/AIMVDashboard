# Routes Catalog

This is the canonical API endpoint map by route module.

## `scripts/routes/projects.js`

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/projects` | List projects |
| GET | `/api/projects/:id` | Get one project |
| POST | `/api/projects` | Create project |
| PUT | `/api/projects/:id` | Update project metadata |
| DELETE | `/api/projects/:id` | Delete project |

## `scripts/routes/auth.js`

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/auth/github/status` | OAuth connection status |
| GET | `/api/auth/github/start` | Start OAuth redirect |
| GET | `/api/auth/github/callback` | OAuth callback |
| POST | `/api/auth/github/logout` | Clear OAuth session |

## `scripts/routes/bootstrap.js`

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/app/bootstrap` | Single startup payload for project/session/auth/generation/pipeline defaults |

## `scripts/routes/content.js`

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/save/suno-prompt` | Save Suno prompt |
| POST | `/api/save/song-info` | Save song info |
| POST | `/api/save/analysis` | Save analysis JSON |
| POST | `/api/save/concept` | Save concept text |
| POST | `/api/save/inspiration` | Save inspiration text |
| POST | `/api/save/mood` | Save mood text |
| POST | `/api/save/genre` | Save genre text |
| GET | `/api/load/suno-prompt` | Load Suno prompt |
| GET | `/api/load/song-info` | Load song info |
| GET | `/api/load/analysis` | Load analysis JSON |
| GET | `/api/load/concept` | Load concept text |
| GET | `/api/load/inspiration` | Load inspiration text |
| GET | `/api/load/mood` | Load mood text |
| GET | `/api/load/genre` | Load genre text |
| POST | `/api/save/:contentType` | Generic save alias |
| GET | `/api/load/:contentType` | Generic load alias |
| POST | `/api/export/context-bundle` | Export context bundle |
| GET | `/api/export/context-bundle` | Export context bundle |

## `scripts/routes/canon.js`

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/save/canon/:type` | Save canon JSON |
| GET | `/api/load/canon/:type` | Load canon JSON |

## `scripts/routes/references.js`

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/references/characters` | List characters and refs |
| POST | `/api/add-character` | Add character reference folder |
| POST | `/api/upload/reference-image` | Upload character image slot |
| DELETE | `/api/delete/reference-image` | Delete character image slot |
| DELETE | `/api/delete/character-reference` | Delete character entry |
| GET | `/api/references/locations` | List locations and refs |
| POST | `/api/add-location` | Add location reference folder |
| POST | `/api/upload/location-reference-image` | Upload location image slot |
| DELETE | `/api/delete/location-reference-image` | Delete location image slot |
| DELETE | `/api/delete/location-reference` | Delete location entry |

## `scripts/routes/uploads.js`

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/upload/music` | Upload song file |
| POST | `/api/upload/shot` | Upload rendered shot video |
| GET | `/api/upload-status` | Upload status summary |
| DELETE | `/api/delete/music` | Delete uploaded music |

## `scripts/routes/storyboard.js`

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/storyboard/previs-map` | Load previs map |
| PUT | `/api/storyboard/previs-map/:shotId` | Save previs entry |
| DELETE | `/api/storyboard/previs-map/:shotId` | Remove previs entry |
| GET | `/api/review/sequence` | Load normalized sequence |
| POST | `/api/storyboard/sequence` | Save sequence/editorial order |
| POST | `/api/storyboard/readiness-report` | Save readiness report artifact |
| GET | `/api/load/review-metadata` | Load review metadata map |
| POST | `/api/save/review-metadata` | Save per-shot review metadata |

## `scripts/routes/generation.js`

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/generate-status` | Replicate key/config status |
| POST | `/api/session/replicate-key` | Set/clear session Replicate key |
| POST | `/api/generate-image` | Immediate image generation |
| POST | `/api/generate-shot` | Immediate shot generation |
| GET | `/api/shot-generation/preflight` | Readiness contract for shot generation |
| POST | `/api/save-shot-preview` | Save one preview image into frame slot |
| POST | `/api/save-shot-previews` | Batch save quick-accept previews |
| POST | `/api/discard-shot-preview` | Delete pending preview files |
| GET | `/api/shot-renders` | List shot render slots + continuity resolution |
| POST | `/api/upload/shot-render` | Upload first/last frame image |
| POST | `/api/upload/shot-reference-set` | Auto-upload shot ref set |
| DELETE | `/api/delete/shot-render` | Delete shot frame image |

## `scripts/routes/generation-jobs.js`

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/generation-jobs` | List jobs |
| GET | `/api/generation-jobs/metrics` | Job health metrics |
| POST | `/api/generation-jobs` | Start async generation job |
| GET | `/api/generation-jobs/:jobId/events` | SSE stream for job events |
| GET | `/api/generation-jobs/:jobId` | Fetch one job |
| POST | `/api/generation-jobs/:jobId/cancel` | Request cancel |
| POST | `/api/generation-jobs/:jobId/retry` | Retry finished job |

## `scripts/routes/agents.js`

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/agents/locks` | Active agent locks |
| POST | `/api/agents/prompt-runs` | Start shot prompt run |
| GET | `/api/agents/prompt-runs/:runId` | Get run state |
| GET | `/api/agents/prompt-runs/:runId/events` | SSE run events |
| POST | `/api/agents/prompt-runs/:runId/cancel` | Cancel run |
| POST | `/api/agents/prompt-runs/:runId/revert` | Revert run writes |

## `scripts/routes/pipeline.js`

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/pipeline/status` | Pipeline status summary |
| POST | `/api/pipeline/:action` | Run compile/lint/reindex/run-all |

## `scripts/routes/static.js`

| Method | Path | Purpose |
|---|---|---|
| GET | `*` | Static and project file serving fallback |

## Notes

1. Endpoints are additive and file-backed by project.
2. Route modules should remain thin; put business logic in services.
3. Keep response shape backward-compatible when extending fields.
