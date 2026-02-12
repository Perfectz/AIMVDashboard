---
name: step3-content-blueprint
description: Fill out Step 3 (Content Blueprint) for AIMVDashboard by completing script, YouTube script, transcript, asset plan, characters, locations, style, and cinematography JSON canon files. Use when asked to complete or validate Step 3 page tabs.
---

# Step 3 Content Blueprint Skill

Complete all Step 3 canon JSON files for one project.

Required files in `projects/<project-id>/bible/`:

- `shot_list.json` (script)
- `youtube_script.json`
- `transcript.json`
- `asset_manifest.json`
- `characters.json`
- `locations.json`
- `visual_style.json`
- `cinematography.json`

## Execute

1. Resolve project id (default `default`).
2. Fill each JSON file with production-ready content (not TODO placeholders).
3. Keep identifiers consistent across files (character/location IDs used by shots must exist in canon files).
4. Ensure JSON parses cleanly.

## Completeness check

```bash
project=default
for f in shot_list.json youtube_script.json transcript.json asset_manifest.json characters.json locations.json visual_style.json cinematography.json; do
  node -e "JSON.parse(require('fs').readFileSync('projects/$project/bible/$f','utf8')); console.log('ok $f')"
done
```

Step 3 is complete only when every file exists, parses, and cross-file IDs are coherent.
