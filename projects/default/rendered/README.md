# Rendered Assets

This directory contains all AI-generated assets (videos and images) and storyboard data.

## Directory Structure

```
rendered/
├── shots/              Generated videos and images organized by shot
│   ├── SHOT_01/
│   │   ├── kling_option_A.mp4
│   │   ├── kling_option_B.mp4
│   │   ├── kling_option_C.mp4
│   │   ├── kling_option_D.mp4
│   │   ├── nano_first_frame.png
│   │   └── nano_last_frame.png
│   ├── SHOT_02/
│   └── ...
├── thumbnails/         Auto-extracted or manually added thumbnails
│   ├── SHOT_01_A.jpg
│   ├── SHOT_01_B.jpg
│   └── ...
└── storyboard/         Storyboard configuration and metadata
    └── sequence.json   Shot selections and asset tracking
```

## File Naming Convention

### Kling Videos (4 variations per shot)
- `kling_option_A.mp4` - Option A variation
- `kling_option_B.mp4` - Option B variation
- `kling_option_C.mp4` - Option C variation
- `kling_option_D.mp4` - Option D variation

### Nano Banana Images (keyframes)
- `nano_first_frame.png` - First frame of shot
- `nano_last_frame.png` - Last frame of shot

### Thumbnails (for storyboard view)
- `SHOT_01_A.jpg` - Thumbnail for SHOT_01 option A
- `SHOT_01_B.jpg` - Thumbnail for SHOT_01 option B
- etc.

## Workflow

### Phase 2 Production Workflow

1. **Generate Prompts**
   ```bash
   npm run lint    # Validate prompts
   npm run index   # Update prompt index
   npm run serve   # View in UI
   ```

2. **Render in AI Tools**
   - Copy prompts from UI
   - Paste into Kling 3.0 / Nano Banana Pro 3 / Suno
   - Download rendered assets

3. **Organize Assets**
   - Create folder: `rendered/shots/SHOT_01/`
   - Place Kling videos: `kling_option_A.mp4`, etc.
   - Place Nano Banana images: `nano_first_frame.png`, `nano_last_frame.png`

4. **Update Storyboard**
   - Open `rendered/storyboard/sequence.json`
   - Add entry for shot with file paths
   - Set `selectedVariation` to your choice (A/B/C/D)

5. **View Storyboard**
   ```bash
   npm run serve
   ```
   - Navigate to "Storyboard" in UI
   - See all shots in sequence
   - Compare variations
   - Make final selections

6. **Export for Editing**
   - Export storyboard as PDF
   - Export shot list for CapCut
   - Import assets into CapCut
   - Assemble final video

## File Size Considerations

- **Kling videos**: ~50-200MB each (8 seconds, 1080p)
- **Nano Banana images**: ~2-5MB each (high-res PNG)
- **Total per shot**: ~200-800MB (4 video variations + 2 images)
- **Full project**: Plan for 5-20GB depending on shot count

**Recommendation**: Use external drive or cloud storage for rendered assets.

## Storyboard Sequence File

`storyboard/sequence.json` tracks:
- Which variation (A/B/C/D) selected for each shot
- Paths to all rendered files
- Shot timing and music section
- Production status (rendered, approved, etc.)
- Notes and comments

Edit this file to:
- Select variation for final assembly
- Add notes about shot quality
- Mark shots as approved or needing revision
- Track which shots still need rendering

## Tips

### Thumbnails
If you don't manually create thumbnails:
- Most video players can extract frames
- VLC: Video → Take Snapshot
- FFmpeg: `ffmpeg -i video.mp4 -ss 00:00:01 -frames:v 1 thumb.jpg`

### Organization
- Create shot folders BEFORE rendering
- Use consistent naming (copy from this README)
- Keep original filenames from AI tools in a subfolder if needed
- Back up rendered assets regularly

### Storyboard Viewing
- Grid view: See all shots at once
- Click shot: Compare A/B/C/D variations side-by-side
- Video preview: Play inline to evaluate
- Select best: Mark selection in sequence.json

## Git Ignore

Rendered assets are excluded from git (`.gitignore`) due to large file sizes.
Store assets separately and reference in documentation.
