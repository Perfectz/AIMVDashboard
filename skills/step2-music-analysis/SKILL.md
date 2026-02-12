---
name: step2-music-analysis
description: Fill out Step 2 (Upload Music & Analysis) for AIMVDashboard by ensuring music upload plus Suno prompt, song info, and analysis JSON are all complete. Use when asked to complete or verify Step 2 page data.
---

# Step 2 Music & Analysis Skill

Complete all Step 2 artifacts for one project.

Required artifacts in `projects/<project-id>/music/`:

- One `.mp3` file
- `suno_prompt.txt`
- `song_info.txt`
- `analysis.json`

## Execute

1. Resolve project id (default `default`).
2. Ensure one MP3 exists in `projects/<project-id>/music/`.
3. Load and apply `references/suno-and-analysis-prompt-best-practices.md`.
4. Write `suno_prompt.txt` with final generation prompt text (music-only language).
5. Write `song_info.txt` with duration/BPM/structure notes.
6. If using another AI to generate analysis content, require strict JSON-only output matching required keys.
7. Write `analysis.json` with required fields:
   - `version`
   - `duration`
   - `bpm`
   - `sections`

## Prompt quality checks

Before final save:

- Suno prompt includes genre/mood/tempo/instrumentation/structure details.
- Suno prompt excludes visual/camera language.
- Analysis prompt (if used) requests JSON-only output and required keys.

## Completeness check

Run:

```bash
project=default
ls -1 "projects/$project/music"
node -e 'const fs=require("fs");const p="projects/default/music/analysis.json";const j=JSON.parse(fs.readFileSync(p,"utf8"));const req=["version","duration","bpm","sections"];const miss=req.filter(k=>!(k in j));if(miss.length){console.error("Missing:",miss.join(","));process.exit(1)}console.log("analysis.json schema keys ok")'
```

Mark Step 2 complete only when all four artifacts are present and non-empty.
