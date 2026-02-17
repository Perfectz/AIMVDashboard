---
name: step5-shots-prompts
description: Fill out Step 5 (Shots/Prompts) for AIMVDashboard by compiling shot prompts, indexing them, and validating readiness in the shots page. Use when asked to complete or verify Step 5 prompt artifacts.
---

# Step 5: Shots & Prompts Skill

Complete prompt outputs so the Step 5 page has fully usable shot content for all target platforms. This step transforms canon data (characters, locations, style, cinematography) and shot intent into standalone, platform-specific prompts with A/B/C/D camera variations.

## Prerequisites

- Steps 3-4 must be complete:
  - `projects/<project-id>/bible/characters.json` — character identity anchors
  - `projects/<project-id>/bible/locations.json` — location identity anchors
  - `projects/<project-id>/bible/visual_style.json` — style rules + negative prompt
  - `projects/<project-id>/bible/cinematography.json` — camera rules + constraints
  - `projects/<project-id>/bible/shot_list.json` — shot sequence with timing + intent
  - `projects/<project-id>/reference/` — reference image libraries (for generation)

## Required Artifacts

- Shot prompt files under `projects/<project-id>/prompts/` organized by platform:
  - `prompts/kling/SHOT_XX_option_A.txt` through `option_D.txt`
  - `prompts/seedream/SHOT_XX_option_A.txt` through `option_C.txt`
  - `prompts/nanobanana/SHOT_XX_option_A.txt` (static frame prompts)
  - `prompts/suno/music_prompt.txt` (music generation prompt)
- `projects/<project-id>/prompts_index.json` — compiled index of all prompts

## Execute

1. Resolve project ID. Default to `default` if not specified.
2. Load all canon data:
   - Characters from `bible/characters.json`
   - Locations from `bible/locations.json`
   - Visual style from `bible/visual_style.json`
   - Cinematography from `bible/cinematography.json`
   - Shot list from `bible/shot_list.json`
3. For each shot in the shot list, generate prompts following the Prompt Construction Algorithm below.
4. Generate 3-4 variations per shot (A/B/C minimum, D optional).
5. Write prompt files to `prompts/<platform>/`.
6. Regenerate the prompt index:

```bash
npm run index -- --project <project-id>
```

7. Verify each shot in `shot_list.json` appears in `prompts_index.json`.

### API Path (alternative)

If the server is running, generate prompts via the agent endpoint:

- `POST /api/agents/prompt-runs?project=<id>` — triggers prompt compilation for all shots

## Prompt Construction Algorithm

For each shot, follow these steps:

### Step A: Extract Shot Context

```
shot = shot_list.shots[i]
characters = shot.characters.map(c => lookup in characters.json)
location = lookup shot.location.id in locations.json
timing = shot.timing
intent = shot.intent
cameraIntent = shot.cameraIntent
```

### Step B: Build Character Identity Anchors

For each character in the shot:

**Primary characters** (full anchor):
```
[physicalCore.age] [physicalCore.build], [physicalCore.skinTone].
[faceSignature.structure], [faceSignature.eyes], [faceSignature.hair].
[costume.default.description] with [costume.default.signature].
```

**Secondary characters** (compact anchor):
```
[physicalCore.age] [physicalCore.build], [faceSignature.hair], [costume.default.signature].
```

### Step C: Build Location Anchor

```
[setting.type], [setting.scale], [setting.architecture].
[atmosphere.lighting]. [atmosphere.weather].
Colors: [atmosphere.colorPalette].
Visual anchors: [ALL items from visualAnchors array].
```

### Step D: Build Prompt Body (platform-specific)

See Platform-Specific Best Practices below for each platform's structure.

### Step E: Apply Negative Prompt

```
[visual_style.negativePromptBase] + [platform-specific additions]
```

### Step F: Apply Variation Strategy

| Variation | Lens | Angle | Movement | Composition |
|-----------|------|-------|----------|-------------|
| A | Default (35mm anamorphic) | Eye-level | Shot's intended movement | Rule of thirds |
| B | 50mm standard | Low angle | Static hold or slower variant | Centered |
| C | 24mm wide | High angle | Different allowed movement | Leading lines |
| D | 85mm portrait | Eye-level | Tracking or orbit | Depth layering |

**What NEVER varies across A/B/C/D**:
- Character identity anchors (physical, face, costume)
- Location visual anchors and color palette
- Action/intent
- Visual style and forbidden elements
- Negative prompt

### Step G: Write Prompt File

Each file follows this header format:

```
=== SHOT {ID} - Variation {VAR} ({LABEL}) ===
Shot: {ID} | Section: {SECTION} | Time: {START}s-{END}s ({DURATION}s)
Version: 2026-02-08
Variation: {VAR}

--- {PLATFORM} PROMPT ---
{PROMPT BODY}

--- NEGATIVE PROMPT ---
{NEGATIVE PROMPT}

--- DIRECTOR NOTES ---
{intent.why}. Emotional beat: {intent.emotionalBeat}.
```

## Platform-Specific Best Practices

### Kling 3.0 (Video)

- **Max length**: 500 characters for prompt body
- **File pattern**: `prompts/kling/SHOT_XX_option_[A-D].txt`
- **Focus**: Motion, camera movement, action transitions over 8 seconds

**Prompt Structure**:
1. Shot size + lens feel (e.g., "medium close-up, 35mm anamorphic")
2. Camera movement (e.g., "slow push in") or "static hold"
3. Character identity anchor (compact ~80 chars)
4. Action in one continuous take
5. Location anchor (compact ~60 chars)
6. Lighting and color treatment
7. Style tag: "Photorealistic cinematic style, natural lighting, coherent motion over 8s."
8. Negative prompt line

**Forbidden in Kling prompts**:
- Scene cuts or location changes
- Multiple actions ("she walks then sits")
- Camera movements from `cinematography.json.cameraMovement.forbidden`
- Motion verbs that imply teleportation

### SeedDream 4.5 (Image Pairs)

- **Max length**: 2000 characters total
- **File pattern**: `prompts/seedream/SHOT_XX_option_[A-C].txt`
- **Focus**: Dual-frame state change

**Prompt Structure** ("Create 2 Images"):
```
Create 2 Images.

Image 1: [Complete scene setup]
[Character full identity anchor]
[Location with all visual anchors]
[Action state A — the starting moment]
[Camera: framing, lens, composition]
[Lighting and atmosphere]

Image 2: Same [character description], same location.
[What changed: emotional shift, subtle pose change, light change]
[Emotional beat: "emotional weight has shifted from X to Y"]
[Same camera framing maintained]
```

**SeedDream Rules**:
- Frame 1 = complete scene setup
- Frame 2 = same character/location + describe the shift
- Use "emotional weight has shifted" language, not forced expressions like "she smiles"
- All visual anchors from location must appear in both frames
- Character identity anchors must appear in both frames

**Variation Strategy**:
- A: Standard framing, full descriptions
- B: Intimate close-up ("Extreme close-up, shallow DOF"), trim location detail, push camera in
- C: Wide cinematic ("Ultra-wide cinematic, IMAX format"), full location, environment focus

### Nano Banana Pro 3 (Static Images)

- **File pattern**: `prompts/nanobanana/SHOT_XX_option_[A-D].txt`
- **Focus**: Single static frame, zero motion

**Required Elements**:
- Static scene composition only
- Character identity anchors
- Location visual anchors
- Style and lighting descriptors
- Composition language (foreground/background/depth)
- Negative prompt including motion verbs

**Motion Verb Conversion Table**:

| Motion Verb | Static Equivalent |
|------------|-------------------|
| walking | mid-stride pose, one foot forward |
| running | frozen sprint position, hair swept back |
| turning | angled stance, looking over shoulder |
| falling | suspended in air, body tilted |
| dancing | frozen dance pose, arms extended |
| reaching | arm extended toward object |
| sitting down | seated position |
| looking around | head slightly turned, eyes directed |

### Suno (Music)

- **File pattern**: `prompts/suno/music_prompt.txt`
- **Focus**: Pure musical language — no visual terms

**Structure**: Genre → Mood arc → Tempo/BPM → Instrumentation → Production style → Vocal style → Song structure

**Forbidden terms**: camera, lens, shot, frame, light, shadow, neon, scene, character. See Step 2 skill for the complete Musical Translation Guide.

## Quality Checks

Before saving prompts, verify for each file:

1. Prompt matches platform-specific format (correct sections, within character limit).
2. All required identity anchors are present (character + location).
3. No cross-shot references ("as seen in SHOT_01", "continuing from the previous shot").
4. Negative prompt is present and includes `visual_style.json.negativePromptBase`.
5. No forbidden camera movements appear in Kling prompts.
6. Nano Banana prompts contain zero motion verbs.
7. Suno prompts contain zero visual/camera language.
8. Variations A/B/C/D differ only in camera/framing, not in identity anchors or action.
9. All prompts include version/date metadata in the file header.

## Completeness Check

```bash
project=default
node -e "
  const fs = require('fs');
  const base = 'projects/' + process.env.P + '/';
  let ok = true;
  // Check prompts_index.json
  const idxPath = base + 'prompts_index.json';
  if (!fs.existsSync(idxPath)) { console.error('Missing: prompts_index.json'); process.exit(1); }
  try {
    const idx = JSON.parse(fs.readFileSync(idxPath, 'utf8'));
    if (!Array.isArray(idx.shots) || idx.shots.length === 0) {
      console.error('No shots in prompts index'); ok = false;
    } else {
      console.log('Indexed shots: ' + idx.shots.length);
    }
  } catch (e) { console.error('Invalid index: ' + e.message); ok = false; }
  // Check shot_list coverage
  try {
    const shots = JSON.parse(fs.readFileSync(base + 'bible/shot_list.json', 'utf8'));
    const idx = JSON.parse(fs.readFileSync(idxPath, 'utf8'));
    const indexedIds = new Set((idx.shots || []).map(s => s.id || s.shotId));
    for (const shot of (shots.shots || [])) {
      if (!indexedIds.has(shot.id)) {
        console.error('Shot ' + shot.id + ' not in prompts index'); ok = false;
      }
    }
    if (ok) console.log('All shots indexed: OK');
  } catch (e) { console.error('Coverage check: ' + e.message); }
  // Check prompt directories exist
  const promptDir = base + 'prompts/';
  if (fs.existsSync(promptDir)) {
    const dirs = fs.readdirSync(promptDir).filter(f => fs.statSync(promptDir + f).isDirectory());
    console.log('Prompt directories: ' + dirs.join(', '));
  }
  if (!ok) process.exit(1);
  console.log('Step 5 complete.');
" P="$project"
```

## LLM Guidance

- Prompt text must be standalone. Never reference "the previous shot" or "as established earlier." Each prompt must contain all visual information needed to render the shot in isolation.
- Output format: Raw prompt text with section headers as shown in the file format above. No markdown code fences around the content.
- The most common mistake is forgetting identity anchors. Every prompt must describe the character and location as if the reader has never seen them before.
- When generating many prompts, process in batches of 5-10 shots to maintain quality.
- After generating all prompts, always run `npm run index -- --project <id>` to rebuild the index.
- Reference `skills/_shared/references/universal-prompt-rules.md` for platform constraints and identity anchor methodology.
- Reference `references/system-prompt-best-practices.md` for detailed per-platform guidance.

Step 5 is complete only when the prompts index is populated and every shot has prompt files for the target platforms.
