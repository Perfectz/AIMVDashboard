---
name: step2-music-analysis
description: Fill out Step 2 (Upload Music & Analysis) for AIMVDashboard by ensuring music upload plus Suno prompt, song info, and analysis JSON are all complete. Use when asked to complete or verify Step 2 page data.
---

# Step 2: Music & Analysis Skill

Complete all Step 2 artifacts for a target project. This step establishes the musical foundation — the Suno prompt for music generation, song metadata, and the structural analysis that drives shot timing in later steps.

## Prerequisites

- Step 1 should be complete (concept/mood/genre inform music direction).
- Read `projects/<project-id>/music/concept.txt`, `mood.txt`, and `genre.txt` for creative context.

## Required Artifacts

All files live in `projects/<project-id>/music/`:

| File | Purpose |
|------|---------|
| One `.mp3` file | The music track (uploaded by user) |
| `suno_prompt.txt` | Music generation prompt using pure musical language |
| `song_info.txt` | Duration, BPM, structure notes, and context |
| `analysis.json` | Structured music analysis with sections, timing, energy |

## Execute

1. Resolve project ID. Default to `default` if not specified.
2. Verify one `.mp3` file exists in `projects/<project-id>/music/`. If missing, note this gap — the agent cannot generate audio files, but can complete all text artifacts.
3. Read Step 1 outputs (`concept.txt`, `mood.txt`, `genre.txt`) for creative context.
4. Write `suno_prompt.txt` following the Musical Translation Guide below.
5. Write `song_info.txt` with duration, BPM, key, time signature, and structure overview.
6. Write or verify `analysis.json` with the required schema below.
7. If using another AI to generate the analysis, provide strict output format instructions: "Output valid JSON only. No markdown fences. No prose before or after."

### Musical Translation Guide

When writing Suno prompts, translate visual concepts to musical equivalents:

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
| Wide cinematic establishing | Full orchestral swell, wide reverb, layered textures |

### What NOT to Include in Suno Prompts

These words/phrases indicate visual language leaking into a music prompt:

- Camera terms: pan, dolly, tracking, zoom, framing, lens, wide shot, close-up
- Lighting terms: neon, glow, shadow, silhouette, backlit, ambient light
- Scene terms: alley, rooftop, ocean, city, forest, room, building
- Character terms: she walks, he turns, dancer moves, protagonist
- Narrative terms: discovers the truth, realizes, flashback, montage

### analysis.json Schema

```json
{
  "version": "2026-02-08",
  "songTitle": "Title",
  "artist": "Artist",
  "duration": 180,
  "bpm": 120,
  "key": "C minor",
  "timeSignature": "4/4",
  "sections": [
    {
      "id": "intro",
      "label": "Intro",
      "startSec": 0,
      "endSec": 16,
      "duration": 16,
      "energy": "low",
      "mood": "establishing",
      "instruments": ["ambient pads", "sparse percussion"],
      "vocalPresence": false,
      "notes": "Atmospheric buildup"
    }
  ],
  "keyMoments": [
    {
      "timestamp": 48,
      "type": "drop",
      "description": "Chorus hits",
      "intensity": 95
    }
  ]
}
```

Required top-level keys: `version`, `duration`, `bpm`, `sections`.
Each section requires: `id`, `label`, `startSec`, `endSec`, `energy`.
Energy values: `low`, `medium`, `high`, `climax`.
Key moment types: `drop`, `buildup`, `breakdown`, `transition`, `peak`.

### API Path (alternative)

If the server is running:

- `POST /api/save/suno_prompt?project=<id>` — body: `{ "content": "..." }`
- `POST /api/save/song_info?project=<id>` — body: `{ "content": "..." }`
- `POST /api/save/analysis?project=<id>` — body: `{ "content": "<JSON string>" }`

## Platform-Specific Best Practices

### Suno Prompt Construction

Follow this structure for `suno_prompt.txt`:

1. **Genre/subgenre**: Name the primary genre and any fusion elements.
2. **Mood arc**: Describe the emotional trajectory across the song (start → peak → resolve).
3. **Tempo/BPM**: Specify range or exact BPM.
4. **Instrumentation**: List primary instruments and sonic textures.
5. **Production style**: Describe mix characteristics (reverb depth, compression, stereo width, effects).
6. **Vocal characteristics**: Style, register, processing (if applicable).
7. **Structure cues**: Describe sections (intro/verse/chorus/bridge/outro) with energy and mood shifts.

### Production Vocabulary

Use these terms for precise music descriptions:

- **Dynamics**: compressed, dynamic, crescendo, decrescendo, swell, drop
- **Space**: dry, wet, reverb-heavy, intimate, cavernous, wide stereo, mono center
- **Texture**: grainy, smooth, distorted, clean, filtered, saturated, lo-fi, hi-fi
- **Rhythm**: driving, syncopated, straight, swung, polyrhythmic, sparse, dense
- **Melody**: ascending, descending, chromatic, diatonic, pentatonic, modal, atonal

## Quality Checks

Before saving, verify:

1. `suno_prompt.txt` is non-empty and uses pure musical language (no visual/camera terms).
2. `suno_prompt.txt` includes genre, mood arc, tempo, instrumentation, and structure.
3. `song_info.txt` is non-empty and includes duration and BPM.
4. `analysis.json` parses as valid JSON.
5. `analysis.json` contains required keys: `version`, `duration`, `bpm`, `sections`.
6. `analysis.json` values are plausible: duration > 0, bpm > 0, sections array is non-empty.
7. Section timing is contiguous: each section's `startSec` matches the previous section's `endSec`.
8. Cross-reference: mood arc in `suno_prompt.txt` should reflect `mood.txt` from Step 1.

## Completeness Check

```bash
project=default
node -e "
  const fs = require('fs');
  const base = 'projects/' + process.env.P + '/music/';
  let ok = true;
  // Check text files
  for (const f of ['suno_prompt.txt', 'song_info.txt']) {
    const p = base + f;
    if (!fs.existsSync(p)) { console.error('Missing: ' + f); ok = false; continue; }
    if (fs.statSync(p).size === 0) { console.error('Empty: ' + f); ok = false; continue; }
    console.log('OK: ' + f);
  }
  // Check MP3
  const mp3s = fs.readdirSync(base).filter(f => f.endsWith('.mp3'));
  if (mp3s.length === 0) { console.error('No MP3 found'); ok = false; }
  else { console.log('OK: ' + mp3s[0]); }
  // Check analysis.json
  const ap = base + 'analysis.json';
  if (!fs.existsSync(ap)) { console.error('Missing: analysis.json'); ok = false; }
  else {
    try {
      const j = JSON.parse(fs.readFileSync(ap, 'utf8'));
      const req = ['version', 'duration', 'bpm', 'sections'];
      const miss = req.filter(k => !(k in j));
      if (miss.length) { console.error('Missing keys: ' + miss.join(', ')); ok = false; }
      else { console.log('OK: analysis.json (' + (j.sections||[]).length + ' sections)'); }
    } catch (e) { console.error('Invalid JSON: ' + e.message); ok = false; }
  }
  if (!ok) process.exit(1);
  console.log('Step 2 complete.');
" P="$project"
```

## LLM Guidance

- The primary creative task is writing `suno_prompt.txt`. This requires translating the project's visual concept and mood into pure musical language. Use the Musical Translation Guide above.
- Output format for `suno_prompt.txt`: Plain text, flowing prose. No headings, no bullet points.
- Output format for `analysis.json`: Valid JSON only. No markdown code fences. No prose before or after.
- If no MP3 file exists, complete all text artifacts and note the gap. The agent cannot generate audio files.
- Reference `skills/_shared/references/universal-prompt-rules.md` for canon data model context.
- Reference `references/suno-and-analysis-prompt-best-practices.md` for detailed Suno prompt guidance.

Step 2 is complete only when all four artifacts are present and non-empty.
