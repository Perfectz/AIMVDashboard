# Shot Flow (Step 5)

This document defines the Step 5 shot generation flow for SeedDream.

## Goal

Generate first/last frame previews quickly while preserving shot continuity and reference quality.

## Primary UX Path

1. User selects shot + variation in `index.html`.
2. UI loads shot renders and calls:
   - `GET /api/shot-generation/preflight`
3. UI renders readiness badges:
   - Replicate configured
   - Prompt found
   - Continuity source
   - Reference availability
4. User clicks `Generate First + Last Frame`.
5. UI starts generation job:
   - `POST /api/generation-jobs` with `type=generate-shot`
6. UI listens to SSE progress:
   - `GET /api/generation-jobs/:jobId/events`
7. On completion, preview modal opens.
8. User chooses:
   - `Quick Accept` -> `POST /api/save-shot-previews`
   - Advanced per-image save -> `POST /api/save-shot-preview`
9. UI refreshes renders and preflight for current shot.

## Advanced Controls

Advanced controls are collapsible to keep the default flow simple:

1. Generate single image requiring references.
2. Auto-upload shot reference set (up to 14 images).
3. Continuity toggle (`continuityDisabled` in previs map).
4. Replicate session key update.
5. Agent prompt generation.

## Reference Assembly Policy

Current policy is fixed:

`continuity_then_uploaded_then_canon`

Order:

1. Continuity first frame (manual current first, or inherited previous `A:last`) if enabled.
2. Uploaded shot reference set (`seedream_<var>_first_ref_XX.*`).
3. Canon references from shot-linked characters then location.

The runtime trims references when needed to satisfy model limits.

## Continuity Rules

1. Continuity is SeedDream-only.
2. Source frame is previous ordered shot variation `A` last frame.
3. Manual first frame on current shot always overrides inheritance.
4. Missing source remains explicit (not silently substituted).

## Quick Accept Semantics

`POST /api/save-shot-previews` accepts multiple frame selections and saves them in one request.

Default quick mapping:

1. Preview 1 -> `first`
2. Preview 2 -> `last` (or preview 1 if only one preview exists)

## Failure Behavior

1. Missing key -> preflight recommends `set_replicate_key`.
2. Missing prompt -> preflight recommends `fix_prompt`.
3. No refs available with required refs -> recommends `upload_refs`.
4. Lock conflict -> UI binds to active job and points user to generation history.

## Data Produced by Generation

Generation result includes:

1. `referenceManifest` (ordered provenance entries).
2. `preflightSnapshot` (continuity/ref counts/options at execution time).

These fields support fast debugging and reproducibility.
