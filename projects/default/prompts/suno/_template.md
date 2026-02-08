# Suno Music Generation Prompt Template

**Version:** 2026-02-07
**Created:** [YYYY-MM-DD]
**Type:** [full_song | section_reference]

---

## PURPOSE

Suno generates **music**, not visuals. Prompts must describe:
- Musical genre and style
- Mood and emotion
- Instrumentation
- Tempo and rhythm
- Song structure

**CRITICAL:** No visual descriptions. No character/location references. Music-focused only.

---

## PROMPT STRUCTURE

### SECTION 1: Genre & Style
```
Primary Genre: [e.g., electronic, synthwave, ambient, industrial, cinematic]
Sub-genres: [e.g., dark synthwave, cyberpunk electronic, neo-noir ambient]
Influences: [e.g., Blade Runner soundtrack, Vangelis, Trent Reznor]

Example:
Primary Genre: Dark electronic synthwave
Sub-genres: Cyberpunk electronica, neo-noir ambient
Influences: Blade Runner soundtrack (Vangelis), Nine Inch Nails industrial textures, Trent Reznor atmospheric scores
```

### SECTION 2: Mood & Emotion
```
Overall Mood: [e.g., melancholic, tense, hopeful, mysterious, contemplative]
Emotional Arc: [e.g., starts introspective, builds to cathartic, resolves in acceptance]
Atmosphere: [e.g., dark and moody, dreamlike, intense and driving]

Example:
Overall Mood: Melancholic with undercurrent of hope
Emotional Arc: Begins contemplative and isolated, gradually builds tension and urgency, resolves in bittersweet acceptance
Atmosphere: Dark and moody but not aggressive, dreamlike quality with grounded rhythmic elements
```

### SECTION 3: Instrumentation
```
Primary Instruments: [list main sound sources]
Secondary/Texture: [atmospheric elements, pads, effects]
Signature Sounds: [distinctive timbres that define the track]

Example:
Primary: Deep analog synthesizers, arpeggiated sequences, sub bass
Secondary: Atmospheric pads, reverb-drenched textures, vinyl crackle, rain sound textures
Signature: Detuned saw wave lead, metallic percussion hits, slow-attack synth swells
```

### SECTION 4: Tempo & Rhythm
```
BPM: [specific or range, e.g., 85-90 BPM, slow 70 BPM, uptempo 128 BPM]
Rhythm Feel: [e.g., steady four-on-floor, syncopated, driving, laid-back]
Groove: [e.g., mechanical and precise, loose and human, pulsing]

Example:
BPM: 85 BPM (slow, deliberate)
Rhythm: Steady kick drum on downbeats, syncopated hi-hat patterns
Groove: Mechanical precision with occasional human imperfection, pulsing forward motion
```

### SECTION 5: Song Structure
```
Intro: [duration and character]
Verses: [structure and feel]
Chorus: [emotional peak, instrumentation]
Bridge: [contrast or build]
Outro: [resolution]

Example:
Intro (0:00-0:30): Ambient pad wash, subtle bass pulse, establishing atmosphere
Verse 1 (0:30-1:15): Arpeggiated synth enters, kick drum pattern begins, builds texture
Chorus (1:15-2:00): Full instrumentation, lead synth melody, emotional peak with layered textures
Verse 2 (2:00-2:45): Return to arpeggiated foundation, variation on verse 1 pattern
Chorus (2:45-3:30): Intensified version, additional harmonic layers
Bridge (3:30-4:00): Breakdown to atmospheric elements, tension build
Outro (4:00-4:45): Gradual fade of layers, return to ambient wash, resolution
```

### SECTION 6: Production Style
```
Mix: [e.g., spacious with reverb, tight and punchy, lo-fi and warm]
Dynamics: [e.g., wide dynamic range, compressed and consistent, subtle swells]
Effects: [key processing like reverb depth, delay timing, distortion character]

Example:
Mix: Spacious and atmospheric, generous reverb creating depth, sub bass felt more than heard
Dynamics: Moderate compression maintaining punch while preserving breath and swell
Effects: Long reverb tails (2-3 seconds), dotted-eighth delay on lead, subtle analog-style saturation
```

---

## COMPLETE EXAMPLE PROMPT

```
Version: 2026-02-07
Type: full_song

Genre & Style:
Dark electronic synthwave with cyberpunk atmosphere. Neo-noir ambient influences. Drawing from Blade Runner soundtrack (Vangelis), Nine Inch Nails industrial textures, and modern cinematic electronic scores.

Mood & Emotion:
Melancholic with undercurrent of hope. Contemplative and introspective opening, building gradual tension and urgency, resolving in bittersweet acceptance. Dark and moody atmosphere without aggression. Dreamlike quality grounded by rhythmic pulse.

Instrumentation:
Primary: Deep analog synthesizers, arpeggiated sequences in minor key, warm sub bass
Secondary: Lush atmospheric pads, reverb-drenched textures, vinyl crackle, subtle rain ambience
Signature: Detuned saw wave lead synth, metallic percussion accents, slow-attack synth swells

Tempo & Rhythm:
85 BPM, slow and deliberate pace
Steady kick drum on downbeats, syncopated closed hi-hat patterns
Mechanical precision with occasional humanized timing, pulsing forward motion

Song Structure:
Intro (0:00-0:30): Ambient pad wash, subtle bass pulse establishing atmosphere, distant echoes
Verse 1 (0:30-1:15): Arpeggiated synth pattern enters, kick drum begins, layering textures
Chorus (1:15-2:00): Full instrumentation, lead synth melody emerges, emotional peak with harmonic richness
Verse 2 (2:00-2:45): Return to arpeggiated foundation, variation on verse 1 with additional countermelody
Chorus (2:45-3:30): Intensified reprise, added harmonic layers and texture density
Bridge (3:30-4:00): Breakdown to core atmospheric elements, tension build with rising filter sweeps
Outro (4:00-4:45): Gradual fade of layers, return to opening ambient wash, gentle resolution

Production Style:
Spacious atmospheric mix with generous reverb creating sense of depth and scale. Sub bass felt in chest more than heard. Moderate compression maintaining rhythmic punch while preserving dynamic swells and breath. Long reverb tails (2-3 seconds), dotted-eighth delay on lead synth, subtle analog-style saturation for warmth.
```

---

## WHAT NOT TO INCLUDE

❌ **Visual Descriptions:**
- "Neon lights flicker"
- "Character walks through alley"
- "Rain on pavement"
- "Cyberpunk cityscape"

❌ **Narrative Events:**
- "When the character discovers the truth"
- "As the protagonist escapes"
- "During the chase scene"

❌ **Literal Sync Points:**
- "At 1:23 when character turns"
- "Music swells when protagonist sees X"

✅ **Musical Descriptions Only:**
- "Tension builds through rising filter sweep"
- "Emotional release via harmonic resolution"
- "Rhythmic drive intensifies with layered percussion"

---

## SECTION-SPECIFIC PROMPTS

For targeting specific emotional sections of the video, create section reference prompts:

**Type:** section_reference
**Section:** [intro | verse_1 | chorus | bridge | outro]
**Timestamp:** [start - end]
**Mood for this section:** [specific emotional quality]

Example:
```
Type: section_reference
Section: bridge
Timestamp: 2:30 - 3:00
Mood: Moment of realization, tension release transitioning to acceptance

Breakdown to minimal elements: solo arpeggiated synth and bass pulse. Gradual introduction of ascending melodic motif suggesting hope. Filter opening slowly from dark to bright. Sparse percussion creating space and anticipation. Building toward emotional resolution.
```

---

## LINTER CHECKLIST

Before submitting, verify:
- ✅ Version tag present (YYYY-MM-DD)
- ✅ Type specified (full_song / section_reference)
- ✅ Genre and style described
- ✅ Mood and emotional arc defined
- ✅ Instrumentation detailed
- ✅ Tempo and rhythm specified
- ✅ Song structure outlined (if full_song)
- ✅ Production style described
- ✅ NO visual descriptions (neon, alley, character, rain)
- ✅ NO narrative events
- ✅ Music-focused language only

---

## COMPILATION WORKFLOW

1. Load `bible/project.json` → extract music metadata (duration, sections)
2. Load `bible/visual_style.json` → translate visual mood to musical mood
   - "high-contrast cyberpunk" → "dark electronic with dramatic dynamics"
   - "Blade Runner lighting" → "Vangelis-inspired atmospheric synths"
3. Define BPM and structure based on video pacing
4. Describe instrumentation that matches visual atmosphere (not literally)
5. Create section breakdowns aligned with visual beat map
6. Generate in Suno UI
7. Export and place in `music/` directory

---

## MUSICAL TRANSLATION GUIDE

How to translate visual canon into musical choices:

| Visual Element | Musical Translation |
|---------------|-------------------|
| Neon lights | Bright sustained synth tones, shimmering pads |
| Rain/wet surfaces | Reverb depth, delay washes, textural ambience |
| High contrast lighting | Wide dynamic range, dramatic swells and drops |
| Cyberpunk cityscape | Electronic/synthetic instrumentation, digital textures |
| Melancholic mood | Minor keys, slow tempo, yearning melodic phrases |
| Blade Runner influence | Vangelis-style atmospheric synths, cinematic scope |
| 1990s anime emotion | Expressive melodic lines, emotional harmonic progressions |

---

**DO NOT GENERATE ACTUAL PROMPTS IN PHASE 1**

This template is infrastructure only. Music generation happens early in Phase 2 to establish timing for shot planning.
