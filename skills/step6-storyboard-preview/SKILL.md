---
name: step6-storyboard-preview
description: Complete Step 6 (Storyboard Preview) for AIMVDashboard by assembling rendered shots into a timeline sequence, configuring previs maps, setting editorial order, and validating readiness. Use when asked to complete, verify, or manage the storyboard page.
---

# Step 6: Storyboard Preview Skill

Assemble rendered shot outputs into a reviewable storyboard with editorial ordering, variation selection, previs mapping, and readiness validation. This is the final assembly step before video editing.

## Prerequisites

- Steps 1-5 must be complete:
  - `projects/<project-id>/bible/shot_list.json` — defines the shot sequence
  - `projects/<project-id>/prompts_index.json` — compiled prompts for all shots
  - `projects/<project-id>/rendered/shots/` — rendered assets must exist for at least some shots
  - `projects/<project-id>/music/` — music file for filmstrip playback (optional)

## Required Artifacts

| File | Purpose |
|------|---------|
| `rendered/storyboard/sequence.json` | Master sequence: selections, editorial order, review status |
| `rendered/storyboard/previs_map.json` | Per-shot previs configuration and reference mode |
| `lint/readiness_report.json` | Generation readiness validation report (optional) |

## Execute

1. Resolve project ID. Default to `default` if not specified.
2. Read the shot list from `bible/shot_list.json` to get all shot IDs.
3. Scan available renders for each shot via the API:
   - `GET /api/shot-renders?shotId=<SHOT_ID>&project=<id>` — returns `{ renders: { seedream: { A: { first, last } }, kling: { ... } } }`
4. Read or create `rendered/storyboard/sequence.json`.
5. For each shot in the shot list:
   a. Ensure a selection entry exists in `sequence.selections`.
   b. If renders exist, set `selectedVariation` to the best available variation (default "A").
   c. Set `status` based on render availability: "rendered" if files exist, "not_rendered" otherwise.
   d. Set `reviewStatus` to "draft" for new entries.
6. Build the `editorialOrder` array — ordered list of shot IDs reflecting the intended timeline sequence (typically matches shot_list order).
7. Configure previs map entries for shots that have renders:
   - `PUT /api/storyboard/previs-map/<SHOT_ID>?project=<id>` — body: `{ "entry": { ... } }`
8. Save the sequence:
   - `POST /api/storyboard/sequence?project=<id>` — body: full sequence JSON
9. Optionally generate a readiness report:
   - `POST /api/storyboard/readiness-report?project=<id>`
10. Verify the assembled storyboard is complete.

### sequence.json Schema

```json
{
  "version": "2026-02-07",
  "projectName": "Project Name",
  "totalShots": 10,
  "totalDuration": 80,
  "musicFile": "song.mp3",
  "selections": [
    {
      "shotId": "SHOT_01",
      "selectedVariation": "A",
      "status": "rendered",
      "reviewStatus": "draft",
      "comments": [],
      "assignee": "",
      "renderFiles": {
        "kling": { "A": "path/to/file.mp4" },
        "nano": { "first": "path/to/first.png", "last": "path/to/last.png" }
      },
      "locked": false,
      "sourceType": "Manual"
    }
  ],
  "editorialOrder": ["SHOT_01", "SHOT_02", "SHOT_03"],
  "lastUpdated": "2026-02-17T00:00:00.000Z"
}
```

**Selection fields**:
- `selectedVariation`: "A", "B", "C", "D", or "none"
- `status`: "not_rendered", "rendering", "rendered", "approved"
- `reviewStatus`: "draft", "in_review", "approved", "changes_requested"
- `comments`: Array of `{ author, text, timestamp }`
- `locked`: Boolean — prevents further changes when true
- `sourceType`: "Manual", "AI_Generated", "Imported"

### previs_map.json Entry Schema

```json
{
  "SHOT_01": {
    "sourceType": "rendered_first_frame",
    "sourceRef": "rendered/shots/SHOT_01/seedream_A_first.png",
    "notes": "",
    "locked": false,
    "continuityDisabled": false,
    "referenceMode": "continuity",
    "selectedReferences": []
  }
}
```

**Source types**: `character_ref`, `location_ref`, `rendered_thumbnail`, `rendered_video`, `rendered_first_frame`, `rendered_last_frame`, `manual`
**Reference modes**: `canon`, `continuity`, `none`, `custom`

## Platform-Specific Best Practices

### Storyboard Assembly Strategy

When selecting variations for the storyboard:

1. **Consistency first**: Choose variations that maintain visual continuity between adjacent shots. If SHOT_01 uses a wide establishing frame, SHOT_02 might work better with an intimate close-up (variation B).
2. **Emotional arc**: Match variation framing to the emotional arc. Use wide/establishing for opening shots, intimate close-ups for emotional peaks, and cinematic wide for resolution.
3. **Music sync**: Align high-energy shots (chorus sections) with dynamic framing variations. Use steady/static framing for verse sections.
4. **Camera variety**: Avoid using the same variation (e.g., all A) for every shot. Mix lens choices and angles for visual interest.

### Editorial Order Guidelines

- Default to shot_list.json order (sequential by shot number)
- Reorder for narrative effect — shots don't have to be in production order
- Group by music section when building a rough cut
- Place strongest variations at section transitions (verse→chorus, chorus→bridge)

### Review Workflow

```
draft → in_review → approved
                  → changes_requested → (revise) → in_review
```

- **draft**: Initial assembly, no human review
- **in_review**: Flagged for review, waiting on feedback
- **approved**: Shot selection confirmed, ready for final export
- **changes_requested**: Needs revision (re-render, different variation, etc.)

## Quality Checks

Before marking complete:

1. Every shot in `shot_list.json` has a corresponding entry in `sequence.selections`.
2. `editorialOrder` contains all shot IDs with no duplicates.
3. At least one shot has `status` of "rendered" (otherwise storyboard is empty).
4. No orphaned entries — every shot ID in selections exists in shot_list.json.
5. `selectedVariation` is valid ("A", "B", "C", "D", or "none") for every entry.
6. `reviewStatus` is valid ("draft", "in_review", "approved", "changes_requested").
7. `totalShots` matches the actual selections count.
8. `musicFile` references a valid file in the music directory (if music exists).

## Completeness Check

```bash
project=default
node -e "
  const fs = require('fs');
  const base = 'projects/' + process.env.P + '/';
  let ok = true;
  // Check sequence.json exists
  const seqPath = base + 'rendered/storyboard/sequence.json';
  if (!fs.existsSync(seqPath)) { console.error('Missing: sequence.json'); process.exit(1); }
  try {
    const seq = JSON.parse(fs.readFileSync(seqPath, 'utf8'));
    // Check selections
    if (!Array.isArray(seq.selections) || seq.selections.length === 0) {
      console.error('No selections in sequence'); ok = false;
    } else {
      console.log('Selections: ' + seq.selections.length + ' shots');
      const rendered = seq.selections.filter(s => s.status === 'rendered').length;
      console.log('Rendered: ' + rendered + '/' + seq.selections.length);
    }
    // Check editorial order
    if (!Array.isArray(seq.editorialOrder) || seq.editorialOrder.length === 0) {
      console.error('No editorial order'); ok = false;
    } else {
      console.log('Editorial order: ' + seq.editorialOrder.length + ' entries');
      // Check for duplicates
      const unique = new Set(seq.editorialOrder);
      if (unique.size !== seq.editorialOrder.length) {
        console.error('Duplicate IDs in editorial order'); ok = false;
      }
    }
    // Cross-check with shot_list
    const shotPath = base + 'bible/shot_list.json';
    if (fs.existsSync(shotPath)) {
      const shots = JSON.parse(fs.readFileSync(shotPath, 'utf8'));
      const seqIds = new Set((seq.selections || []).map(s => s.shotId));
      for (const shot of (shots.shots || [])) {
        if (!seqIds.has(shot.id)) {
          console.error('Shot ' + shot.id + ' missing from sequence'); ok = false;
        }
      }
      if (ok) console.log('Shot coverage: OK');
    }
  } catch (e) { console.error('Parse error: ' + e.message); ok = false; }
  if (!ok) process.exit(1);
  console.log('Step 6 complete.');
" P="$project"
```

## LLM Guidance

- The storyboard step is primarily about data assembly and validation rather than creative generation. Focus on correctness of cross-references and proper editorial ordering.
- Output format for sequence.json: Valid JSON only. No markdown code fences.
- When assembling the storyboard, check for rendered assets first. Shots without renders should be included in the sequence with `status: "not_rendered"` and `selectedVariation: "none"`.
- The editorial order array determines playback sequence in the filmstrip view. It should reflect the narrative flow, which usually matches shot_list.json order.
- Comments are collaborative review notes. Preserve existing comments when updating selection entries.
- Do not set `locked: true` unless explicitly requested — locking prevents further changes.
- Reference `skills/_shared/references/universal-prompt-rules.md` for the data model context.
- Reference `references/storyboard-assembly-guide.md` for detailed assembly patterns.

Step 6 is complete when every shot has a selection entry, the editorial order is populated, and the sequence file is saved.
