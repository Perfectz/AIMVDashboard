---
name: step3-content-blueprint
description: Fill out Step 3 (Content Blueprint) for AIMVDashboard by completing script, YouTube script, transcript, asset plan, characters, locations, style, and cinematography JSON canon files. Use when asked to complete or validate Step 3 page tabs.
---

# Step 3: Content Blueprint Skill

Complete all Step 3 canon JSON files for a target project. This step creates the "bible" — the locked creative identity that every downstream prompt, reference, and generation task draws from. Characters, locations, visual style, and cinematography defined here become the identity anchors embedded in every AI-generated frame.

## Prerequisites

- Steps 1-2 should be complete. Read these files for context:
  - `projects/<project-id>/music/concept.txt` — narrative concept
  - `projects/<project-id>/music/inspiration.txt` — creative references
  - `projects/<project-id>/music/mood.txt` — emotional tone
  - `projects/<project-id>/music/genre.txt` — visual style
  - `projects/<project-id>/music/analysis.json` — song structure and timing (drives shot timing)

## Required Artifacts

All files live in `projects/<project-id>/bible/`:

| File | Purpose | Priority |
|------|---------|----------|
| `characters.json` | Character identity anchors | Critical |
| `locations.json` | Location identity anchors | Critical |
| `visual_style.json` | Global visual identity | Critical |
| `cinematography.json` | Camera rules and constraints | Critical |
| `shot_list.json` | Shot sequence with timing and intent | Critical |
| `youtube_script.json` | YouTube content structure | Optional |
| `transcript.json` | Voiceover/dialogue blocks | Optional |
| `asset_manifest.json` | Asset tracking plan | Optional |

## Execute

1. Resolve project ID. Default to `default` if not specified.
2. Read Step 1-2 outputs for creative context.
3. Fill each JSON file following the schemas below. Produce production-ready content, not TODO placeholders.
4. Maintain cross-file ID coherence: character and location IDs used in `shot_list.json` must exist in `characters.json` and `locations.json`.
5. Save each file via the API or direct file write.

### API Paths

If the server is running (`npm run serve`), save via HTTP:

- `POST /api/save/canon/characters?project=<id>` — body: `{ "content": "<JSON string>" }`
- `POST /api/save/canon/locations?project=<id>` — body: `{ "content": "<JSON string>" }`
- `POST /api/save/canon/style?project=<id>` — body: `{ "content": "<JSON string>" }`
- `POST /api/save/canon/cinematography?project=<id>` — body: `{ "content": "<JSON string>" }`
- `POST /api/save/canon/script?project=<id>` — body: `{ "content": "<JSON string>" }`
- `POST /api/save/canon/youtubeScript?project=<id>` — body: `{ "content": "<JSON string>" }`
- `POST /api/save/canon/transcript?project=<id>` — body: `{ "content": "<JSON string>" }`
- `POST /api/save/canon/assets?project=<id>` — body: `{ "content": "<JSON string>" }`

### Schema: characters.json

```json
{
  "version": "2026-02-08",
  "characters": [
    {
      "id": "CHAR_HER",
      "name": "Display Name",
      "physicalCore": {
        "age": "late 20s",
        "build": "slender, graceful",
        "height": "average",
        "skinTone": "warm brown skin with subtle golden undertones",
        "additionalFeatures": ["Movements carry fluid quality"]
      },
      "faceSignature": {
        "structure": "soft oval face with defined cheekbones",
        "eyes": "deep brown eyes, large and expressive",
        "hair": "long dark hair flowing past shoulders",
        "distinctiveFeatures": ["Eyes communicate volumes without dialogue"]
      },
      "costume": {
        "default": {
          "description": "Futuristic draped clothing in warm earth tones",
          "colorPalette": ["warm terracotta", "faded gold", "teal"],
          "signature": "Asymmetric draped outer layer"
        },
        "variations": []
      },
      "allowedVariation": {
        "lighting": true,
        "expression": true,
        "pose": true,
        "distance": true
      },
      "referenceImages": ["ref_01.png", "ref_02.png", "ref_03.png"],
      "notes": ""
    }
  ]
}
```

**Rules**: ID pattern `CHAR_<UPPER_SNAKE>`. Required fields: id, name, physicalCore (age, build, height, skinTone), faceSignature (structure, eyes, hair), costume.default (description, colorPalette, signature). The `costume.default.signature` is the ONE item that MUST appear in every prompt.

### Schema: locations.json

```json
{
  "version": "2026-02-08",
  "locations": [
    {
      "id": "LOC_WATER_STILL",
      "name": "Still Platform",
      "setting": {
        "type": "floating platform in submerged sanctuary",
        "scale": "intimate, enclosed yet open",
        "architecture": "Futuristic curves softened by water physics",
        "timeOfDay": "timeless, perpetual dim twilight"
      },
      "atmosphere": {
        "lighting": "Dim ambient glow from refracted light",
        "weather": "Submerged environment with slow particles",
        "colorPalette": ["muted teal", "deep blue-green", "soft cyan"],
        "mood": "Calm, dim, quietly oppressive yet safe"
      },
      "visualAnchors": [
        "Slow-moving luminous particles",
        "Caustic light refractions on surfaces",
        "Semi-translucent architectural walls"
      ],
      "allowedVariation": {
        "cameraAngle": true,
        "timeOfDay": false,
        "crowdDensity": true,
        "weatherIntensity": true
      },
      "referenceImages": ["ref_01.png", "ref_02.png", "ref_03.png"],
      "notes": ""
    }
  ]
}
```

**Rules**: ID pattern `LOC_<UPPER_SNAKE>`. Required fields: id, name, setting (type, scale, architecture), atmosphere (lighting, weather, colorPalette, mood), visualAnchors (min 2 items). ALL items in `visualAnchors` MUST appear in every prompt set at this location.

### Schema: visual_style.json

```json
{
  "version": "2026-02-08",
  "overallStyle": "Cinematic, futuristic, surreal music video aesthetic",
  "influences": [
    { "source": "Blade Runner 2049", "aspect": "Environmental mood and atmosphere" },
    { "source": "Denis Villeneuve", "aspect": "Widescreen scale, minimal dialogue" }
  ],
  "colorPalette": {
    "primary": ["muted teal", "volcanic orange-red", "charcoal black"],
    "accent": ["soft cyan glow", "ember yellow-white"]
  },
  "lightingSignature": {
    "quality": "Cinematic dramatic with world-specific character",
    "sources": ["refracted ambient light", "caustic patterns"],
    "contrast": "high",
    "signature": "World-specific lighting personality"
  },
  "texture": {
    "quality": "Cinematic realism with slight stylization",
    "emphasis": ["smooth organic curves", "refracted light effects"]
  },
  "atmosphere": {
    "depth": "Particle-filled environments with layered translucency",
    "effects": ["floating particles", "caustic light", "atmospheric haze"]
  },
  "forbiddenElements": [
    "cartoon or comedy style",
    "flat lighting",
    "plastic or artificial skin",
    "distorted anatomy",
    "visible text, logos, watermarks",
    "camera shake or handheld wobble"
  ],
  "negativePromptBase": "no text, logos, watermarks, distorted anatomy, cartoon style, flat lighting, plastic skin",
  "notes": ""
}
```

**Rules**: Required fields: overallStyle, influences (at least 1), colorPalette (primary + accent), lightingSignature, forbiddenElements (at least 3), negativePromptBase. The `negativePromptBase` is appended to EVERY generated prompt. `forbiddenElements` items must NEVER appear in any prompt.

### Schema: cinematography.json

```json
{
  "version": "2026-02-08",
  "shotDuration": { "default": 8, "unit": "seconds" },
  "cameraMovement": {
    "philosophy": "Smooth cinematic motion — deliberate and motivated",
    "allowed": [
      { "type": "slow glide", "description": "Camera drifts smoothly", "speed": "slow" },
      { "type": "dolly tracking", "description": "Tracks subject movement", "speed": "medium" },
      { "type": "static hold", "description": "Locked camera, no movement", "speed": "n/a" }
    ],
    "forbidden": ["shaky cam", "crash zoom", "whip pan", "dutch angle"]
  },
  "lenses": {
    "available": [
      { "focalLength": "24mm wide", "use": "Establishing shots", "effect": "Environmental immersion" },
      { "focalLength": "35mm anamorphic", "use": "Default lens", "effect": "Cinematic widescreen" },
      { "focalLength": "50mm standard", "use": "Dialogue/interaction", "effect": "Natural perspective" },
      { "focalLength": "85mm portrait", "use": "Intimate close-ups", "effect": "Shallow depth, compression" }
    ],
    "default": "35mm anamorphic"
  },
  "framing": {
    "compositions": [
      { "type": "rule of thirds", "use": "Character positioned on thirds" },
      { "type": "centered", "use": "Symmetrical power compositions" }
    ],
    "shotSizes": [
      { "type": "extreme wide", "description": "Full environment establishing" },
      { "type": "wide", "description": "Character in full environment context" },
      { "type": "medium", "description": "Character from waist up" },
      { "type": "medium close-up", "description": "Head and shoulders" },
      { "type": "close-up", "description": "Face fills frame" },
      { "type": "extreme close-up", "description": "Detail of eyes, hands, object" }
    ]
  },
  "constraints": [
    { "rule": "One action per shot", "enforcement": "CRITICAL" },
    { "rule": "No scene cuts within a shot", "enforcement": "CRITICAL" },
    { "rule": "No location changes within a shot", "enforcement": "CRITICAL" }
  ]
}
```

**Rules**: Required: shotDuration, cameraMovement (allowed + forbidden), lenses (available + default), constraints. "CRITICAL" enforcement rules are hard requirements that must never be violated in prompts. Forbidden camera movements must never appear in any Kling prompt.

### Schema: shot_list.json

```json
{
  "version": "2026-02-08",
  "shots": [
    {
      "id": "SHOT_01",
      "shotNumber": 1,
      "timing": {
        "start": 0, "duration": 8, "end": 8,
        "musicSection": "intro"
      },
      "intent": {
        "what": "Character stands on platform looking upward",
        "why": "Establish the underwater world and protagonist",
        "emotionalBeat": "Contemplative stillness → quiet wonder"
      },
      "characters": [
        { "id": "CHAR_HER", "prominence": "primary", "action": "standing, gazing upward", "costumeVariation": "DEFAULT" }
      ],
      "location": {
        "id": "LOC_WATER_STILL",
        "specificArea": "center platform",
        "timeOverride": null
      },
      "cameraIntent": {
        "feeling": "intimate and personal",
        "movement": "slow push in",
        "focus": "subject"
      },
      "transitionTo": "hard cut",
      "notes": "",
      "status": "draft"
    }
  ]
}
```

**Rules**: ID pattern `SHOT_<2-3 digits>`. timing.musicSection links to analysis.json sections. characters[].id must exist in characters.json. location.id must exist in locations.json. Each shot represents ONE continuous 8-second action. Status values: draft, approved, prompts_generated, rendered, final.

### Schema: youtube_script.json

```json
{
  "version": "2026-02-08",
  "hook": "Opening hook text",
  "segments": [
    { "id": "seg_01", "title": "Segment Title", "goals": [], "retentionBeats": [], "duration": 30 }
  ],
  "cta": "Call to action text",
  "titleOptions": ["Title Option 1", "Title Option 2"],
  "thumbnailConcepts": ["Concept 1", "Concept 2"]
}
```

### Schema: transcript.json

```json
{
  "version": "2026-02-08",
  "blocks": [
    { "id": "block_01", "type": "voiceover", "startSec": 0, "endSec": 8, "text": "Transcript text" }
  ]
}
```

### Schema: asset_manifest.json

```json
{
  "version": "2026-02-08",
  "assets": [
    { "id": "asset_01", "name": "Asset Name", "type": "video", "status": "needed", "owner": "", "source": "", "usedIn": ["SHOT_01"] }
  ]
}
```

## Platform-Specific Best Practices

Character descriptions must be detailed enough to serve as identity anchors in all downstream platforms:

- **For Kling (500 char limit)**: physicalCore + faceSignature must compress to ~80 chars. Write descriptions that are concise but distinctive.
- **For SeedDream (2000 char limit)**: Full descriptions can be included. Write with enough detail for visual fidelity.
- **For Nano Banana**: Descriptions support static reference image generation. Include clear pose and framing language.

Location visual anchors must be specific enough that each platform can render them:

- **Avoid vague anchors**: "nice lighting" (tells the AI nothing)
- **Use specific anchors**: "caustic light refractions rippling across translucent walls" (renders distinctively)

## Quality Checks

Before saving, verify:

1. All 8 JSON files exist and parse as valid JSON.
2. `characters.json`: Every character has id, name, physicalCore (age, build, height, skinTone), faceSignature (structure, eyes, hair), costume.default (description, colorPalette, signature).
3. `locations.json`: Every location has id, name, setting (type, scale, architecture), atmosphere (lighting, weather, colorPalette), visualAnchors (min 2 items).
4. `visual_style.json`: Has overallStyle, influences, colorPalette, lightingSignature, forbiddenElements, negativePromptBase.
5. `cinematography.json`: Has shotDuration, cameraMovement (allowed + forbidden), lenses, constraints with CRITICAL rules.
6. `shot_list.json`: Every shot has id, timing, intent, characters, location, cameraIntent.
7. **Cross-file coherence**: Every character ID in shot_list exists in characters.json. Every location ID in shot_list exists in locations.json. timing.musicSection values align with analysis.json section IDs.
8. No placeholder text ("TBD", "TODO", "fill in later") in any field.
9. All ID patterns are correct: `CHAR_<UPPER>`, `LOC_<UPPER>`, `SHOT_<DIGITS>`.

## Completeness Check

```bash
project=default
node -e "
  const fs = require('fs');
  const base = 'projects/' + process.env.P + '/bible/';
  const files = ['shot_list.json','youtube_script.json','transcript.json','asset_manifest.json','characters.json','locations.json','visual_style.json','cinematography.json'];
  let ok = true;
  for (const f of files) {
    const p = base + f;
    if (!fs.existsSync(p)) { console.error('Missing: ' + f); ok = false; continue; }
    try { JSON.parse(fs.readFileSync(p, 'utf8')); console.log('OK: ' + f); }
    catch (e) { console.error('Invalid JSON: ' + f + ' — ' + e.message); ok = false; }
  }
  // Cross-reference check
  try {
    const chars = JSON.parse(fs.readFileSync(base + 'characters.json', 'utf8'));
    const locs = JSON.parse(fs.readFileSync(base + 'locations.json', 'utf8'));
    const shots = JSON.parse(fs.readFileSync(base + 'shot_list.json', 'utf8'));
    const charIds = new Set((chars.characters || []).map(c => c.id));
    const locIds = new Set((locs.locations || []).map(l => l.id));
    for (const shot of (shots.shots || [])) {
      for (const c of (shot.characters || [])) {
        if (!charIds.has(c.id)) { console.error('Shot ' + shot.id + ' references unknown character: ' + c.id); ok = false; }
      }
      if (shot.location && !locIds.has(shot.location.id)) {
        console.error('Shot ' + shot.id + ' references unknown location: ' + shot.location.id); ok = false;
      }
    }
    if (ok) console.log('Cross-references: OK');
  } catch (e) { console.error('Cross-ref check skipped: ' + e.message); }
  if (!ok) process.exit(1);
  console.log('Step 3 complete.');
" P="$project"
```

## LLM Guidance

- Output format: Valid JSON only for each file. No markdown code fences. No prose before or after the JSON.
- The most critical files are characters.json, locations.json, visual_style.json, and shot_list.json. These feed directly into prompt generation. Invest most effort here.
- Write character descriptions that are vivid and distinctive. If two characters have identical descriptions, prompts will render them identically.
- Visual anchors for locations should be unique and renderable. Each anchor should describe something an image generation model can draw.
- Align shot timing with `analysis.json` sections. Each shot's musicSection should correspond to a section ID from the analysis.
- For large projects (20+ shots), process in batches of 10 to manage complexity.
- Reference `skills/_shared/references/universal-prompt-rules.md` for the full canon data model.
- Reference `references/canon-authoring-guide.md` for deep schema documentation and examples.

Step 3 is complete only when every file exists, parses as valid JSON, and cross-file IDs are coherent.
