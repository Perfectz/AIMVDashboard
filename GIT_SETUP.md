# Git Setup - Project Files Exclusion

## Overview

This repository is configured to commit **only the dashboard system and a demo skeleton**, while excluding all actual project data (music files, videos, prompts, etc.).

---

## What Gets Committed

✅ **Dashboard System**:
- All UI files (`ui/`)
- All scripts (`scripts/`)
- All schemas (`schemas/`, `lint/schemas/`)
- All documentation (`docs/`, `README.md`, guides)
- All examples (`examples/`)
- All prompt templates (`prompts/ai_music_analysis_prompt.txt`)
- Package configuration (`package.json`)

✅ **Demo Skeleton**:
- `projects/demo-project/` structure (folders with `.gitkeep` files)
- `projects/demo-project/project.json` (empty template)
- `projects/demo-project/prompts_index.json` (empty template)
- `projects/demo-project/README.md` (documentation)

---

## What Gets Ignored

❌ **All Project Data**:
- Everything in `projects/` **except** `demo-project/`
- `projects/projects_index.json` (generated at runtime)

❌ **Media Files** (all projects):
- Audio: `*.mp3`, `*.wav`, `*.flac`, `*.m4a`, etc.
- Video: `*.mp4`, `*.mov`, `*.avi`, `*.webm`, etc.
- Images: `*.png`, `*.jpg`, `*.jpeg`, `*.gif`, etc.
  - **Exception**: Files in `examples/` and `ui/` are kept

❌ **Generated/User Content**:
- Bible JSON files (`projects/*/bible/*.json`)
- Generated prompts (`projects/*/prompts/**/*.txt`)
- Rendered assets (`projects/*/rendered/**/*`)
- Music files (`projects/*/music/**/*`)
- Reference images (`projects/*/reference/**/*.png`)
- Lint reports (`**/lint/report.json`)
- Sequence files (`**/rendered/storyboard/sequence.json`)

❌ **System Files**:
- `node_modules/`
- `.DS_Store`, `Thumbs.db`
- `.vscode/`, `.idea/`
- `.claude/`
- `*.log`, `*.tmp`

---

## File Structure Committed

```
AIMusicVideo/                    ✅ Root
├── .gitignore                   ✅ Git configuration
├── package.json                 ✅ npm configuration
├── README.md                    ✅ Main documentation
├── QUICKSTART_UPLOADS.md        ✅ Quick start guide
├── GIT_SETUP.md                 ✅ This file
│
├── ui/                          ✅ All UI files
│   ├── index.html
│   ├── storyboard.html
│   ├── guide.html
│   ├── app.js
│   ├── storyboard.js
│   └── styles.css
│
├── scripts/                     ✅ All server scripts
│   ├── serve_ui.js
│   ├── project_manager.js
│   ├── migrate_to_projects.js
│   ├── validate_schemas.js
│   ├── generate_index.js
│   └── init_phase2.js
│
├── lint/                        ✅ Linting system
│   ├── linter.js
│   ├── prompt_rules.md
│   └── schemas/
│
├── schemas/                     ✅ JSON Schemas
│   └── music_analysis_schema.json
│
├── examples/                    ✅ Example files
│   └── music_analysis_example.json
│
├── docs/                        ✅ Documentation
│   ├── MUSIC_ANALYSIS.md
│   ├── MUSIC_ANALYSIS_SUMMARY.md
│   └── UPLOAD_SYSTEM.md
│
├── prompts/                     ✅ Prompt templates (shared)
│   └── ai_music_analysis_prompt.txt
│
└── projects/                    ✅ Projects directory
    ├── .gitkeep                 ✅ Preserve directory
    └── demo-project/            ✅ Demo skeleton only
        ├── README.md            ✅ Demo documentation
        ├── project.json         ✅ Empty template
        ├── prompts_index.json   ✅ Empty template
        ├── bible/               ✅ .gitkeep (structure only)
        ├── prompts/             ✅ .gitkeep (structure only)
        ├── rendered/            ✅ .gitkeep (structure only)
        ├── music/               ✅ .gitkeep (structure only)
        ├── reference/           ✅ .gitkeep (structure only)
        └── lint/                ✅ .gitkeep (structure only)
```

---

## File Structure NOT Committed

```
AIMusicVideo/
├── node_modules/                ❌ (dependencies)
├── .claude/                     ❌ (Claude Code files)
│
└── projects/
    ├── projects_index.json      ❌ (generated at runtime)
    ├── default/                 ❌ (your actual project)
    ├── my-music-video/          ❌ (your actual project)
    └── another-project/         ❌ (your actual project)
```

---

## Testing the Setup

### 1. Check Ignored Files

```bash
# See what would be committed
git status

# Should NOT show:
# - projects/default/
# - projects/*/music/*.mp3
# - projects/*/rendered/**/*
# - node_modules/
```

### 2. Check Tracked Files

```bash
# See what IS tracked
git ls-files projects/

# Should show:
# - projects/.gitkeep
# - projects/demo-project/**/.gitkeep
# - projects/demo-project/project.json
# - projects/demo-project/prompts_index.json
# - projects/demo-project/README.md
```

### 3. Test Commit

```bash
# Add all files
git add .

# Check what's staged
git status

# Should see:
# - .gitignore
# - ui/*, scripts/*, docs/*
# - projects/demo-project/ (structure only)
#
# Should NOT see:
# - projects/default/
# - *.mp3, *.mp4, *.png (except examples/)
```

---

## Why This Setup?

### Benefits

1. **Small Repository Size**: No large media files
2. **Privacy**: Your project data stays local
3. **Clean Collaboration**: Share the dashboard, not your content
4. **Easy Updates**: Pull dashboard updates without conflicts
5. **Demo Structure**: New users see how to organize projects

### What Users Get

When someone clones the repo:
- ✅ Working dashboard system
- ✅ All UI and scripts
- ✅ Demo project showing structure
- ✅ Complete documentation

What they DON'T get:
- ❌ Your music files
- ❌ Your rendered videos
- ❌ Your prompts
- ❌ Your project data

---

## Creating New Projects

New projects you create via UI will be **automatically ignored**:

```bash
# Create project via UI
Click "+ New Project" → Enter "my-video" → Create

# Files are created but NOT tracked
ls projects/my-video/           # ✅ Exists locally
git status                      # ❌ Not shown (ignored)
```

---

## Migration from Old Setup

If you have existing projects in the old single-project structure:

```bash
# Run migration
npm run migrate

# This moves files to projects/default/
# The .gitignore will automatically ignore them
```

---

## Manual Overrides

If you WANT to commit specific files (e.g., a demo rendered video):

```bash
# Force add an ignored file
git add -f projects/demo-project/rendered/demo.mp4

# Not recommended unless creating examples
```

---

## Summary

**Strategy**: Commit the tool, not the content

- ✅ Dashboard → Committed (shareable)
- ❌ Projects → Ignored (private)
- ✅ Demo skeleton → Committed (documentation)

This allows you to:
- Push dashboard updates to GitHub
- Share the system with others
- Keep your music video projects private
- Maintain a clean, small repository

---

## Need Help?

If git is tracking files it shouldn't:

```bash
# Remove from git but keep locally
git rm --cached projects/default -r

# Force refresh .gitignore rules
git rm -r --cached .
git add .
```

If you want to commit a specific project (for demo purposes):

```bash
# Edit .gitignore
# Add: !projects/specific-demo-project/

# Then commit as normal
```
