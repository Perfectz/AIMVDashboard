# Music Analysis Integration Guide

## Overview

This document explains how music analysis data is structured and used for shot timing in AI-generated music videos. The music analysis system captures temporal structure, beat grids, key moments, and energy levels to help create perfectly timed cinematic sequences.

---

## Why Music Analysis Matters

When creating shots for a music video, I (Claude) need to know:
- **When to cut between shots** - Section boundaries (intro, verse, chorus)
- **How to sync action to rhythm** - Beat timestamps for precise timing
- **How intense the visuals should be** - Energy levels and mood
- **Where the peak moments are** - Drops, build-ups, transitions

Without this data, I would have to guess or estimate, leading to shots that don't sync properly with the music.

---

## File Locations

### Per-Project Structure
```
projects/YOUR_PROJECT/
├── music/
│   ├── song.mp3                      # The actual audio file
│   └── analysis.json                 # Music analysis data (NEW)
└── project.json                      # Project metadata (references analysis)
```

### Schema Location
```
schemas/
└── music_analysis_schema.json        # JSON Schema for validation
```

### Example Location
```
examples/
└── music_analysis_example.json       # Reference example with realistic data
```

---

## Music Analysis Schema

The music analysis is stored in `projects/YOUR_PROJECT/music/analysis.json` and follows this structure:

### Tier 1: Essential Fields (Required)

**Basic Metadata**:
```json
{
  "version": "2026-02-07",
  "songTitle": "Echoes in the Dark",
  "artist": "Synthwave Dreams",
  "duration": 180.5,
  "bpm": 128
}
```

**Song Structure** (Most Critical):
```json
{
  "sections": [
    {
      "id": "intro",
      "label": "Intro",
      "startTime": 0,
      "endTime": 8,
      "duration": 8,
      "energy": "low",
      "mood": "mysterious",
      "hasVocals": false,
      "notes": "Atmospheric pad with slow bass pulse"
    },
    {
      "id": "verse1",
      "label": "Verse 1",
      "startTime": 8,
      "endTime": 32,
      "duration": 24,
      "energy": "medium",
      "mood": "introspective",
      "hasVocals": true,
      "notes": "Vocals enter, steady beat begins"
    }
  ]
}
```

Energy levels:
- `"low"` - Ambient, quiet, atmospheric (10-40% intensity)
- `"medium"` - Steady beat, building (40-70% intensity)
- `"high"` - Full energy, chorus peaks (70-90% intensity)
- `"climax"` - Peak moments, drops, final chorus (90-100% intensity)

---

### Tier 2: Highly Useful Fields

**Beat Grid** (for precise sync):
```json
{
  "beatGrid": {
    "beats": [0, 0.46875, 0.9375, 1.40625, 1.875],
    "downbeats": [0, 1.875, 3.75, 5.625, 7.5],
    "bars": [0, 1.875, 3.75, 5.625, 7.5]
  }
}
```

**Key Moments** (for dramatic timing):
```json
{
  "keyMoments": [
    {
      "timestamp": 32,
      "type": "drop",
      "description": "First chorus drop",
      "intensity": 90
    },
    {
      "timestamp": 80,
      "type": "breakdown",
      "description": "Bridge instrumental breakdown",
      "intensity": 95
    }
  ]
}
```

Event types:
- `"drop"` - Bass drop, chorus entry (high-energy moment)
- `"buildup"` - Tension building toward a drop
- `"breakdown"` - Instrumental break, intensity surge
- `"transition"` - Section change, mood shift
- `"peak"` - Maximum energy point
- `"vocal_entry"` / `"vocal_exit"` - Vocal presence changes
- `"instrumental_break"` - No vocals, instrumental focus

---

### Tier 3: Nice to Have

**Energy Curve** (for visualizations):
```json
{
  "energyCurve": [
    { "timestamp": 0, "energy": 20 },
    { "timestamp": 32, "energy": 85 },
    { "timestamp": 104, "energy": 100 },
    { "timestamp": 180.5, "energy": 10 }
  ]
}
```

**Tempo Changes** (if BPM varies):
```json
{
  "tempoChanges": [
    { "timestamp": 90, "bpm": 140 },
    { "timestamp": 120, "bpm": 128 }
  ]
}
```

**Time Signature & Key**:
```json
{
  "timeSignature": "4/4",
  "key": "D minor"
}
```

**Analysis Source**:
```json
{
  "analysisSource": "Suno API v3.5 + Manual Curation",
  "analyzedAt": "2026-02-07T10:30:00Z",
  "notes": "BPM confirmed at 128, steady throughout."
}
```

---

## How I Use This Data for Shot Timing

### 1. Section-Based Shot Planning
Each section gets dedicated shots based on energy/mood:
```
Intro (0-8s, energy: low)
  → Shot 01: Wide establishing shot, slow camera drift

Verse 1 (8-32s, energy: medium)
  → Shot 02-04: Character introduction, steady movement

Chorus 1 (32-56s, energy: high)
  → Shot 05-07: Dynamic angles, faster cuts, action peaks
```

### 2. Beat-Synced Action
Using beat grid timestamps:
```
Shot 05 (starts at 32.0s)
- Action: Character spins at 32.0s (downbeat)
- Camera: Push-in motion synced to 32.0, 33.875, 35.75 (every 2 beats)
```

### 3. Energy-Matched Visual Intensity
- **Low energy** → Slow dolly, wide shots, ambient lighting
- **Medium energy** → Steady tracking, medium shots, balanced action
- **High energy** → Fast whip pans, close-ups, explosive action
- **Climax energy** → Extreme angles, maximum motion, peak visuals

### 4. Key Moment Choreography
At drops/transitions:
```json
{ "timestamp": 104, "type": "drop", "intensity": 100 }
```
→ Create shot with:
- Action peaks exactly at 104.0s
- Camera movement climaxes at drop
- Visual effects trigger at precise moment

---

## How Another AI Provides This Data

### Option A: Suno API Export
If you generate music with Suno, request:
1. Song metadata (title, artist, duration, BPM)
2. Section timestamps (auto-detected by Suno)
3. Beat grid (if available via API)

Then paste the JSON response into `projects/YOUR_PROJECT/music/analysis.json`.

### Option B: Audio Analysis Tool
Use tools like:
- **Essentia** (open-source music analysis)
- **Spotify API** (if song is on Spotify)
- **Librosa** (Python library for audio analysis)
- **Sonic Visualiser** (manual analysis tool)

These can extract:
- BPM detection
- Beat tracking
- Section segmentation
- Key/tempo detection

### Option C: Manual Input
If no AI tool is available:
1. Listen to the song in a DAW (Digital Audio Workstation)
2. Mark section boundaries manually
3. Note the BPM (use a tap tempo tool)
4. Identify key moments (drops, transitions)
5. Fill out `analysis.json` by hand

---

## Example Workflow

### Step 1: Generate/Upload Music
```bash
# User uploads song.mp3 to projects/my-video/music/
```

### Step 2: Analyze Music (via AI or tool)
```bash
# AI tool generates analysis.json
# OR user manually creates analysis.json
```

### Step 3: Validate Analysis
```bash
npm run validate
# Checks analysis.json against schema
```

### Step 4: Claude Reads Analysis
```
User: "Create shots for the first chorus"

Claude reads: projects/my-video/music/analysis.json
  → Finds chorus1 section: 32-56s, energy: high, mood: euphoric
  → Creates 3 shots (8 seconds each)
  → Shot 05 (32-40s): High-energy action, dynamic camera
  → Shot 06 (40-48s): Continued momentum, varied angle
  → Shot 07 (48-56s): Climax of chorus, extreme close-up
```

### Step 5: Generate Prompts
```
Claude writes shot intents with precise timing:
- startTime: 32.0
- endTime: 40.0
- energy: "high"
- beatSync: [32.0, 33.875, 35.75, 37.625, 39.5]
```

---

## Validation

The schema includes validation rules:
- Duration must be > 0
- BPM must be 40-240
- Energy must be one of: low, medium, high, climax
- Timestamps must be sequential (endTime > startTime)
- Beat timestamps must be in ascending order

Run validation:
```bash
npm run validate
```

---

## Minimum Required Data

If you can't get full analysis, I can work with just:

**Absolute Minimum**:
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
      "duration": 180,
      "energy": "medium"
    }
  ]
}
```

**Recommended Minimum**:
```json
{
  "version": "2026-02-07",
  "songTitle": "Your Song",
  "duration": 180,
  "bpm": 120,
  "sections": [
    { "id": "intro", "label": "Intro", "startTime": 0, "endTime": 10, "duration": 10, "energy": "low" },
    { "id": "verse1", "label": "Verse 1", "startTime": 10, "endTime": 40, "duration": 30, "energy": "medium" },
    { "id": "chorus1", "label": "Chorus 1", "startTime": 40, "endTime": 70, "duration": 30, "energy": "high" },
    { "id": "verse2", "label": "Verse 2", "startTime": 70, "endTime": 100, "duration": 30, "energy": "medium" },
    { "id": "chorus2", "label": "Chorus 2", "startTime": 100, "endTime": 160, "duration": 60, "energy": "climax" },
    { "id": "outro", "label": "Outro", "startTime": 160, "endTime": 180, "duration": 20, "energy": "low" }
  ]
}
```

---

## Questions?

Common questions answered:

**Q: What if I don't have exact beat timestamps?**
A: That's fine! I can calculate approximate beats from BPM. Section boundaries are more important.

**Q: Can I update analysis.json after starting?**
A: Yes! If you refine the analysis later, just update the file and I'll use the new data.

**Q: What if my song has tempo changes?**
A: Fill in the `tempoChanges` array with timestamp + new BPM for each change.

**Q: How precise do timestamps need to be?**
A: Section boundaries: ±1 second is fine. Beat grid: try for ±0.05s accuracy if possible.

**Q: Can I use this for non-music videos?**
A: Yes! You can define "sections" based on narrative beats instead of musical sections.

---

## See Also

- [examples/music_analysis_example.json](../examples/music_analysis_example.json) - Full example with all fields
- [schemas/music_analysis_schema.json](../schemas/music_analysis_schema.json) - JSON Schema definition
- [User Guide](../ui/guide.html) - Complete system documentation
