---
name: step4-references-assets
description: Fill out Step 4 (References & Assets) for AIMVDashboard by completing character/location reference libraries and keeping them aligned with canon IDs. Use when asked to complete or verify Step 4 page content.
---

# Step 4: References & Assets Skill

Complete reference libraries for every character and location defined in the canon. Reference images provide visual continuity anchors that the generation system uses to maintain consistent character appearance and location identity across all shots.

## Prerequisites

- Step 3 must be complete. Read these files for the list of required references:
  - `projects/<project-id>/bible/characters.json` — lists all character IDs
  - `projects/<project-id>/bible/locations.json` — lists all location IDs
- Each character/location ID in the canon needs a matching reference directory.

## Required Artifacts

### Directory Structure

```
projects/<project-id>/reference/
├── characters/
│   └── <CHAR_ID>/
│       ├── ref_01.png (or .jpg/.jpeg/.webp)
│       ├── ref_02.png
│       ├── ref_03.png
│       └── guide.json (optional)
└── locations/
    └── <LOC_ID>/
        ├── ref_01.png
        ├── ref_02.png
        ├── ref_03.png
        └── guide.json (optional)
```

Each reference directory must contain at least 3 images in `.png`, `.jpg`, `.jpeg`, or `.webp` format.

## Execute

1. Resolve project ID. Default to `default` if not specified.
2. Read `bible/characters.json` and extract all character IDs.
3. Read `bible/locations.json` and extract all location IDs.
4. For each character ID:
   a. Ensure directory exists at `reference/characters/<CHAR_ID>/`.
   b. Verify at least 3 reference images are present.
   c. Optionally create/update `guide.json` with invariants and allowed variations.
5. For each location ID:
   a. Ensure directory exists at `reference/locations/<LOC_ID>/`.
   b. Verify at least 3 reference images are present.
   c. Optionally create/update `guide.json`.
6. If reference images are missing, flag the gap. The agent can generate reference prompts for Nano Banana Pro 3 (see Platform Best Practices below).

### API Endpoints

If the server is running:

- `GET /api/references/characters?project=<id>` — list character reference directories and image counts
- `GET /api/references/locations?project=<id>` — list location reference directories and image counts
- `POST /api/references/characters/upload?project=<id>` — upload a character reference image (multipart form: `entityId`, `file`)
- `POST /api/references/locations/upload?project=<id>` — upload a location reference image (multipart form: `entityId`, `file`)

### guide.json Schema (Optional)

```json
{
  "invariants": [
    "Always wears the asymmetric draped outer layer",
    "Hair flows past shoulders in every shot",
    "Warm brown skin tone consistent across all lighting"
  ],
  "allowedVariations": [
    "Lighting angle and intensity may change",
    "Expression ranges from neutral to emotional",
    "Camera distance varies from close-up to wide"
  ],
  "notes": "Primary character — highest reference priority in generation"
}
```

## Platform-Specific Best Practices

### Reference Image Quality

- **Resolution**: Minimum 512x512px. Prefer 1024x1024 or higher for better generation quality.
- **Format**: PNG preferred for lossless quality. JPG acceptable. WEBP supported.
- **Consistency**: All references for one entity should show the same person/place. Mixed references confuse the model.

### Character Reference Strategy

For each character, aim for:
1. **Front-facing portrait**: Neutral pose, clear face, full lighting
2. **Three-quarter angle**: Shows depth and profile features
3. **Full body or action pose**: Shows costume and proportions
4. Optional: Different lighting condition (dramatic vs soft)

### Location Reference Strategy

For each location, aim for:
1. **Wide establishing shot**: Full environment context
2. **Detail shots**: Close-ups of visual anchor elements
3. **Atmosphere sample**: Showing lighting quality and color palette

### Nano Banana Reference Generation Prompts

If generating reference images via AI, use this structure:

```
Front-facing, full body portrait, neutral standing pose
[Character physical description from characters.json]
[Face signature from characters.json]
[Costume description with colors]
Framing: centered composition, full body visible
Shot Size: full body portrait
Angle: eye level, straight-on front view
Background: neutral dark studio backdrop
Lighting: soft even studio lighting from front
Style: clean character reference sheet, high detail, cinematic realism
Negative: no text, logos, watermarks, distorted anatomy, motion blur, cartoon style
```

### Generation Reference Collection

During shot generation (Step 5), the system auto-collects references in this priority:

1. **Continuity**: Previous shot's last frame (for visual flow)
2. **Uploaded**: User-selected reference images for this shot/variation
3. **Canon**: Images from `reference/characters/` and `reference/locations/`

**Maximum**: 14 input reference images per generation call. Primary characters get priority allocation.

## Quality Checks

Before marking complete:

1. Every character ID in `characters.json` has a matching directory under `reference/characters/`.
2. Every location ID in `locations.json` has a matching directory under `reference/locations/`.
3. Each reference directory contains at least 3 images (`.png`/`.jpg`/`.jpeg`/`.webp`).
4. Images are not placeholder files (each should be > 10KB).
5. No orphaned reference directories (directories without matching canon IDs).

## Completeness Check

```bash
project=default
node -e "
  const fs = require('fs');
  const path = require('path');
  const base = 'projects/' + process.env.P + '/';
  let ok = true;
  const imgExts = ['.png', '.jpg', '.jpeg', '.webp'];
  function countImages(dir) {
    if (!fs.existsSync(dir)) return 0;
    return fs.readdirSync(dir).filter(f => imgExts.includes(path.extname(f).toLowerCase())).length;
  }
  // Check characters
  try {
    const chars = JSON.parse(fs.readFileSync(base + 'bible/characters.json', 'utf8'));
    for (const c of (chars.characters || [])) {
      const d = base + 'reference/characters/' + c.id;
      const n = countImages(d);
      if (n < 3) { console.error(c.id + ': ' + n + ' images (need 3+)'); ok = false; }
      else { console.log(c.id + ': ' + n + ' images OK'); }
    }
  } catch (e) { console.error('characters.json: ' + e.message); ok = false; }
  // Check locations
  try {
    const locs = JSON.parse(fs.readFileSync(base + 'bible/locations.json', 'utf8'));
    for (const l of (locs.locations || [])) {
      const d = base + 'reference/locations/' + l.id;
      const n = countImages(d);
      if (n < 3) { console.error(l.id + ': ' + n + ' images (need 3+)'); ok = false; }
      else { console.log(l.id + ': ' + n + ' images OK'); }
    }
  } catch (e) { console.error('locations.json: ' + e.message); ok = false; }
  if (!ok) process.exit(1);
  console.log('Step 4 complete.');
" P="$project"
```

## LLM Guidance

- This step primarily involves file system operations (creating directories, placing images) and cannot be fully automated by text generation alone.
- The agent should verify directory structure and image counts, and flag missing references.
- If generating reference prompts for Nano Banana, use the template in Platform-Specific Best Practices above.
- Output format for guide.json: Valid JSON only. No markdown code fences.
- When reporting results, list each entity with its image count and status (OK / missing / insufficient).
- Reference `skills/_shared/references/universal-prompt-rules.md` for reference image system details.
- Reference `references/reference-image-guide.md` for detailed curation best practices.

Step 4 is complete only when every canon character and location has a reference directory with 3+ images.
