# Universal Prompt Rules

Shared rules for all AI generation platforms used in AIMVDashboard.
Every step skill should apply these rules when generating or validating prompts.

---

## 1. Canon Data Model

All creative decisions are locked in `projects/<project-id>/bible/` JSON files.
Prompts are compiled by merging canon definitions with shot-specific intent.

### characters.json

Each character entry requires:

| Field | Purpose |
|-------|---------|
| `id` | Unique ID, pattern `CHAR_<UPPER_SNAKE>` |
| `name` | Display name |
| `physicalCore.age` | Apparent age range |
| `physicalCore.build` | Body type description |
| `physicalCore.height` | Relative height |
| `physicalCore.skinTone` | Skin description |
| `faceSignature.structure` | Face shape, jawline |
| `faceSignature.eyes` | Color, shape, characteristics |
| `faceSignature.hair` | Style, color, movement |
| `costume.default.description` | Primary outfit |
| `costume.default.colorPalette` | Array of outfit colors |
| `costume.default.signature` | One item that MUST always appear |
| `allowedVariation` | What CAN change: lighting, expression, pose, distance |
| `referenceImages` | Array of 3 reference filenames |

### locations.json

Each location entry requires:

| Field | Purpose |
|-------|---------|
| `id` | Unique ID, pattern `LOC_<UPPER_SNAKE>` |
| `name` | Display name |
| `setting.type` | Environment type |
| `setting.scale` | Spatial scale |
| `setting.architecture` | Structural description |
| `setting.timeOfDay` | Default time context |
| `atmosphere.lighting` | Light quality and sources |
| `atmosphere.weather` | Environmental conditions |
| `atmosphere.colorPalette` | Array of dominant colors |
| `atmosphere.mood` | Emotional quality of space |
| `visualAnchors` | Array of signature elements — ALL must appear in every prompt |
| `allowedVariation` | What CAN change: cameraAngle, timeOfDay, crowdDensity, weatherIntensity |
| `referenceImages` | Array of 3 reference filenames |

### visual_style.json

| Field | Purpose |
|-------|---------|
| `overallStyle` | Global aesthetic description |
| `influences` | Array of `{ source, aspect }` artistic references |
| `colorPalette.primary` | Array of primary colors |
| `colorPalette.accent` | Array of accent colors |
| `lightingSignature` | Quality, sources, contrast, signature description |
| `forbiddenElements` | Array of elements that MUST NEVER appear |
| `negativePromptBase` | Base negative prompt string appended to all prompts |

### cinematography.json

| Field | Purpose |
|-------|---------|
| `shotDuration.default` | Base shot length in seconds (typically 8) |
| `cameraMovement.allowed` | Array of `{ type, description, speed }` |
| `cameraMovement.forbidden` | Array of forbidden movement types |
| `lenses.available` | Array of `{ focalLength, use, effect }` |
| `lenses.default` | Default lens choice |
| `framing.compositions` | Array of composition rules |
| `framing.shotSizes` | Array of shot size options |
| `constraints` | Array of `{ rule, enforcement }` — "CRITICAL" rules are hard requirements |

### shot_list.json

Each shot entry requires:

| Field | Purpose |
|-------|---------|
| `id` | Unique ID, pattern `SHOT_<2-3 digits>` |
| `shotNumber` | Sequential number |
| `timing.start` | Start time in seconds |
| `timing.duration` | Duration in seconds |
| `timing.end` | End time in seconds |
| `timing.musicSection` | Links to section ID from music analysis |
| `intent.what` | Scene description |
| `intent.why` | Narrative purpose |
| `intent.emotionalBeat` | Emotional arc (format: "state A → state B") |
| `characters` | Array of `{ id, prominence, action, costumeVariation }` |
| `location.id` | Location ID reference |
| `location.specificArea` | Specific area within location |
| `cameraIntent.feeling` | Emotional quality of camera work |
| `cameraIntent.movement` | Camera movement description |
| `cameraIntent.focus` | Focus target: subject, environment, or both |

---

## 2. Identity Anchor Methodology

Every prompt MUST include identity anchors for all characters and locations present.

### Character Identity Anchor Construction

Extract from `characters.json` and always include:

1. **Physical core**: age + build + height + skinTone (one sentence)
2. **Face signature**: structure + eyes + hair + distinctive features (one sentence)
3. **Costume**: default description + signature item (one sentence)

Example compact anchor (~80 chars for Kling):
> Late-20s Thai woman, slender build, warm brown skin, long dark hair, futuristic terracotta drapes

Example full anchor (~200 chars for SeedDream):
> Woman in her late 20s, slender graceful build, warm brown skin. Soft oval face with deep brown expressive eyes, long dark flowing hair. Futuristic draped clothing in warm terracotta and faded gold with asymmetric outer layer.

### Location Identity Anchor Construction

Extract from `locations.json` and always include:

1. **Setting**: type + scale + architecture (one sentence)
2. **Atmosphere**: lighting + weather + dominant colors (one sentence)
3. **Visual anchors**: ALL items from `visualAnchors` array (mandatory)

### What NEVER Varies Across Prompt Variations

- Character physical descriptions
- Character costume description
- Location visual anchors
- Location color palette
- Action/intent
- Visual style and forbidden elements

### What CAN Vary Across A/B/C/D Options

- Lens choice (24mm / 35mm / 50mm / 85mm)
- Camera angle (high / eye-level / low)
- Camera movement type (push in / tracking / static / orbit)
- Composition style (rule of thirds / centered / leading lines)
- Depth of field (shallow / deep)

---

## 3. Platform-Specific Prompt Constraints

### Kling 3.0 (Video Generation)

- **Max prompt length**: 500 characters
- **Focus**: Motion, camera movement, action transitions
- **Duration**: One continuous 8-second take
- **File pattern**: `prompts/kling/SHOT_XX_option_[A-D].txt`
- **Required elements**: framing/lens, camera movement (or explicitly static), subject action, lighting/color, environment/temporal details, negative prompt
- **Prompt order**: Identity anchors → Action → Camera/lens/movement → Lighting/style → Negative
- **Forbidden**: scene cuts, location changes, multiple actions, cross-shot references

### SeedDream 4.5 (Image Pair Generation)

- **Max prompt length**: 2000 characters
- **Focus**: Dual-frame state change (Frame 1 setup → Frame 2 shift)
- **Structure**: "Create 2 Images" format
- **File pattern**: `prompts/seedream/SHOT_XX_option_[A-D].txt`
- **Frame 1**: Complete scene setup with character + location + action state
- **Frame 2**: Same character/location, describe the emotional shift. Use "emotional weight has shifted" language, not forced expressions.
- **Required**: character identity anchors, location visual anchors, style treatment, negative prompt
- **Variation strategy**: A = Standard framing, B = Intimate close-up (shallow DOF), C = Wide cinematic (IMAX)

### Nano Banana Pro 3 (Static Image Generation)

- **Focus**: Single static frame, no motion
- **File pattern**: `prompts/nanobanana/SHOT_XX_option_[A-D].txt`
- **Required elements**: static scene composition, character/location anchors, style/lighting, composition language (foreground/background/depth), negative prompt
- **Forbidden motion verbs**: running, turning, walking, pushing, pulling, "camera moves", "then"
- **Conversion rule**: Replace motion verbs with static pose equivalents (e.g., "walking" → "mid-stride pose", "turning" → "angled stance looking over shoulder")

### Suno (Music Generation)

- **Focus**: Pure musical language only
- **File pattern**: `prompts/suno/music_prompt.txt`
- **Required elements**: genre/subgenre, mood/energy arc, tempo/BPM, instrumentation, vocal characteristics, structure cues (intro/verse/chorus/bridge/outro)
- **Forbidden**: ALL visual language (camera, lighting, frames, shots, characters, locations, scenes, neon, alley, rain)
- **Translation rule**: Convert visual concepts to musical equivalents:
  - "Blade Runner lighting" → "Vangelis-style atmospheric synths"
  - "High contrast neon" → "Bright sustained synth tones with dynamic range"
  - "Melancholic cyberpunk" → "Minor keys, slow tempo, yearning melodies"
  - "Chase scene intensity" → "Driving percussion, rising filter sweep, staccato bass"

---

## 4. Negative Prompt Catalog

### Base Negative (all platforms)

```
no text, logos, watermarks, distorted anatomy, cartoon style, flat lighting, plastic skin
```

### Kling Additions

```
+ camera shake, scene cuts, multiple locations
```

### SeedDream Additions

```
+ motion blur, walking, running, moving, animation
```

### Nano Banana Additions

```
+ motion blur, walking, running, moving, animation
```

### Project-Specific Negative

Always append `visual_style.json.negativePromptBase` to the platform base.
Also check `visual_style.json.forbiddenElements` and exclude any matching content from prompts.

---

## 5. Reference Image System

### Directory Structure

```
reference/characters/{CHAR_ID}/   → min 3 images (.png/.jpg/.jpeg/.webp)
reference/locations/{LOC_ID}/     → min 3 images (.png/.jpg/.jpeg/.webp)
```

### Auto-Collection Priority (for generation)

1. **Continuity**: Previous shot's last frame (for visual flow between shots)
2. **Uploaded**: User-uploaded reference images for this specific shot/variation
3. **Canon**: Images from `reference/characters/` and `reference/locations/` linked by shot's character/location IDs

### Constraints

- **Maximum**: 14 input reference images per generation call
- Primary characters get priority allocation over secondary/background
- If total references exceed 14, the system trims from lowest-priority sources

---

## 6. Validation ID Patterns

| Entity | Pattern | Example |
|--------|---------|---------|
| Project ID | `/^[a-z0-9-]{1,50}$/` | `default`, `my-video` |
| Shot ID | `/^SHOT_\d{2,3}$/` | `SHOT_01`, `SHOT_12` |
| Character ID | `/^CHAR_[A-Z_]+$/` | `CHAR_HER`, `CHAR_THE_HOST` |
| Location ID | `/^LOC_[A-Z_]+$/` | `LOC_WATER_STILL`, `LOC_VOID` |
| Variation | `/^[A-D]$/` | `A`, `B`, `C`, `D` |

---

## 7. Cross-File Coherence Rules

1. Every `characters[].id` referenced in `shot_list.json` shots MUST exist in `characters.json`
2. Every `location.id` referenced in `shot_list.json` shots MUST exist in `locations.json`
3. Every character/location ID in canon files SHOULD have a matching directory under `reference/`
4. Every shot in `shot_list.json` SHOULD have prompt files in `prompts/`
5. `visual_style.json.negativePromptBase` MUST be appended to every generated prompt
6. `cinematography.json.cameraMovement.forbidden` items MUST NOT appear in any Kling prompt
