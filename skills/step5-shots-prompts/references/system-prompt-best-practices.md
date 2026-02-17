# Step 5 System Prompt Best Practices

Use this guide when generating prompts for external AI systems in Step 5.
Reference `skills/_shared/references/universal-prompt-rules.md` for canon data schemas and identity anchor methodology.

---

## Universal Rules (All Systems)

1. **Standalone prompts**: Never reference previous shots or external context. Each prompt is self-contained.
2. **Identity anchors explicit**: Every prompt includes character physical description + face signature + costume, and location visual anchors + color palette.
3. **One action per prompt**: Each shot contains exactly one continuous action suitable for 8 seconds.
4. **Negative constraints explicit**: Include negative prompt block with `visual_style.json.negativePromptBase` + platform additions.
5. **Version metadata**: Include version/date in file headers.
6. **No forbidden elements**: Cross-check against `visual_style.json.forbiddenElements` — none of these may appear.
7. **Allowed camera only**: Cross-check against `cinematography.json.cameraMovement.forbidden` — none of these may appear in Kling prompts.

---

## Kling 3.0 (Video)

Use when writing `prompts/kling/SHOT_XX_option_[A-D].txt`.

### Constraints

- **Max prompt length**: 500 characters
- **Duration**: One continuous 8-second take
- **No scene cuts, no location changes**

### Required Elements

1. Shot framing and lens (e.g., "medium close-up, 35mm anamorphic feel")
2. Camera movement (e.g., "slow push in") or explicitly "static hold"
3. Subject identity anchor (compact ~80 chars)
4. Action in one continuous take
5. Lighting and color treatment
6. Environment and temporal details
7. Style tag: "Photorealistic cinematic, coherent motion over 8s"
8. Negative prompt block

### Best-Practice Order

```
[Shot size, lens] [Camera movement].
[Character compact anchor]. [Action].
[Location compact anchor]. [Lighting/atmosphere].
[Style tag].
Negative: [negativePromptBase + kling additions]
```

### Kling Negative Prompt

```
no text, logos, watermarks, distorted anatomy, cartoon style, flat lighting, plastic skin, camera shake, scene cuts, multiple locations
```

### Variation Strategy (A/B/C/D)

| Variation | Lens | Angle | Movement | Composition |
|-----------|------|-------|----------|-------------|
| A | 35mm anamorphic | Eye-level | Shot's default movement | Rule of thirds |
| B | 50mm standard | Low angle | Static hold | Centered |
| C | 24mm wide | High angle | Alternative allowed movement | Leading lines |
| D | 85mm portrait | Eye-level | Tracking/orbit | Depth layering |

---

## SeedDream 4.5 (Image Pairs)

Use when writing `prompts/seedream/SHOT_XX_option_[A-C].txt`.

### Constraints

- **Max prompt length**: 2000 characters total
- **Output**: Two sequential images showing state change
- **No motion verbs in negative prompt** (these are static images)

### Dual-Frame Structure ("Create 2 Images")

```
Create 2 Images.

Image 1:
[Full scene setup — character identity anchor + location + action starting state]
[Camera framing, lens, composition]
[Lighting, atmosphere, color palette]
[Visual style treatment]

Image 2:
Same [character brief re-anchor], same [location].
[Describe the change: emotional shift, subtle pose change, light shift]
[Emotional beat: "emotional weight has shifted from contemplation to quiet resolve"]
[Camera maintains same framing]
```

### SeedDream Rules

- Frame 1 gets the complete setup. All identity anchors, all visual anchors, full atmosphere.
- Frame 2 uses "Same [character], same location" then describes only what changed.
- Use "emotional weight has shifted" language instead of forced expressions ("she smiles", "he frowns").
- Character identity anchors must appear in BOTH frames.
- ALL location visual anchors must appear in BOTH frames.
- Scene description cap: ~160-200 chars per frame depending on character count.

### SeedDream Negative Prompt

```
no text, logos, watermarks, distorted anatomy, cartoon style, flat lighting, plastic skin, motion blur, walking, running, moving, animation
```

### Variation Strategy (A/B/C)

| Variation | Label | Framing | Character Detail | Location Detail |
|-----------|-------|---------|------------------|-----------------|
| A | Standard | Default framing, full descriptions | Full identity anchor | Full visual anchors |
| B | Intimate Close | "Extreme close-up, shallow DOF" | Full anchor + expression focus | Trimmed to background blur |
| C | Wide Cinematic | "Ultra-wide cinematic, IMAX format" | Compact anchor | Full environment + scale emphasis |

---

## Nano Banana Pro 3 (Static Images)

Use when writing first/last frame prompts in `prompts/nanobanana/`.

### Constraints

- **Static frames only** — absolutely no motion
- **No time progression** — describe a single frozen moment

### Required Elements

1. Static scene composition
2. Character identity anchor (full)
3. Location visual anchors
4. Style and lighting descriptors
5. Composition language (foreground, midground, background, depth)
6. Negative prompt including motion verbs

### Motion Verb Conversion Table

When converting from shot_list.json actions to static descriptions:

| Shot Action | Static Pose Equivalent |
|------------|----------------------|
| walking slowly | mid-stride pose, one foot slightly forward, weight shifting |
| running | frozen sprint, arms pumping, hair swept back |
| turning to look | head angled, eyes directed over shoulder |
| falling | suspended mid-air, body tilted, hair floating |
| dancing | frozen dance pose, arms extended, one leg lifted |
| reaching for | arm extended toward object, fingers spread |
| sitting down | seated position, hands on knees/armrests |
| looking around | head slightly turned, alert expression |
| swimming | arms extended in stroke position, body streamlined |
| climbing | hands gripping surface, body pressed against wall |
| gesturing | hand raised mid-gesture, expressive fingers |
| embracing | arms wrapped, bodies close, heads together |

### Nano Banana Negative Prompt

```
no text, logos, watermarks, distorted anatomy, cartoon style, flat lighting, plastic skin, motion blur, walking, running, moving, animation
```

---

## Suno (Music)

Use for `prompts/suno/music_prompt.txt` or project music prompt artifacts.

### Constraints

- **Music-only language** — zero visual terms
- **No camera, lighting, scene, or character references**

### Required Elements

1. Genre and subgenre
2. Mood/energy arc over time (start → peak → resolve)
3. Tempo/BPM range and rhythmic feel
4. Instrumentation and production style
5. Vocal characteristics (if applicable)
6. Structure cues (intro/verse/chorus/bridge/outro)

### Forbidden Terms in Suno Prompts

| Category | Forbidden |
|----------|-----------|
| Camera | pan, dolly, tracking, zoom, framing, lens, wide shot, close-up |
| Lighting | neon, glow, shadow, silhouette, backlit, ambient light |
| Scene | alley, rooftop, ocean, city, forest, room, building |
| Character | she walks, he turns, dancer, protagonist, subject |
| Narrative | flashback, montage, scene change, the camera reveals |

### Musical Translation Guide

| Visual Concept | Musical Equivalent |
|---------------|-------------------|
| Dark alley atmosphere | Reverb-heavy pads, dark atmospheric synths |
| Rain ambience | Gentle percussive textures, water-like delay |
| Sunrise/dawn | Major key resolution, ascending phrases |
| Intense action | Driving percussion, rising filter sweeps |
| Intimate moment | Sparse arrangement, solo instrument, dry mix |
| Epic establishing | Full orchestral swell, wide reverb |
| Slow-motion | Half-time rhythm, drawn-out sustains |
| Emotional catharsis | Dynamic build to sustained chord, layered harmonies |

---

## Prompt Length Constraints Summary

| Platform | Max Length | Typical Range |
|----------|-----------|---------------|
| Kling 3.0 | 500 chars | 350-480 chars |
| SeedDream 4.5 | 2000 chars | 800-1500 chars |
| Nano Banana Pro 3 | No hard limit | 300-600 chars |
| Suno | No hard limit | 200-500 chars |

---

## Final Quality Gate

For each generated prompt file, verify:

1. Matches platform-specific format and section structure.
2. Includes ALL required identity anchors (character + location).
3. Contains NO cross-shot references.
4. Negative prompt is present and complete.
5. Passes lint rules for that platform.
6. Character limit is respected (Kling < 500, SeedDream < 2000).
7. Variations A/B/C/D differ ONLY in camera/framing, not identity or action.
8. No forbidden camera movements from `cinematography.json`.
9. No forbidden elements from `visual_style.json.forbiddenElements`.
