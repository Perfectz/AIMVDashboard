# Kling 3.0 Prompt Template

**Version:** 2026-02-07
**Created:** [YYYY-MM-DD]
**Shot ID:** [SHOT_XX]
**Variation:** [A/B/C/D]

---

## PROMPT STRUCTURE

This template shows the complete anatomy of a Kling 3.0 prompt. All sections are MANDATORY unless marked optional.

### SECTION 1: Character Description (if character present)
```
[FULL CHARACTER DESCRIPTION FROM bible/characters.json]

Include ALL of:
- physicalCore: age, build, height, skinTone
- faceSignature: structure, eyes, hair, distinctive features
- costume: description, color palette, signature item

Example:
Young woman in early 30s, athletic build, tall, olive skin. Angular face with sharp jawline, high cheekbones. Bright green eyes, short black hair with slight tousled texture. Black leather jacket with red accent stripe on sleeves, dark fitted jeans, combat boots.
```

### SECTION 2: Location Description
```
[FULL LOCATION DESCRIPTION FROM bible/locations.json]

Include ALL of:
- setting: type, scale, architecture, time of day
- atmosphere: lighting, weather, color palette
- visualAnchors: ALL signature elements

Example:
Narrow urban alley, approximately 3 meters wide, cyberpunk cityscape. Wet pavement reflecting neon lights. Flickering holographic billboard reading "ECHO" in blue and pink light on left wall. Weathered brick walls with scattered graffiti. Night setting. High-contrast dramatic lighting from neon signs and street lights. Color palette: deep blues, electric purple, hot pink accents. Rain-slicked surfaces, light fog adding atmospheric depth.
```

### SECTION 3: Action (ONE ONLY - 8 second duration)
```
[WHAT HAPPENS - from storyboard/shot_intent.json]

Describe ONE continuous action suitable for 8-second shot.

DO:
- "Character walks slowly down the alley, looking up at the flickering signs"
- "Character stops mid-alley, turns head to look over shoulder"
- "Camera reveals character standing still, rain falling around them"

DON'T:
- "Character walks, then stops, then turns around, then looks up" (TOO MANY ACTIONS)
- "Character enters alley from street" (implies scene cut)
```

### SECTION 4: Camera
```
Shot Size: [extreme close-up | close-up | medium shot | medium wide | wide shot | extreme wide]

Lens: [24mm wide | 35mm anamorphic | 50mm | 85mm portrait]

Movement: [push in | pull back | dolly tracking | slow pan | crane up | orbit | static hold]

Speed: [slow | medium]

Focus: [shallow depth of field | deep focus]

Example:
Shot Size: medium wide
Lens: 35mm anamorphic
Movement: slow push in toward character
Speed: slow
Focus: shallow depth of field on character, background softly blurred
```

### SECTION 5: Composition
```
Framing: [rule of thirds | centered | symmetrical | leading lines | depth layering]

Example:
Framing: rule of thirds, character positioned on right third, neon billboard on left creates visual balance
```

### SECTION 6: Lighting & Atmosphere
```
[FROM bible/visual_style.json]

Include:
- Lighting quality
- Light sources
- Color palette (confirm matches location and style canon)
- Atmospheric effects

Example:
High-contrast dramatic lighting. Primary light sources: blue neon from left (billboard), pink neon accent from right, scattered urban glow. Color palette: deep blues, electric purple, hot pink accents. Atmospheric: light rain visible in neon glow, subtle fog adding depth, volumetric light rays through moisture.
```

### SECTION 7: Style References
```
[FROM bible/visual_style.json]

Overall style: Stylized cyberpunk with cinematic realism
Influences: Blade Runner lighting + mood, Christopher Nolan scale + seriousness, 1990s anime expressive silhouettes
Texture: cinematic realism with atmospheric depth, rain on glass, weathered concrete, glowing holograms
```

### SECTION 8: Negative Prompt (REQUIRED)
```
Negative: no text, logos, watermarks, distorted anatomy, cartoon style, flat lighting, plastic skin, camera shake
```

---

## COMPLETE EXAMPLE PROMPT

```
Version: 2026-02-07
Shot: SHOT_01
Variation: A

Young woman in early 30s, athletic build, tall, olive skin. Angular face with sharp jawline and high cheekbones. Bright green eyes, short black hair with slight tousled texture. Black leather jacket with red accent stripe on sleeves, dark fitted jeans, combat boots.

Narrow urban alley, approximately 3 meters wide, cyberpunk cityscape. Wet pavement reflecting neon lights. Flickering holographic billboard reading "ECHO" in blue and pink light on left wall. Weathered brick walls. Night. High-contrast dramatic lighting from neon signs. Color palette: deep blues, electric purple, hot pink accents. Rain-slicked surfaces, light fog.

Character walks slowly down the alley, head tilted upward, looking at the flickering neon signs overhead.

Shot Size: medium wide
Lens: 35mm anamorphic
Movement: slow dolly tracking following character from behind
Speed: slow
Focus: shallow depth of field on character

Framing: rule of thirds, character positioned on right third, neon billboard on left creates visual balance, depth layering with foreground rain and background fog.

High-contrast dramatic lighting. Blue neon from left billboard, pink neon accent from right, scattered urban glow. Atmospheric: light rain visible in neon glow, subtle fog adding depth, volumetric light rays.

Style: Stylized cyberpunk with cinematic realism. Blade Runner lighting + mood, Christopher Nolan scale, 1990s anime expressive silhouettes. Cinematic realism with atmospheric depth, rain on glass, weathered concrete, glowing holograms.

Negative: no text, logos, watermarks, distorted anatomy, cartoon style, flat lighting, plastic skin, camera shake
```

---

## VARIATION STRATEGY (A/B/C/D)

For each shot, generate 4 variations. **VARY ONLY:**
- Lens choice (24mm / 35mm / 50mm / 85mm)
- Camera angle (high / eye-level / low)
- Camera movement type
- Composition (rule-of-thirds / centered / etc.)

**NEVER VARY:**
- Character identity anchors (physical, face, costume)
- Location identity anchors (visual anchors, palette, architecture)
- Action (keep same action across all 4)
- Wardrobe
- Color palette

### Example Variations:

**Option A:** 35mm anamorphic, eye-level, slow push in, rule of thirds
**Option B:** 50mm, low angle looking up, static hold, centered
**Option C:** 24mm wide, high angle, slow pan following, leading lines
**Option D:** 85mm portrait, eye-level, dolly tracking, depth layering

---

## LINTER CHECKLIST

Before submitting, verify:
- ✅ Version tag present (YYYY-MM-DD)
- ✅ Full character description (if character present)
- ✅ Full location description with ALL visual anchors
- ✅ ONE action only (8-second suitable)
- ✅ Camera: shot size, lens, movement, focus specified
- ✅ Composition specified
- ✅ Lighting + color palette described
- ✅ Style references included
- ✅ Negative prompt included
- ✅ No cross-references to other shots
- ✅ No scene cuts or location changes
- ✅ No ambiguous/conflicting camera directions

---

## COMPILATION WORKFLOW

1. Load `bible/characters.json` → extract character identity anchors
2. Load `bible/locations.json` → extract location identity anchors
3. Load `bible/visual_style.json` → extract style canon
4. Load `bible/cinematography.json` → extract camera rules
5. Load `storyboard/shot_intent.json` → extract shot-specific action
6. Merge all above into this template structure
7. Generate 4 variations (A/B/C/D) by varying camera only
8. Run `npm run lint` to validate
9. View in UI: `npm run serve`

---

**DO NOT GENERATE ACTUAL PROMPTS IN PHASE 1**

This template is infrastructure only. Actual prompt generation happens in Phase 2 after:
- User fills in `bible/characters.json` and `bible/locations.json`
- User creates visual reference images
- User provides song duration and creates shot intents
