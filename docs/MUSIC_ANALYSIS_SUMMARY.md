# Music Analysis System - Implementation Summary

## Date: 2026-02-07

## What Was Added

I've implemented a comprehensive music analysis system to help structure shot timing based on musical data. This system allows you (or another AI) to provide structured temporal information about music, which I (Claude) can then use to create perfectly timed shots.

---

## New Files Created

### 1. **schemas/music_analysis_schema.json** (210 lines)
JSON Schema defining the structure for music analysis data.

**Key sections**:
- Basic metadata (title, artist, duration, BPM, time signature, key)
- Song sections with timestamps, energy levels, and mood
- Beat grid (beats, downbeats, bars)
- Key moments (drops, build-ups, transitions)
- Tempo changes
- Energy curve
- Analysis source tracking

### 2. **examples/music_analysis_example.json** (162 lines)
Complete working example showing realistic music analysis data.

**Shows**:
- 180-second synthwave song at 128 BPM
- 7 sections (intro, verse1, chorus1, verse2, bridge, chorus2, outro)
- Beat grid with precise timestamps
- 7 key moments (transitions, drops, build-ups)
- Energy curve with 8 sample points
- Full metadata and notes

### 3. **docs/MUSIC_ANALYSIS.md** (450+ lines)
Comprehensive documentation explaining:
- Why music analysis matters
- What information Claude needs
- Schema structure (Tier 1/2/3 fields)
- How Claude uses data for shot timing
- How to get music analysis (3 methods)
- Validation instructions
- Example workflows
- Minimum required data vs. recommended data

### 4. **docs/MUSIC_ANALYSIS_SUMMARY.md** (this file)
Quick reference summary of what was implemented.

### 5. **README.md** (updated)
Added "Music Analysis System" section between "Multi-Project Management" and "Visual Reference System".

**Covers**:
- Why music analysis is needed
- File location within project structure
- Essential music data requirements
- Advanced optional features
- Three methods to obtain analysis
- Validation instructions
- Example workflow

---

## How It Works

### User Provides Music Analysis

You (or another AI tool) creates a file at:
```
projects/YOUR_PROJECT/music/analysis.json
```

This file contains structured data about the music:

```json
{
  "version": "2026-02-07",
  "songTitle": "Your Song",
  "duration": 180,
  "bpm": 128,
  "sections": [
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

### Claude Uses Analysis for Shot Timing

When you ask me to create shots, I read the analysis and:

1. **Map shots to sections** - Each section gets appropriate shots
2. **Match energy levels** - High-energy sections get dynamic visuals
3. **Sync to beats** - Action peaks align with beat timestamps
4. **Time key moments** - Drops/transitions get special choreography

**Example**:
```
User: "Create shots for the first chorus"

Claude reads: analysis.json
  → Finds chorus1: 32-56s, energy: high, mood: euphoric
  → Creates 3 shots (8 seconds each):
    - Shot 05 (32-40s): High-energy action, dynamic camera
    - Shot 06 (40-48s): Continued momentum, varied angle
    - Shot 07 (48-56s): Climax of chorus, extreme close-up
```

---

## Three Ways to Get Music Analysis

### Method 1: AI Music Tool (Recommended)
If you use Suno or similar:
- Export metadata directly from the tool
- Tools often provide BPM, duration, and section timestamps
- Paste into `analysis.json`

### Method 2: Audio Analysis Software
Use tools like:
- Essentia (open-source)
- Spotify API (if song is on Spotify)
- Librosa (Python library)
- Sonic Visualiser (manual analysis GUI)

These can automatically detect:
- BPM
- Beat grid
- Section boundaries
- Key/tempo

### Method 3: Manual Input
Listen to the song in a DAW and:
- Mark section boundaries by ear
- Measure BPM with tap tempo
- Note key moments (drops, transitions)
- Fill out JSON by hand

---

## Validation

The system validates `music/analysis.json` against the schema:

```bash
npm run validate
```

**Checks**:
- All required fields present
- BPM in valid range (40-240)
- Energy levels are valid (low/medium/high/climax)
- Timestamps are sequential (endTime > startTime)
- Beat timestamps in ascending order

---

## Minimum vs. Recommended Data

### Absolute Minimum (Claude can work with this)
```json
{
  "version": "2026-02-07",
  "songTitle": "Your Song",
  "duration": 180,
  "bpm": 120,
  "sections": [
    {
      "id": "full_song",
      "label": "Full Song",
      "startTime": 0,
      "endTime": 180,
      "energy": "medium"
    }
  ]
}
```

### Recommended Minimum (much better)
```json
{
  "version": "2026-02-07",
  "songTitle": "Your Song",
  "duration": 180,
  "bpm": 120,
  "sections": [
    { "id": "intro", "startTime": 0, "endTime": 10, "energy": "low" },
    { "id": "verse1", "startTime": 10, "endTime": 40, "energy": "medium" },
    { "id": "chorus1", "startTime": 40, "endTime": 70, "energy": "high" },
    { "id": "verse2", "startTime": 70, "endTime": 100, "energy": "medium" },
    { "id": "chorus2", "startTime": 100, "endTime": 160, "energy": "climax" },
    { "id": "outro", "startTime": 160, "endTime": 180, "energy": "low" }
  ]
}
```

### Ideal (best results)
Include:
- All section data
- Beat grid (precise beat timestamps)
- Key moments (drops, transitions, build-ups)
- Energy curve
- Mood per section

See [examples/music_analysis_example.json](../examples/music_analysis_example.json).

---

## Energy Level Guide

- **`"low"`** (10-40% intensity)
  - Ambient, quiet, atmospheric
  - Visual: Slow camera drifts, wide shots, minimal action

- **`"medium"`** (40-70% intensity)
  - Steady beat, building energy
  - Visual: Tracking shots, balanced action, medium shots

- **`"high"`** (70-90% intensity)
  - Full energy, chorus peaks
  - Visual: Dynamic angles, faster cuts, active motion

- **`"climax"`** (90-100% intensity)
  - Peak moments, drops, final chorus
  - Visual: Extreme angles, maximum motion, explosive action

---

## Integration with Existing Workflow

This system fits into the existing Phase 2 workflow:

**Before** (without music analysis):
1. Generate music
2. Manually note duration/BPM
3. Create shots by intuition
4. Hope timing works out

**After** (with music analysis):
1. Generate music
2. **Create analysis.json with precise section data**
3. Claude reads analysis and creates perfectly timed shots
4. Each shot has exact startTime/endTime from sections
5. Action syncs to beat grid
6. Energy matches visual intensity

---

## Next Steps for User

When you're ready to collaborate on a music video:

1. **Provide Music**:
   - Already have an MP3? Upload it.
   - Need music? We'll design a Suno prompt first.

2. **Provide Analysis**:
   - If you have music: Create `analysis.json` (manually or via tool)
   - If we're making music: Extract analysis from Suno after generation

3. **Provide Script/Concept**:
   - Full written script
   - Beat-by-beat breakdown
   - Or rough concept (I'll help structure it)

4. **Discuss Characters/Locations**:
   - You describe them, or
   - I propose options based on the music/concept

5. **I Generate Everything**:
   - Write all Bible JSON files (characters, locations, visual_style, cinematography)
   - Create shot intents based on `analysis.json` sections
   - Compile all prompts (Kling A/B/C/D, Nano Banana, Suno)

6. **You Use the UI**:
   - Browse prompts
   - Copy to clipboard
   - Paste into AI tools
   - Render videos

---

## Technical Notes

### Schema Validation
- Uses JSON Schema Draft 07
- Validates with `ajv` library (already installed)
- Regex patterns for time signatures, musical keys
- Enum constraints for energy levels, event types

### File Locations
```
projects/YOUR_PROJECT/
├── music/
│   ├── song.mp3                 # Audio file
│   └── analysis.json            # Music analysis (NEW)
├── bible/
│   └── ...                      # Canon files
└── prompts/
    └── ...                      # Generated prompts
```

### No UI Changes Needed
- Analysis is used during shot creation (in chat with Claude)
- UI continues to display prompts, storyboard, file uploads
- Analysis file is optional (Claude can work without it, but results are better with it)

---

## Summary

**What**: Structured music analysis system to store temporal data about songs

**Why**: Enables precise shot timing, beat synchronization, and energy-matched visuals

**How**: JSON file per project with sections, beats, key moments, and energy levels

**Who provides it**: You, another AI, or audio analysis tools

**Who uses it**: Claude (me) when creating shot intents and compiling prompts

**Result**: Perfectly timed shots that sync with music structure and energy

---

## Questions Answered

**Q: Is this required?**
A: No, it's optional. But shot timing will be much more precise with it.

**Q: Can I update it later?**
A: Yes! Update `analysis.json` anytime and Claude will use the new data.

**Q: What if I don't have beat timestamps?**
A: Section boundaries and energy levels are most important. Claude can estimate beats from BPM.

**Q: Can another AI create this file?**
A: Absolutely! That's one of the primary use cases. Format the output as the schema and save it.

**Q: How precise do timestamps need to be?**
A: Section boundaries: ±1 second is fine. Beat grid: ±0.05s if possible.

---

## Files to Reference

- **Schema**: [schemas/music_analysis_schema.json](../schemas/music_analysis_schema.json)
- **Example**: [examples/music_analysis_example.json](../examples/music_analysis_example.json)
- **Documentation**: [docs/MUSIC_ANALYSIS.md](MUSIC_ANALYSIS.md)
- **Main README**: [README.md](../README.md) (see "Music Analysis System" section)
