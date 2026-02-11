# AI Music Video - Prompt Compiler + Project Orchestrator

**Version:** 2026-02-07 (Multi-Project Support)
**Phase:** 1 Complete + Phase A UX Enhancements + Multi-Project Architecture

A disciplined AI creative pipeline for generating high-quality, cinematic music videos using Kling 3.0, Nano Banana Pro 3, and Suno. Now with full multi-project support, drag-and-drop file uploads, and professional storyboard management.

---

## Overview

This system is a **Prompt Compiler**, not a creative director. It enforces structure, consistency, and best practices by translating structured data (Canon + Shot Intent) into system-specific prompts for AI tools.

### Core Principles

1. **Prompt Compiler Model:** Never generate prompts from imagination—always compile from structured data
2. **Consistency First:** 9/10 priority. Identity anchors prevent visual drift
3. **Standalone Prompts:** No cross-references. Each prompt contains complete context
4. **Controlled Variation:** Propose A/B/C/D options, vary camera only
5. **Quality > Speed:** Better to fail lint and fix than render inconsistent output

### Latest Features (2026-02-07)

✨ **Multi-Project Support**
- Manage unlimited music video projects simultaneously
- Complete data isolation per project (prompts, assets, music)
- Project selector dropdown with persistent selection
- UI wizard for creating new projects with metadata

🎬 **Storyboard System**
- Visual asset viewer for rendered videos and images
- Side-by-side A/B/C/D variation comparison
- Grid and Timeline view modes
- Shot selection tracking with sequence.json

📤 **Drag-and-Drop Uploads**
- Browser-based file uploads (no manual file placement needed)
- Music MP3 upload zone in navigation
- Video upload zones for each shot variation (A/B/C/D)
- Automatic file naming and organization

🎨 **Professional UX**
- Toast notification system (success/error/warning/info)
- Full-screen and inline loading states
- Collapsible shots list sidebar
- Breadcrumb navigation
- Prompt section labels with individual copy buttons

---

## Project Structure (Multi-Project Architecture)

```
AIMusicVideo/
├── projects/                       Multi-project root
│   ├── projects_index.json        Registry of all projects
│   ├── default/                   Your first project
│   │   ├── project.json           Project metadata
│   │   ├── bible/                 Canon (locked visual identity)
│   │   │   ├── visual_style.json  Style canon
│   │   │   ├── cinematography.json Camera rules
│   │   │   ├── characters.json    Character anchors
│   │   │   └── locations.json     Location anchors
│   │   ├── reference/             Visual reference system
│   │   │   ├── characters/{CHAR_ID}/
│   │   │   │   ├── ref_01.png
│   │   │   │   ├── ref_02.png
│   │   │   │   ├── ref_03.png
│   │   │   │   └── guide.json
│   │   │   └── locations/{LOC_ID}/
│   │   ├── prompts/               Generated prompts
│   │   │   ├── kling/SHOT_XX_option_X.txt
│   │   │   ├── nanobanana/SHOT_XX_frame.txt
│   │   │   └── suno/music_prompt.txt
│   │   ├── rendered/              Rendered assets
│   │   │   ├── shots/SHOT_XX/    Rendered videos
│   │   │   │   ├── kling_option_A.mp4
│   │   │   │   ├── kling_option_B.mp4
│   │   │   │   └── ...
│   │   │   └── storyboard/
│   │   │       └── sequence.json  Shot selection tracking
│   │   ├── music/                 Music files
│   │   ├── lint/                  Project-specific lint reports
│   │   └── prompts_index.json    Project-specific index
│   ├── my-second-project/        Another project
│   │   └── ... (same structure)
│   └── another-project/          Third project
│       └── ...
│
├── storyboard/                    Shared storyboard templates
│   ├── shot_intent_schema.json  Shot intent schema
│   └── example_shot_intent.json Example template
│
├── lint/                          Shared validation system
│   ├── schemas/                  JSON schemas
│   ├── prompt_rules.md           Lint rules
│   └── linter.js                 Linter script
│
├── scripts/                       Orchestration scripts
│   ├── project_manager.js        Project CRUD operations
│   ├── migrate_to_projects.js    Migration script
│   ├── validate_schemas.js       Validate Bible files
│   ├── generate_index.js         Generate prompts index
│   ├── init_phase2.js            Initialize Phase 2
│   ├── serve_ui.js               Web server + API
│   └── scaffold_feature.js       Feature/domain/service scaffolder
│
├── ui/                            Web interface
│   ├── index.html                Main prompts UI
│   ├── storyboard.html           Storyboard viewer
│   ├── styles.css                Global styling
│   ├── storyboard.css            Storyboard styling
│   ├── app.js                    Main UI logic
│   └── storyboard.js             Storyboard logic
│
├── package.json                   npm configuration
└── README.md                      This file
```

---


### Architecture Scaffold (AI-friendly)

```bash
npm run scaffold:feature -- my-feature --with-domain --with-service --dry-run
```

Creates a starter feature slice and unit test with consistent layering.
Use `--force` to overwrite existing scaffold files.

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

This installs:
- `ajv` (JSON Schema validator)
- `busboy` (File upload handling)

### 2. Migrate to Multi-Project Structure

**⚠️ IMPORTANT: Run this ONCE to migrate existing data**

```bash
npm run migrate
```

This creates the `projects/` folder and moves your existing data to `projects/default/`.

### 3. Generate Prompts Index

```bash
npm run index
```

Generates `prompts_index.json` for the default project (empty in Phase 1, populated in Phase 2).

### 4. Start UI Server

```bash
npm run serve
```

Opens UI at **[http://localhost:8000](http://localhost:8000)**

### 5. Explore the UI

- **Main Prompts UI**: Browse all generated prompts with A/B/C/D variation comparison
- **Storyboard**: View and manage rendered video assets
- **Project Selector**: Switch between projects or create new ones

**In Phase 1**: UI shows "No prompts found" (expected - prompts generated in Phase 2)

---

## Phase Workflow

### Phase 1: Infrastructure (CURRENT)

**Goal:** Build the system architecture without generating creative content.

**Deliverables:**
- ✅ Complete folder structure
- ✅ All JSON schemas
- ✅ Bible files with TODO placeholders
- ✅ Prompt templates (Kling, Nano Banana, Suno)
- ✅ Linter with comprehensive rules
- ✅ Index generator and web UI
- ✅ Documentation

**What Phase 1 Does NOT Include:**
- ❌ Real character definitions
- ❌ Real location definitions
- ❌ Generated prompts
- ❌ Reference images
- ❌ Shot plans or beat maps

### Phase 2: Production (AFTER MUSIC GENERATION)

**Trigger:** User provides song duration + section timestamps

**Steps:**

#### 2.1 Generate Music
1. Create Suno prompt using `prompts/suno/_template.md`
2. Generate music in Suno UI
3. Note final duration and section timestamps (intro, verse, chorus, etc.)

#### 2.2 Initialize Phase 2
```bash
npm run init-phase2
```

This interactive script:
- Captures song duration and BPM
- Records section timestamps
- Updates `bible/project.json`
- Creates `storyboard/beat_map.json`
- Generates `storyboard/shot_plan.json` scaffold with 8-second shots

#### 2.3 Fill Canon
1. **Characters:** Replace CHAR_PROTAGONIST in `bible/characters.json` with actual character data
2. **Locations:** Replace LOC_NEON_ALLEY in `bible/locations.json` with actual location data

#### 2.4 Create Visual References
For each character and location:
1. Generate 3 reference images using Nano Banana (use `prompts/nanobanana/_template.md`)
2. Save as `ref_01.png`, `ref_02.png`, `ref_03.png` in `reference/{type}/{ID}/`
3. Update `guide.json` with invariant features and allowed variation

#### 2.5 Create Shot Intents
1. Open `storyboard/shot_plan.json`
2. For each shot scaffold, fill in:
   - `intent.what`: What physically happens
   - `intent.why`: Narrative purpose
   - `characters`: Which characters appear and their actions
   - `location`: Which location
   - `cameraIntent`: Desired camera feeling

Use `storyboard/example_shot_intent.json` as a guide.

#### 2.6 Compile Prompts
(Manual or scripted - TBD)

For each shot:
1. Load character data from `bible/characters.json`
2. Load location data from `bible/locations.json`
3. Load visual style from `bible/visual_style.json`
4. Load shot intent from `storyboard/shot_plan.json`
5. Merge into Kling template to create 4 variations (A/B/C/D)
6. Merge into Nano Banana template for first/last frames
7. Save to `prompts/kling/SHOT_XX_option_X.txt` and `prompts/nanobanana/SHOT_XX_frame.txt`

#### 2.7 Validate & View
```bash
npm run lint          # Validate all prompts
npm run index         # Generate index
npm run serve         # View in UI
```

#### 2.8 Render
1. Copy prompts from UI (click "Copy to Clipboard")
2. Paste into AI tool UIs:
   - Kling for video generation
   - Nano Banana for keyframes (optional)
3. Download rendered assets
4. Track in `render_sheets/`

#### 2.9 Assemble
1. Import all rendered clips into CapCut
2. Align with music timeline
3. Apply transitions and color grading as needed
4. Export final video

---

## Canon System

The **Canon** defines locked visual identity that must be consistent across all prompts.

### bible/visual_style.json

Global style identity:
- Overall style: "Stylized cyberpunk with cinematic realism"
- Influences: Blade Runner, Christopher Nolan, 1990s anime
- Color palette: Deep blues, electric purple, acid green, hot pink
- Lighting: High-contrast dramatic, neon reflections
- Forbidden: Cartoon style, flat lighting, camera shake

### bible/cinematography.json

Camera rules:
- Shot duration: 8 seconds (one action per shot)
- Movement: Smooth cinematic only (push in, pull back, tracking, pan, crane, orbit)
- Lenses: 24mm wide, 35mm anamorphic, 50mm, 85mm portrait
- Forbidden: Shaky cam, crash zoom, whip pan

### bible/characters.json

Character identity anchors:
- `physicalCore`: Age, build, height, skin tone (NEVER change)
- `faceSignature`: Face structure, eyes, hair (NEVER change)
- `costume`: Default outfit, color palette, signature item
- `allowedVariation`: What CAN change (lighting, expression, pose, distance)

Every prompt featuring a character MUST include ALL identity anchors.

### bible/locations.json

Location identity anchors:
- `setting`: Type, scale, architecture, time of day
- `atmosphere`: Lighting, weather, color palette, mood
- `visualAnchors`: Signature elements that identify this location (NEVER change)
- `allowedVariation`: What CAN change (camera angle, weather intensity)

Every prompt featuring a location MUST include ALL visual anchors.

---

## Linting System

The linter enforces prompt quality and consistency.

### Running the Linter

```bash
npm run lint
```

Generates `lint/report.json` with:
- Bible file validation results
- Prompt validation results (pass/fail for each prompt)
- Specific error messages and rule violations

### Lint Rules

See `lint/prompt_rules.md` for complete documentation.

**Critical failures:**
- Cross-references to previous shots
- Missing version tag
- Missing identity anchors (character/location)
- Multiple actions in one shot (Kling)
- Motion verbs in image prompts (Nano Banana)
- Visual descriptions in music prompts (Suno)

---

## Prompt Templates

Templates show how to compile Canon + Intent → Final Prompt.

### Kling Template (`prompts/kling/_template.md`)

**Structure:**
1. Character description (from canon)
2. Location description (from canon)
3. Action (ONE only, 8 seconds)
4. Camera (shot size, lens, movement, focus)
5. Composition (framing approach)
6. Lighting & atmosphere (from canon)
7. Style references (from canon)
8. Negative prompt (forbidden elements)

**Variation Strategy:**
Generate 4 options (A/B/C/D) varying ONLY:
- Lens choice
- Camera angle
- Camera movement
- Composition

NEVER vary: character, location, action, wardrobe, color palette

### Nano Banana Template (`prompts/nanobanana/_template.md`)

**Key Difference:** No motion verbs. Static pose descriptions only.

Convert: "character walks" → "character mid-stride, one foot forward"

**Use Cases:**
- First frame (optional Kling input)
- Last frame (continuity reference)
- Reference images (visual guides)

### Suno Template (`prompts/suno/_template.md`)

**Music-focused only:**
- Genre and style
- Mood and emotional arc
- Instrumentation
- Tempo and rhythm
- Song structure
- Production style

NO visual descriptions, NO character/location references.

---

## UI Usage

### Start UI

```bash
npm run serve
```

Open **[http://localhost:8000](http://localhost:8000)**

### Main Prompts Interface

**Project Management:**
- **Project Selector** dropdown in left navigation - switch between projects instantly
- **+ New Project** button - create new projects with wizard modal
- Active project saved in browser (persists across sessions)

**Prompt Browsing:**
- **Browse shots** via sidebar navigation (collapsible)
- **Filter by platform**: All Prompts / Kling / Nano Banana / Suno
- **Search** shots by ID or keyword
- **A/B/C/D variation comparison** for Kling (toggle buttons)
- **Copy to clipboard** - one-click copy for entire prompt or individual sections
- **Lint status** - visual pass/fail indicators with error details
- **Breadcrumbs** - Platform > Shot > Variation navigation

**UX Features:**
- Toast notifications for all actions (success/error/warning/info)
- Loading states for async operations
- Collapsible sidebar (maximize content viewing space)
- Individual copy buttons for Scene/Camera/Negative Prompt sections

### Storyboard Interface

**Access:** Click "📊 Storyboard" in navigation or visit `/storyboard.html`

**Features:**
- **Grid View**: See all shots at once with thumbnails
- **Timeline View**: Shots grouped by music section
- **Asset Upload**: Drag-and-drop MP4/MOV files for each shot variation
- **Music Upload**: Drag-and-drop MP3 in left navigation
- **Variation Comparison**: Click shot to compare A/B/C/D variations side-by-side
- **Selection Tracking**: Mark chosen variation, tracked in sequence.json
- **Stats Dashboard**: Total shots, rendered count, selected count, duration

**Workflow:**
1. Drag music MP3 into music upload zone
2. Generate videos in Kling/Nano Banana using prompts from main UI
3. Drag rendered videos into storyboard (organized by shot)
4. Click shot to compare A/B/C/D variations in modal
5. Select best variation for final edit
6. Export storyboard for editing reference

---

## npm Scripts

```bash
npm run migrate       # Migrate to multi-project structure (run once)
npm run validate      # Validate Bible JSON files against schemas
npm run lint          # Run linter on Bible files + prompts
npm run index         # Generate prompts_index.json (default project)
npm run index <id>    # Generate prompts_index.json for specific project
npm run serve         # Start UI server on port 8000
npm run lint:architecture  # Enforce UI->Service fetch boundary
npm run init-phase2   # Initialize Phase 2 (interactive)
npm test              # Run validate + lint
```

---

## Multi-Project Management

The system supports unlimited projects with complete data isolation.

### Creating a New Project

1. Click the **"+"** button next to "Current Project" in the left navigation
2. Enter project name and description
3. Click "Create Project"
4. System automatically switches to the new project

Each project gets its own:
- Canon (bible/) - characters, locations, visual style
- References (reference/) - visual guides
- Prompts (prompts/) - generated prompts for all tools
- Rendered Assets (rendered/) - videos, images, storyboard
- Music Files (music/) - MP3 uploads
- Lint Reports (lint/) - validation results

### Switching Projects

Use the dropdown selector in the left navigation. Your selection is saved in browser localStorage and persists across sessions.

### Project Isolation

**Files uploaded** to one project (music, videos) **DO NOT** appear in other projects. Each project is completely isolated with its own directory structure.

**Prompts generated** for one project reference only that project's canon. Characters and locations from one project never leak into another.

### Migration (One-Time Setup)

If you have existing data from before multi-project support was added:

```bash
npm run migrate
```

This moves your data to `projects/default/` and creates the multi-project structure. **Only run once.**

---

## Music Analysis System

The music analysis system provides structured temporal data (sections, beats, energy levels) to enable precise shot timing and synchronization with music.

### Why Music Analysis?

When creating shots for a music video, Claude needs to know:
- **Section boundaries** - Where intro/verse/chorus start/end (for scene pacing)
- **Energy levels** - How intense each section is (to match visual energy)
- **Beat grid** - Precise beat timestamps (to sync action to rhythm)
- **Key moments** - Drops, build-ups, transitions (for dramatic timing)

Without this data, shot timing would be guesswork.

### File Location

Each project can have a music analysis file:
```
projects/YOUR_PROJECT/
└── music/
    ├── song.mp3           # The audio file
    └── analysis.json      # Music analysis data (NEW)
```

### Essential Music Data

**Minimum Required**:
- Total duration (seconds)
- BPM (beats per minute)
- Song sections with timestamps (intro, verse, chorus, etc.)
- Energy level per section (low/medium/high/climax)

**Example**:
```json
{
  "version": "2026-02-07",
  "songTitle": "Echoes in the Dark",
  "duration": 180.5,
  "bpm": 128,
  "sections": [
    {
      "id": "intro",
      "label": "Intro",
      "startTime": 0,
      "endTime": 8,
      "energy": "low",
      "mood": "mysterious"
    },
    {
      "id": "chorus1",
      "label": "Chorus 1",
      "startTime": 32,
      "endTime": 56,
      "energy": "high",
      "mood": "euphoric"
    }
  ]
}
```

### Advanced Features (Optional)

- **Beat Grid**: Precise beat timestamps for frame-accurate sync
- **Key Moments**: Drops, build-ups, transitions with timestamps
- **Energy Curve**: Energy levels sampled throughout song (for visualization)
- **Tempo Changes**: If BPM varies during the song

See [docs/MUSIC_ANALYSIS.md](docs/MUSIC_ANALYSIS.md) for complete documentation.

### How to Get Music Analysis

**Option A: AI Music Tool Export**
- Generate music with Suno (provides BPM, duration automatically)
- Request section timestamps via Suno API/UI
- Export to `analysis.json`

**Option B: Audio Analysis Tool**
- Use Essentia, Spotify API, Librosa, or Sonic Visualiser
- Extract BPM, beat grid, section detection
- Format as `analysis.json`

**Option C: Manual Input**
- Listen to song in DAW (Digital Audio Workstation)
- Mark section boundaries manually
- Measure BPM with tap tempo tool
- Fill out `analysis.json` by hand

### Validation

```bash
npm run validate
```

Validates `music/analysis.json` against the schema.

### Example Workflow

1. **Upload Music**: Drag MP3 to music upload zone in UI
2. **Analyze Music**: Create `music/analysis.json` (AI tool or manual)
3. **Validate**: Run `npm run validate` to check schema
4. **Create Shots**: Claude reads analysis.json and uses section data for timing
5. **Compile Prompts**: Each shot intent includes precise startTime/endTime from sections

See the full example at [examples/music_analysis_example.json](examples/music_analysis_example.json).

---

## Visual Reference System

Reference images are authoritative visual anchors to prevent drift.

### Structure

Each character/location MUST have:
- 3 reference images (`ref_01.png`, `ref_02.png`, `ref_03.png`)
- 1 guide file (`guide.json`)

### guide.json

Defines:
- **Invariant features:** MUST appear in every prompt (e.g., "sharp green eyes", "flickering ECHO sign")
- **Allowed variation:** What CAN change (e.g., "lighting intensity OK, but color palette locked")

### Prompt Matching Strategy

Since Nano Banana may not support image input:
- Describe ALL invariant features explicitly in text
- Mirror guide.json invariant features array
- Include in EVERY prompt featuring that character/location

---

## Troubleshooting

### "npm install" fails

**Cause:** Node.js not installed or version too old

**Fix:**
- Install Node.js 14+ from [nodejs.org](https://nodejs.org/)

### "npm run lint" fails validation

**Cause:** Bible files don't match schemas

**Fix:**
1. Check error messages for specific validation issues
2. Fix JSON syntax or schema violations
3. Re-run `npm run lint`

### UI shows "No prompts found"

**Cause:** No prompt files generated (expected in Phase 1)

**Fix:**
- Phase 1: This is normal. Prompts generated in Phase 2.
- Phase 2: Run `npm run index` after creating prompts

### Character/location appears inconsistent

**Cause:** Identity anchors missing or varying

**Fix:**
1. Check `lint/report.json` for specific rule violations
2. Ensure ALL identity anchors from canon appear in prompt
3. Verify visual anchors match reference guides
4. Re-lint and fix errors

---

## Best Practices

### 1. Canon is Law
Never deviate from locked canon (characters, locations, visual style). If you need to change something, update the canon file first, then regenerate prompts.

### 2. One Shot = One Action
Describe only ONE continuous action suitable for 8 seconds. Multiple actions cause cramped pacing or incomplete execution.

### 3. Standalone Prompts
Each prompt must contain complete context. Never reference "same as before" or "previous shot."

### 4. Lint Before Render
Always run `npm run lint` before using prompts in AI tools. Fix all CRITICAL errors.

### 5. Variation Strategy
When generating A/B/C/D options, vary ONLY camera choices. Keep everything else identical for true comparison.

### 6. Reference Images Matter
Create high-quality reference images. They are your consistency safety net.

---

## System Failure Modes

The system FAILS if:
- ❌ Prompts do not stand alone (require context from other shots)
- ❌ Frequent manual prompt fixes needed (system not compiling correctly)
- ❌ Visual consistency drifts across shots (identity anchors not enforced)

The system SUCCEEDS if:
- ✅ Copy-paste prompts work immediately in AI tools
- ✅ A/B/C/D variations maintain consistent identity
- ✅ Linter catches errors before rendering
- ✅ Minimal manual intervention needed

---

## Project Goals

### 1. Produce High-Quality Cinematic Result
- Stylized cyberpunk aesthetic
- Consistent character and location identity
- Professional camera language
- Cohesive visual storytelling

### 2. Learn Disciplined AI Creative Pipeline
- Structured data drives prompts (not imagination)
- Validation enforces quality
- Human choice preserved via A/B/C/D proposals
- Repeatable, systematic workflow

---

## Credits

**AI Tools:**
- Kling 3.0 (video generation)
- Nano Banana Pro 3 via Google Flow UI (image generation)
- Suno (music generation)

**Assembly:**
- CapCut (manual video editing)

**System:**
- Claude Code (infrastructure design and implementation)

---

## License

MIT

---

## Version History

**2026-02-07 (Multi-Project Support + Phase A UX)**
- 🎯 Multi-project architecture with complete data isolation
- 📤 Drag-and-drop file uploads (music + videos)
- 🎬 Storyboard system with Grid/Timeline views
- 🎨 Professional UX (toast notifications, loading states, breadcrumbs)
- 📊 Project selector dropdown + wizard modal
- 🔄 Migration script for existing data
- 💾 Project-aware API endpoints (REST API for projects)
- 📝 Prompt section labels with individual copy buttons
- 🔲 Collapsible sidebar for maximized content viewing

**2026-02-07 (Phase 1 - Infrastructure)**
- Complete project structure
- All schemas, templates, and validation
- Linter and web UI
- Documentation

**Phase 2 (TBD)**
- Prompt generation
- Asset rendering
- Final assembly

---

## Next Steps

You are currently in **Phase 1** (Infrastructure).

**When ready for Phase 2:**

1. Generate music in Suno
2. Run `npm run init-phase2`
3. Fill in `bible/characters.json` and `bible/locations.json`
4. Create reference images
5. Write shot intents
6. Compile and validate prompts
7. Render in AI tools
8. Assemble in CapCut

**Need Help?**
- Lint rules: `lint/prompt_rules.md`
- UI usage: `ui/README.md`
- Templates: `prompts/{tool}/_template.md`
- Schemas: `lint/schemas/*.json`
