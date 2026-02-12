# Step 5 System Prompt Best Practices

Use this guide when generating prompts for external AI systems in Step 5.

## Universal rules (all systems)

1. Keep prompts standalone; never reference previous shots.
2. Keep identity anchors explicit (character + location invariants).
3. Keep one shot action per prompt.
4. Keep negative constraints explicit where supported.
5. Keep prompt version/date metadata in file headers.

## Kling 3.0 (video)

Use when writing `prompts/kling/SHOT_XX_option_[A-D].txt`.

Required elements:

- Shot framing and lens feel (e.g., medium close-up, wide, etc.)
- Explicit camera movement (or explicitly static)
- Subject/action in one continuous take
- Lighting and color treatment
- Environment and temporal details
- Negative prompt block:
  - `no text, logos, watermarks, distorted anatomy, cartoon style, flat lighting, plastic skin, camera shake`

Best-practice pattern:

- Identity anchors first
- Action line second
- Camera/lens/movement third
- Lighting/style fourth
- Negative line last

## Nano Banana Pro 3 (image frames)

Use when writing first/last frame prompts in `prompts/nanobanana/`.

Required elements:

- Static scene composition only (no motion verbs/time progression)
- Character/location anchor details
- Clear style and lighting descriptors
- Composition language (foreground/background/depth)
- Negative prompt block as required by your template

Avoid words like: "running", "turning", "camera pushes", "then".

## Suno (music)

Use for `prompts/suno/music_prompt.txt` or project Suno prompt artifacts.

Required elements:

- Genre and subgenre
- Mood/energy arc over time
- Tempo/BPM range and rhythmic feel
- Instrumentation and production style
- Vocal characteristics (if applicable)
- Structure cues (intro/verse/chorus/bridge/outro)

Do NOT include visual shot descriptions (camera, lighting, frames).

## SeedDream

Use when writing `prompts/seedream/*` prompts.

Required elements:

- Core subject + action in one sentence
- Visual style and rendering intent
- Composition and depth guidance
- Environment, lighting, palette
- Clear exclusion list (text/logos/watermarks and project-specific exclusions)

## Final quality gate before saving

For each generated prompt file, verify:

1. It matches system-specific format.
2. It includes all required anchors and constraints.
3. It contains no cross-shot references.
4. It passes lint for that system where rules exist.
