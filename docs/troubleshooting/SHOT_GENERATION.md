# Shot Generation Troubleshooting

This guide covers common Step 5 SeedDream generation issues.

## Fast Diagnosis Flow

1. Open Step 5 and select shot + variation.
2. Check readiness pills in the actions panel.
3. Open generation history if a run is already active.
4. Inspect job details for input/result/error/event trace.

## Common Errors and Fixes

### 1) `Replicate key missing`

Symptoms:

- Readiness shows Replicate missing.
- Preflight action is `set_replicate_key`.

Fix:

1. Click `Replicate Key` and set session token.
2. Or add `REPLICATE_API_TOKEN` to `.env`.
3. Refresh readiness.

### 2) `Prompt file not found`

Symptoms:

- Preflight action is `fix_prompt`.
- Generate fails quickly with prompt path error.

Fix:

1. Confirm `projects/<id>/prompts/seedream/shot_<num>_<var>.txt` exists.
2. Re-run compile/reindex pipeline if needed.

### 3) `Reference required but none found`

Symptoms:

- Preflight action is `upload_refs`.
- Generate fails with reference requirement error.

Fix:

1. Use `Auto-Upload Ref Set (14)`.
2. Upload manual first frame or continuity source.
3. Ensure shot-linked character/location refs exist.

### 4) `Lock conflict`

Symptoms:

- Generation in progress toast appears.
- New run request returns conflict.

Fix:

1. Open Generation History.
2. Inspect active job details.
3. Cancel active job or wait for completion.

### 5) `Generated previews not saving`

Symptoms:

- Save/Quick Accept fails in preview modal.

Fix:

1. Ensure preview paths are under `rendered/shots/<shot>/preview/`.
2. Confirm preview files still exist (not already deleted).
3. Retry with fresh generation if stale.

## Key Endpoints for Manual Verification

1. `GET /api/generate-status`
2. `GET /api/shot-generation/preflight?project=<id>&shotId=<id>&variation=A&tool=seedream`
3. `GET /api/shot-renders?project=<id>&shot=<id>`
4. `GET /api/generation-jobs?project=<id>&type=generate-shot&shotId=<id>`
5. `GET /api/generation-jobs/:jobId`

## File Paths to Check

1. Prompt file: `projects/<id>/prompts/seedream/shot_<num>_<var>.txt`
2. Shot frames: `projects/<id>/rendered/shots/<SHOT_ID>/`
3. Preview files: `projects/<id>/rendered/shots/<SHOT_ID>/preview/`
4. Reference set files: `seedream_<var>_first_ref_XX.*`
5. Sequence continuity source: `projects/<id>/rendered/storyboard/sequence.json`

## Continuity-Specific Checks

1. Ensure previous shot exists in `editorialOrder`.
2. Ensure previous shot has `seedream_A_last.*`.
3. Verify current shot previs map does not set `continuityDisabled: true`.

## Logging Tips

1. Use browser devtools network tab for preflight and generation requests.
2. Inspect generation job events stream for progress transitions.
3. Use job details modal for input/result/failure trace snapshots.
