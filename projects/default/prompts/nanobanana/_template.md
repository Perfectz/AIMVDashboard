# Nano Banana Pro 3 Prompt Template

**Version:** 2026-02-07
**Created:** [YYYY-MM-DD]
**Shot ID:** [SHOT_XX]
**Frame Type:** [first_frame | last_frame | reference]

---

## PURPOSE

Nano Banana Pro 3 generates **static images** (keyframes) for:
1. **First frame** of Kling video shots (optional image-to-video input)
2. **Last frame** of Kling video shots (for continuity planning)
3. **Reference images** for character/location visual guides

**CRITICAL:** No motion verbs. No time progression. Single frozen moment only.

---

## PROMPT STRUCTURE

### SECTION 1: Character Description (if character present)
```
[FULL CHARACTER DESCRIPTION FROM bible/characters.json]

Include ALL of:
- physicalCore: age, build, height, skinTone
- faceSignature: structure, eyes, hair
- costume: description, color palette, signature item
- Pose: static pose description (NOT motion)

Example:
Young woman in early 30s, athletic build, tall, olive skin. Angular face with sharp jawline, high cheekbones. Bright green eyes, short black hair slightly tousled. Black leather jacket with red accent stripe on sleeves, dark fitted jeans, combat boots.

Pose: Standing mid-stride, one foot forward, weight on back leg, head tilted upward looking at something above, arms relaxed at sides.
```

### SECTION 2: Location/Environment
```
[FULL LOCATION DESCRIPTION FROM bible/locations.json]

Include ALL of:
- setting: type, architecture, spatial context
- atmosphere: lighting, weather, color palette
- visualAnchors: ALL signature elements

Example:
Narrow urban alley, cyberpunk cityscape, approximately 3 meters wide. Wet pavement reflecting neon lights. Flickering holographic billboard reading "ECHO" in blue and pink light on left wall. Weathered brick walls with scattered graffiti. Night setting.
```

### SECTION 3: Composition
```
Framing: [rule of thirds | centered | symmetrical | leading lines | depth layering]

Shot Size: [extreme close-up | close-up | medium shot | medium wide | wide shot | extreme wide]

Angle: [high angle | eye level | low angle | bird's eye | worm's eye]

Depth: [shallow focus | medium depth | deep focus]

Example:
Framing: rule of thirds, character positioned on right third
Shot Size: medium wide, full body visible
Angle: eye level, slightly low to emphasize character presence
Depth: shallow focus on character, background softly blurred with bokeh from neon lights
```

### SECTION 4: Lighting & Color
```
[FROM bible/visual_style.json + location]

Include:
- Lighting quality
- Light sources and direction
- Color palette (must match canon)
- Shadows and highlights

Example:
High-contrast dramatic lighting. Primary light: blue neon from left (holographic billboard) casting cool shadows. Secondary: pink neon accent from right creating rim light on character's silhouette. Scattered warm urban glow in background. Deep blues, electric purple, hot pink accents. Strong shadows creating chiaroscuro effect.
```

### SECTION 5: Atmospheric Details
```
[FROM bible/visual_style.json]

Texture quality, environmental effects (frozen moment)

Example:
Light rain visible as suspended droplets catching neon glow. Subtle fog in mid-ground adding atmospheric depth. Wet surfaces reflecting colored light. Cinematic realism with slight stylization. Rain on glass texture, weathered concrete, glowing holograms.
```

### SECTION 6: Style References
```
[FROM bible/visual_style.json]

Overall style: Stylized cyberpunk with cinematic realism
Influences: Blade Runner lighting + mood, Christopher Nolan scale, 1990s anime expressive silhouettes
Texture: cinematic realism, atmospheric depth
```

### SECTION 7: Negative Prompt (REQUIRED)
```
Negative: no text, logos, watermarks, distorted anatomy, cartoon style, flat lighting, plastic skin, motion blur, walking, running, moving
```

---

## COMPLETE EXAMPLE PROMPT

```
Version: 2026-02-07
Shot: SHOT_01
Frame Type: first_frame

Young woman in early 30s, athletic build, tall, olive skin. Angular face with sharp jawline and high cheekbones. Bright green eyes, short black hair with slight tousled texture. Black leather jacket with red accent stripe on sleeves, dark fitted jeans, combat boots.

Pose: Standing mid-stride, one foot forward, weight on back leg, head tilted upward gazing at flickering neon signs above, arms relaxed at sides, contemplative expression.

Narrow urban alley, cyberpunk cityscape, 3 meters wide. Wet pavement reflecting neon lights. Flickering holographic billboard reading "ECHO" in blue and pink light on left wall. Weathered brick walls. Night.

Framing: rule of thirds, character positioned on right third, holographic billboard on left third creating visual balance. Depth layering with foreground wet pavement, mid-ground character, background fog and distant city lights.

Shot Size: medium wide, full body visible from head to toe
Angle: eye level, slight low angle to emphasize character's upward gaze
Depth: shallow focus on character, background softly blurred

High-contrast dramatic lighting. Blue neon from left (ECHO billboard) as primary light source, casting cool shadows. Pink neon accent from right creating rim light on character's left side. Scattered warm urban glow in deep background. Color palette: deep blues, electric purple, hot pink accents. Strong chiaroscuro shadows.

Atmospheric: Light rain suspended as droplets catching neon glow. Subtle fog in mid-ground. Wet surfaces reflecting colored light. Cinematic realism with slight stylization. Textures: rain on glass, weathered concrete, glowing holograms.

Style: Stylized cyberpunk with cinematic realism. Blade Runner lighting mood, Christopher Nolan scale and seriousness, 1990s anime expressive silhouettes and emotion.

Negative: no text, logos, watermarks, distorted anatomy, cartoon style, flat lighting, plastic skin, motion blur, walking, running, moving, animation
```

---

## MOTION VERB CONVERSION TABLE

| ❌ DON'T (Motion) | ✅ DO (Static Pose) |
|------------------|-------------------|
| walking | mid-stride, one foot forward |
| running | sprinting pose, airborne moment, both feet off ground |
| turning | twisted torso, head rotated over shoulder |
| looking around | head turned to specific direction |
| reaching for | arm extended toward, hand approaching object |
| sitting down | mid-descent, knees bent, hovering above seat |
| jumping | airborne, legs bent, arms raised |

---

## USE CASES

### First Frame (Kling Input)
Generate the opening frame of a Kling video shot. This can optionally be used as image-to-video input in Kling if supported.

**Focus:** Capture the START pose of the action described in shot intent.

Example: If action is "character walks down alley," first frame shows character at START of alley, mid-stride.

### Last Frame (Continuity Reference)
Generate the closing frame of a Kling video shot for continuity planning across shots.

**Focus:** Capture the END pose of the action described in shot intent.

Example: If action is "character walks down alley," last frame shows character at END of alley, mid-stride deeper in space.

### Reference Image (Visual Guide)
Generate reference images for `reference/characters/{ID}/` or `reference/locations/{ID}/` directories.

**Focus:** Clear, neutral presentation of identity anchors. Minimize dramatic effects, maximize clarity of features.

---

## LINTER CHECKLIST

Before submitting, verify:
- ✅ Version tag present (YYYY-MM-DD)
- ✅ Frame type specified (first_frame / last_frame / reference)
- ✅ Full character description with STATIC POSE (if character present)
- ✅ Full location description with ALL visual anchors
- ✅ Composition specified (framing, shot size, angle, depth)
- ✅ Lighting + color palette described
- ✅ Style references included
- ✅ Negative prompt included
- ✅ NO motion verbs (walking, running, turning, moving)
- ✅ NO time progression (then, after, before)
- ✅ No cross-references to other shots

---

## COMPILATION WORKFLOW

1. Load `bible/characters.json` → extract character identity anchors
2. Load `bible/locations.json` → extract location identity anchors
3. Load `bible/visual_style.json` → extract style canon
4. Load `storyboard/shot_intent.json` → extract shot action
5. **Convert action to static pose:** "walks down alley" → "mid-stride, one foot forward"
6. Merge into this template structure
7. Run `npm run lint` to validate
8. Generate in Nano Banana Pro 3 UI
9. Save to appropriate directory (prompts/ or reference/)

---

**DO NOT GENERATE ACTUAL PROMPTS IN PHASE 1**

This template is infrastructure only. Actual prompt generation happens in Phase 2.
