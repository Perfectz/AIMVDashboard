---
name: step5-shots-prompts
description: Fill out Step 5 (Shots/Prompts) for AIMVDashboard by compiling shot prompts, indexing them, and validating readiness in the shots page. Use when asked to complete or verify Step 5 prompt artifacts.
---

# Step 5 Shots & Prompts Skill

Complete prompt outputs so the Step 5 page has fully usable shot content.

Required artifacts:

- Shot prompt files under `projects/<project-id>/prompts/` (Kling/Nano Banana/Suno as applicable)
- `projects/<project-id>/prompts_index.json`

## Execute

1. Resolve project id (default `default`).
2. Ensure Step 3 canon data is complete before prompt compilation.
3. Load and apply `references/system-prompt-best-practices.md` for all systems used in this project (Kling, Nano Banana, Suno, SeedDream).
4. Generate or update shot prompts for all required shots/options using system-specific best-practice structure.
5. Regenerate prompt index:

```bash
npm run index -- --project <project-id>
```

6. Ensure each shot expected by `shot_list.json` appears in `prompts_index.json`.

## System-specific quality checks

Before final save:

- Kling prompts include camera/framing/movement + negative constraints.
- Nano Banana prompts are static-frame descriptions (no motion timeline language).
- Suno prompts describe music only (no visual/camera terms).
- SeedDream prompts include composition + rendering intent + exclusions.

## Completeness check

```bash
project=default
node -e 'const fs=require("fs");const idx=JSON.parse(fs.readFileSync(`projects/${process.env.P}/prompts_index.json`,`utf8`));if(!Array.isArray(idx.shots)||idx.shots.length===0){console.error("No shots in prompts index");process.exit(1)}console.log(`shots indexed: ${idx.shots.length}`)' \
  P="$project"
```

Step 5 is complete only when the index is populated and representative prompt files exist for indexed shots.
