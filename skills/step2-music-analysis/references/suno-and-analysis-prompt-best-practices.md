# Step 2 Prompt Best Practices (Suno + Analysis AI)

Use this guide when Step 2 requires generating prompts for music generation or music analysis.

---

## Suno Prompt Writing (`suno_prompt.txt`)

### Required Elements

1. **Genre + subgenre**: Name the primary genre and any fusion elements (e.g., "cinematic synthwave with post-rock crescendos").
2. **Mood trajectory**: Describe the emotional arc across the song (start → peak → resolve).
3. **BPM/tempo range**: Specify exact BPM or range (e.g., "88-92 BPM, deliberate and unhurried").
4. **Instrumentation**: List primary instruments and sonic textures.
5. **Vocal style/language**: If vocals are present, describe style, register, and processing.
6. **Song structure cues**: Describe each section (intro/verse/chorus/bridge/outro) with energy level.

### What NOT to Include

The following indicate visual language leaking into a music prompt. Remove all instances:

| Category | Forbidden Terms |
|----------|----------------|
| Camera | pan, dolly, tracking, zoom, framing, lens, wide shot, close-up, push in |
| Lighting | neon, glow, shadow, silhouette, backlit, ambient light, volumetric |
| Scene | alley, rooftop, ocean, city, forest, room, building, corridor |
| Character | she walks, he turns, dancer, protagonist, figure, subject |
| Narrative | discovers the truth, realizes, flashback, montage, scene change |

### Musical Translation Guide

When converting visual concepts to musical equivalents:

| Visual Concept | Musical Translation |
|---------------|-------------------|
| Neon-lit alley | Dark atmospheric synths, reverb-heavy pads |
| Rain-soaked pavement | Gentle percussive textures, water-like delay effects |
| Sunrise over harbor | Major key resolution, ascending melodic phrases |
| Blade Runner lighting | Vangelis-style atmospheric synths, wide stereo field |
| High contrast neon | Bright sustained synth tones with dynamic range |
| Melancholic cyberpunk | Minor keys, slow tempo, yearning melodies |
| Chase scene intensity | Driving percussion, rising filter sweep, staccato bass |
| Intimate close-up | Sparse arrangement, solo instrument, dry mix |
| Wide establishing shot | Full orchestral swell, wide reverb, layered textures |
| Slow-motion movement | Half-time rhythm, drawn-out notes, time-stretch effects |
| Rapid-fire editing | Syncopated rhythms, staccato hits, quick transitions |
| Emotional catharsis | Dynamic build to sustained major chord, layered harmonies |

### Production Vocabulary

Use precise audio production terms:

- **Dynamics**: compressed, dynamic, crescendo, decrescendo, swell, drop, sidechained
- **Space**: dry, wet, reverb-heavy, intimate, cavernous, wide stereo, mono center
- **Texture**: grainy, smooth, distorted, clean, filtered, saturated, lo-fi, hi-fi, bitcrushed
- **Rhythm**: driving, syncopated, straight, swung, polyrhythmic, sparse, dense, four-on-the-floor
- **Melody**: ascending, descending, chromatic, diatonic, pentatonic, modal, atonal, arpegiated
- **Mix**: front-heavy, bass-forward, mid-scooped, bright, dark, balanced, layered

### Section-Specific Guidance

For each song section, describe:

- **Intro**: Energy level, primary texture, how it sets the mood
- **Verse**: Rhythm foundation, vocal placement, harmonic bed
- **Pre-chorus**: Build mechanism (rising filter, added layers, rhythmic density)
- **Chorus**: Peak energy, full instrumentation, melodic hook character
- **Bridge**: Contrast element (key change, stripped arrangement, new texture)
- **Outro**: Resolution approach (fade, hard stop, deconstructed reprise)

---

## Analysis Prompt Usage (for another AI)

When asking another AI to generate `analysis.json`:

### Instruction Template

```
Analyze the attached music track. Output valid JSON only — no markdown code fences, no prose before or after.

Required schema:
{
  "version": "2026-02-08",
  "songTitle": "",
  "artist": "",
  "duration": <seconds>,
  "bpm": <number>,
  "key": "<key> <major/minor>",
  "timeSignature": "<time signature>",
  "sections": [
    {
      "id": "<snake_case_id>",
      "label": "<Display Name>",
      "startSec": <number>,
      "endSec": <number>,
      "duration": <number>,
      "energy": "<low|medium|high|climax>",
      "mood": "<one word>",
      "instruments": ["<instrument1>", "<instrument2>"],
      "vocalPresence": <true|false>,
      "notes": "<brief description>"
    }
  ],
  "keyMoments": [
    {
      "timestamp": <seconds>,
      "type": "<drop|buildup|breakdown|transition|peak>",
      "description": "<brief description>",
      "intensity": <0-100>
    }
  ]
}

Rules:
- Sections must be contiguous (each startSec = previous endSec).
- Every second of the song must be covered by a section.
- Use musically grounded labels for mood (contemplative, aggressive, euphoric, etc.).
- BPM should be the primary tempo, not half-time or double-time.
- Identify at least the major structural transitions as keyMoments.
```

### Validation Criteria

- `analysis.json` parses as valid JSON
- Required keys present: `version`, `duration`, `bpm`, `sections`
- `duration` > 0 and matches actual track length
- `bpm` > 0 and is plausible for the genre (60-200 typical range)
- `sections` is a non-empty array
- Section timing is contiguous: no gaps, no overlaps
- All sections have required fields: `id`, `label`, `startSec`, `endSec`, `energy`

---

## Validation Gate

Before marking Step 2 complete:

- `suno_prompt.txt` is non-empty and music-focused (no visual terms).
- `analysis.json` parses and includes all required keys.
- Values are plausible (duration > 0, bpm > 0, non-empty sections).
- Section timing covers the full song duration without gaps.
- MP3 file exists in the music directory.
