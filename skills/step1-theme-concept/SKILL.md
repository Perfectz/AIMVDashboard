---
name: step1-theme-concept
description: Fill out Step 1 (Project Theme & Concept) for AIMVDashboard projects by generating and saving concept, inspiration, mood, and genre content. Use when asked to complete or update Step 1 fields, bootstrap project vision text, or write Step 1 files for a project.
---

# Step 1: Theme & Concept Skill

Complete Step 1 by producing and saving all four vision fields for a target project. These fields define the creative foundation that cascades into every downstream step — music direction, canon design, prompt generation, and storyboard assembly.

## Prerequisites

- A project directory must exist at `projects/<project-id>/`.
- If starting fresh, create the project first using the dashboard UI or `POST /api/projects` with body `{ "name": "My Project" }`.

## Required Artifacts

All files live in `projects/<project-id>/music/`:

| File | Purpose |
|------|---------|
| `concept.txt` | Central narrative concept: protagonist, action, visual world, arc |
| `inspiration.txt` | Concrete creative references and production direction |
| `mood.txt` | Emotional tone, energy level, and intensity |
| `genre.txt` | Musical-video genre and visual treatment style |

## Execute

1. Resolve project ID. Default to `default` if not specified.
2. Gather context: song/artist info, narrative concept, visual references, emotional tone, visual style. If context is incomplete, produce specific, production-ready content and clearly mark assumptions.
3. Write `concept.txt`:
   - 2-5 sentences describing the protagonist/subject, their action, the visual world, and one narrative arc or contrast (e.g., "isolation → connection").
   - Use specific nouns and concrete imagery. Avoid generic adjectives.
4. Write `inspiration.txt`:
   - At least 2 concrete references (films, directors, artists, art movements).
   - One sentence translating references into production direction (e.g., "Combine Villeneuve's scale with Wong Kar-wai's intimate color work").
5. Write `mood.txt`:
   - Name primary emotion and secondary emotion.
   - Include energy descriptor: low-burn, rising, explosive, restrained, oscillating.
   - Include intensity/temperature: intimate, vast, claustrophobic, expansive.
6. Write `genre.txt`:
   - Musical-video genre (e.g., "cinematic synthwave", "lo-fi hip-hop visual essay").
   - Visual style treatment (e.g., "anamorphic widescreen", "documentary handheld").
   - Camera/lighting texture in one phrase (e.g., "glossy anamorphic bloom", "gritty 16mm grain").
7. Verify cross-field coherence: mood should align with concept, genre should support the mood, inspiration should inform the visual treatment described in genre.

### Script Path (alternative)

Save all four files in one call using the bundled script:

```bash
python3 skills/step1-theme-concept/scripts/fill_step1.py \
  --project <project-id> \
  --concept "..." \
  --inspiration "..." \
  --mood "..." \
  --genre "..."
```

### API Path (alternative)

If the server is running (`npm run serve`), save via HTTP:

- `POST /api/save/concept?project=<id>` — body: `{ "content": "..." }`
- `POST /api/save/inspiration?project=<id>` — body: `{ "content": "..." }`
- `POST /api/save/mood?project=<id>` — body: `{ "content": "..." }`
- `POST /api/save/genre?project=<id>` — body: `{ "content": "..." }`

## Quality Checks

Follow `references/step1-writing-guide.md` for detailed guidance.

Before saving, verify:

1. Each field is non-empty and contains production-ready text (no "TBD" placeholders).
2. `concept` describes subject + action + visual motif + narrative arc.
3. `inspiration` includes at least 2 concrete references + 1 production direction sentence.
4. `mood` includes emotional polarity (primary + secondary) and energy level.
5. `genre` describes both musical-video genre and visual treatment with camera/lighting texture.
6. Cross-field coherence: concept themes echo in mood and genre; inspiration informs genre style.
7. No contradictory descriptors unless intentional and explained.

## Completeness Check

```bash
project=default
node -e "
  const fs = require('fs');
  const base = 'projects/' + process.env.P + '/music/';
  const files = ['concept.txt', 'inspiration.txt', 'mood.txt', 'genre.txt'];
  let ok = true;
  for (const f of files) {
    const p = base + f;
    if (!fs.existsSync(p)) { console.error('Missing: ' + f); ok = false; continue; }
    const s = fs.statSync(p).size;
    if (s === 0) { console.error('Empty: ' + f); ok = false; continue; }
    console.log('OK: ' + f + ' (' + s + ' bytes)');
  }
  if (!ok) process.exit(1);
  console.log('Step 1 complete.');
" P="$project"
```

## LLM Guidance

- Produce vivid, specific, production-ready text. Both OpenAI and Anthropic models should focus on concrete imagery over abstract descriptions.
- Output format: Plain text for each file. No markdown headings, no bullet points, no code fences. Write natural prose.
- These four fields cascade into every downstream step. Concept choices shape character design (Step 3). Mood choices shape music generation (Step 2). Genre choices shape prompt style (Step 5). Write with downstream impact in mind.
- If the user provides partial context (e.g., just a song title), infer reasonable creative choices and note assumptions explicitly.
- Reference `skills/_shared/references/universal-prompt-rules.md` for canon data model context.
- Reference `skills/_shared/references/llm-agnostic-patterns.md` for output format conventions.

Step 1 is complete only when all four files exist, are non-empty, and pass cross-field coherence review.
