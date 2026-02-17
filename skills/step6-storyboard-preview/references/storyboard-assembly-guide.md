# Storyboard Assembly Guide

Detailed reference for assembling and managing the storyboard in Step 6.

---

## 1. Data Flow

```
bible/shot_list.json     →  Shot IDs, timing, music sections
prompts_index.json       →  Prompt availability per shot
rendered/shots/SHOT_XX/  →  Actual render files (images, videos)
music/*.mp3              →  Audio for filmstrip playback
        ↓
rendered/storyboard/sequence.json    →  Selection + ordering + review
rendered/storyboard/previs_map.json  →  Reference configuration per shot
lint/readiness_report.json           →  Validation summary
```

---

## 2. Render File Discovery

The system discovers renders by scanning `rendered/shots/<SHOT_ID>/` directories.

### Expected File Naming Convention

| Platform | Naming Pattern | Example |
|----------|---------------|---------|
| SeedDream | `seedream_<VAR>_first.png`, `seedream_<VAR>_last.png` | `seedream_A_first.png` |
| Kling | `kling_option_<VAR>.mp4` | `kling_option_A.mp4` |
| Nano Banana | `nano_first_frame.png`, `nano_last_frame.png` | `nano_first_frame.png` |
| Preview | `preview/<any>.png` | `preview/thumb_01.png` |

### API for Render Discovery

```
GET /api/shot-renders?shotId=SHOT_01&project=default
```

Response:
```json
{
  "renders": {
    "seedream": {
      "A": { "first": "/path/to/seedream_A_first.png", "last": "/path/to/seedream_A_last.png" },
      "B": { "first": "/path/to/seedream_B_first.png", "last": "/path/to/seedream_B_last.png" }
    },
    "kling": {
      "A": "/path/to/kling_option_A.mp4"
    }
  }
}
```

---

## 3. Previs Map Configuration

The previs map controls how references are selected during generation for each shot.

### Reference Modes

| Mode | Behavior |
|------|----------|
| `canon` | Uses character + location references from `reference/` directories |
| `continuity` | Uses previous shot's last frame as primary reference |
| `custom` | Uses manually selected references from `selectedReferences` array |
| `none` | No references — prompt-only generation |

### When to Use Each Mode

- **canon**: First shot in a sequence, or when resetting visual baseline
- **continuity**: Most shots — maintains visual flow between adjacent shots
- **custom**: When specific reference images are needed (e.g., a particular pose)
- **none**: For abstract or purely text-driven generation

### Continuity Chain

When `continuityDisabled: false` and `referenceMode: "continuity"`:
1. System looks up the previous shot in editorial order
2. Finds the selected variation's last frame
3. Includes it as the first reference image
4. Remaining slots filled by canon references

This creates a "visual chain" where each shot inherits context from the previous one.

---

## 4. Selection Assembly Process

### Initial Assembly

For a new project:

1. Read all shot IDs from `shot_list.json`
2. For each shot, check for rendered files
3. Create selection entries:
   - If renders exist: `selectedVariation: "A"`, `status: "rendered"`
   - If no renders: `selectedVariation: "none"`, `status: "not_rendered"`
4. Set all `reviewStatus` to "draft"
5. Build `editorialOrder` from shot_list order

### Updating Existing Storyboard

When updating a storyboard that already has entries:

1. Preserve existing selections, comments, review status, and locks
2. Add new shots that appear in shot_list but not in sequence
3. Remove orphaned entries (shots no longer in shot_list)
4. Update render file paths for shots with new renders
5. Do NOT change `selectedVariation` for shots that are locked or approved

---

## 5. Review Workflow

### Status Transitions

```
draft ──────→ in_review ──────→ approved
                    │
                    └──→ changes_requested ──→ (re-render/re-select) ──→ in_review
```

### Comment Format

```json
{
  "author": "Director Name",
  "text": "Feedback text about this shot",
  "timestamp": "2026-02-17T12:00:00.000Z"
}
```

Comments are append-only — never delete existing comments when updating.

### Assignee

The `assignee` field tracks who is responsible for a shot:
- Empty string = unassigned
- Set to a name when review begins
- Clear when review is complete

### Locking

When `locked: true`:
- `selectedVariation` cannot be changed
- `reviewStatus` cannot be changed
- New comments can still be added
- Only set locked when a shot is finalized for export

---

## 6. Editorial Ordering

### Default Strategy

Match `shot_list.json` order — shots play in the sequence they were designed:

```json
"editorialOrder": ["SHOT_01", "SHOT_02", "SHOT_03", "SHOT_04"]
```

### Reordering for Narrative

Shots can be reordered for creative effect:
- **Flashback structure**: Move a later shot earlier for emotional contrast
- **Parallel editing**: Interleave shots from different locations
- **Emphasis**: Repeat a shot ID for double-take effect (same shot plays twice)

### Music Section Grouping

For rough-cut assembly, group shots by music section:

```
Intro: SHOT_01, SHOT_02
Verse 1: SHOT_03, SHOT_04, SHOT_05, SHOT_06
Chorus 1: SHOT_07, SHOT_08, SHOT_09, SHOT_10
```

---

## 7. Readiness Report

The readiness report validates that all dependencies are met for each shot.

### What It Checks

- Shot has rendered files
- Shot has a selected variation
- Selected variation has actual render files
- Reference images exist for characters/locations in the shot
- Prompt files exist for the shot
- No lint errors for the shot's prompts

### Report Structure

```json
{
  "timestamp": "2026-02-17T00:00:00.000Z",
  "totalShots": 10,
  "ready": 8,
  "notReady": 2,
  "shots": [
    {
      "shotId": "SHOT_01",
      "ready": true,
      "checks": {
        "hasRenders": true,
        "hasSelection": true,
        "hasPrompts": true,
        "hasReferences": true
      }
    }
  ]
}
```

---

## 8. Filmstrip Playback

The storyboard filmstrip view plays through selected shots in editorial order:

- Shows first frame → last frame for each shot in sequence
- Speed options: 2s, 4s, 6s, 8s (real-time) per frame
- Music playback synced to slideshow
- Keyboard shortcuts: Arrow keys (navigate), Space (play/pause), M (music toggle)

### Frame Collection Logic

1. Get shots in editorial order
2. Filter to shots with `selectedVariation` not "none"
3. For each shot, fetch first + last frame for the selected variation
4. Build flat frame array: [SHOT_01_first, SHOT_01_last, SHOT_02_first, SHOT_02_last, ...]
5. Display in sequence with auto-advance

---

## 9. Export Considerations

When the storyboard is finalized:

- All shots should be "approved" or "locked"
- Editorial order reflects final sequence
- Music file is referenced for timing
- Render files are at correct paths
- The sequence can be exported for video editing (CapCut, Premiere, etc.)

### Export Checklist

- [ ] All shots have rendered files
- [ ] All shots have selected variations
- [ ] Editorial order is final
- [ ] Review status is "approved" for all shots
- [ ] Music file is present and referenced
- [ ] No readiness warnings remain
