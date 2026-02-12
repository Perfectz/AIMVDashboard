---
name: step1-theme-concept
description: Fill out Step 1 (Project Theme & Concept) for AIMVDashboard projects by generating and saving concept, inspiration, mood, and genre content. Use when asked to complete or update Step 1 fields, bootstrap project vision text, or write Step 1 files for a project.
---

# Step 1 Theme & Concept Skill

Complete Step 1 by producing and saving all four page fields for a target project:

- `music/concept.txt`
- `music/inspiration.txt`
- `music/mood.txt`
- `music/genre.txt`

## Inputs to gather

Collect or infer these inputs before writing content:

1. Project id (default to `default` if missing)
2. Song/artist context (if available)
3. Narrative concept
4. Visual references/inspirations
5. Emotional tone/mood
6. Visual genre/style

If context is incomplete, create concise, production-ready placeholders and clearly mark assumptions.

## Preferred execution path

Use the bundled script to save all Step 1 files in one call.

```bash
python3 skills/step1-theme-concept/scripts/fill_step1.py \
  --project default \
  --concept "A lone dancer crosses a rain-soaked neon city while memories flicker as holograms." \
  --inspiration "Blade Runner 2049 lighting, Wong Kar-wai intimacy, glitch-art overlays." \
  --mood "Melancholic but hopeful; intimate, nocturnal, cinematic." \
  --genre "Cinematic synthwave, neon-noir, surreal urban dreamscape."
```

## Quality bar for generated text

Follow `references/step1-writing-guide.md`.

Minimum quality checks before saving:

1. Each field is non-empty.
2. Each field is specific (avoid purely generic adjectives).
3. `concept` describes subject + action + visual motif.
4. `inspiration` includes at least 2 concrete references.
5. `mood` includes emotional polarity and energy.
6. `genre` describes both medium style and visual treatment.

## Validation after save

Verify files exist and contain non-empty content:

```bash
wc -c projects/<project-id>/music/concept.txt \
     projects/<project-id>/music/inspiration.txt \
     projects/<project-id>/music/mood.txt \
     projects/<project-id>/music/genre.txt
```

## Optional API path

If `npm run serve` is already running, you may also save via:

- `POST /api/save/concept`
- `POST /api/save/inspiration`
- `POST /api/save/mood`
- `POST /api/save/genre`

Prefer the script for deterministic, offline operation.


Mark Step 1 complete only when all four files exist and are non-empty.
