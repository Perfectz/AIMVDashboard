# Demo Project

This is a **demo skeleton** showing the project structure. It's committed to the repository to demonstrate how projects are organized.

## Purpose

- Show folder structure for new users
- Demonstrate the multi-project system
- Provide a template for creating new projects

## Structure

```
demo-project/
├── project.json              # Project metadata
├── prompts_index.json        # Generated prompts index
├── bible/                    # Canon (locked visual identity)
│   ├── characters.json       # Character definitions (you create)
│   ├── locations.json        # Location definitions (you create)
│   ├── visual_style.json     # Visual style canon (you create)
│   └── cinematography.json   # Camera rules (you create)
├── prompts/                  # Generated prompts
│   ├── kling/                # Kling video prompts (A/B/C/D variations)
│   ├── nanobanana/           # Nano Banana image prompts
│   └── suno/                 # Suno music prompts
├── rendered/                 # Rendered assets
│   ├── shots/                # Organized by shot (SHOT_01/, SHOT_02/, etc.)
│   └── storyboard/           # sequence.json for shot selection
├── music/                    # Music files
│   ├── song.mp3              # Uploaded music (you upload)
│   ├── suno_prompt.txt       # Suno prompt (you paste)
│   ├── song_info.txt         # Song context (you paste)
│   └── analysis.json         # AI-generated music analysis (you upload)
├── reference/                # Visual reference images
│   ├── characters/           # Character reference images
│   └── locations/            # Location reference images
└── lint/                     # Linting reports
    └── report.json           # Generated lint report
```

## Usage

**Do NOT use this project for actual work.** Instead:

1. Click "+ New Project" in the UI
2. Create your own project
3. Follow the workflow in the main README

## What Gets Committed

Only the **folder structure** (`.gitkeep` files) is committed. Actual content is ignored:
- ❌ JSON files in `bible/` (your canon data)
- ❌ TXT files in `prompts/` (generated prompts)
- ❌ Media files (music, videos, images)
- ❌ Generated files (lint reports, sequence.json)

## What's NOT Ignored

- ✅ This README
- ✅ `.gitkeep` files (preserve folder structure)
- ✅ `project.json` (metadata template)
- ✅ `prompts_index.json` (empty template)

---

**See**: [Main README](../../README.md) for full documentation
