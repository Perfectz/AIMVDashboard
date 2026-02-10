# Upload System - Implementation Summary

## Date: 2026-02-07

## Overview

Added a complete upload system to the UI that allows users to:
1. Upload music files (MP3)
2. Upload or paste Suno prompts (TXT)
3. Upload AI-generated music analysis (JSON)
4. View the AI analysis prompt to copy and use with another AI

---

## Files Created

### 1. **prompts/ai_music_analysis_prompt.txt** (380+ lines)
Comprehensive prompt for another AI to analyze music and generate the analysis.json file.

**Content**:
- Clear task definition
- Complete JSON schema with examples
- Field definitions (Tier 1/2/3 data)
- Analysis guidelines
- Validation rules
- Example output

**Usage**:
- User clicks "View AI Analysis Prompt" in UI
- Copies the prompt
- Pastes into Claude/ChatGPT/etc. with their music file
- AI returns the JSON
- User uploads JSON back to this system

---

## Files Modified

### 1. **ui/index.html**
Added upload section to home page.

**Changes**:
- Replaced empty state with "Step 1: Upload Music & Analysis" section
- Added 3 upload zones (music, Suno prompt, analysis)
- Added upload instructions card
- Added current project status indicators
- Added modal for viewing AI analysis prompt
- Added modal for pasting Suno prompt text

**UI Structure**:
```html
<div class="upload-section">
  <!-- Upload Zones -->
  <div class="upload-grid">
    <div class="upload-zone-card"> <!-- Music --> </div>
    <div class="upload-zone-card"> <!-- Suno Prompt --> </div>
    <div class="upload-zone-card"> <!-- Analysis JSON --> </div>
  </div>

  <!-- Instructions -->
  <div class="upload-instructions">
    <div class="instruction-card"> <!-- How to get AI analysis --> </div>
    <div class="instruction-card"> <!-- Current status --> </div>
  </div>
</div>
```

### 2. **ui/styles.css** (200+ lines added)
Added comprehensive styles for upload section.

**New CSS Classes**:
- `.upload-section` - Container for upload UI
- `.upload-grid` - 3-column grid for upload zones
- `.upload-zone` - Drag-and-drop zone with hover effects
- `.upload-zone.drag-over` - Active drag state
- `.upload-status` - Status text (success/error)
- `.instruction-card` - Instructions display
- `.status-grid` - Status indicators grid
- `.modal-large` - Larger modal for analysis prompt
- `.prompt-box` - Code display with copy button

**Features**:
- Smooth hover transitions
- Drag-and-drop visual feedback
- Color-coded status (success green, error red)
- Responsive grid (3 columns → 1 column on mobile)
- Professional spacing and borders

### 3. **ui/app.js** (250+ lines added)
Added upload functionality and modal management.

**New Functions**:
- `loadAnalysisPrompt()` - Fetch AI analysis prompt from server
- `checkUploadStatus()` - Check which files are uploaded
- `updateStatusIndicator()` - Update status icons/text
- `uploadFile()` - Generic file upload handler
- `setupDragAndDrop()` - Configure drag-and-drop zones
- `setupModals()` - Configure modals for analysis prompt and Suno paste
- `initializeUploads()` - Initialize all upload functionality

**Features**:
- Drag-and-drop file uploads
- Click-to-browse file uploads
- Paste Suno prompt from clipboard
- Real-time upload status
- Toast notifications for success/error
- Modal for viewing/copying AI analysis prompt

### 4. **scripts/serve_ui.js** (130+ lines added)
Added server endpoints for upload handling.

**New Endpoints**:

1. **POST /api/upload/music**
   - Accepts: MP3 files (max 50MB)
   - Saves to: `projects/{projectId}/music/`
   - Updates: `sequence.json` with music file reference

2. **POST /api/upload/suno-prompt**
   - Accepts: TXT files (max 50KB)
   - Saves to: `projects/{projectId}/music/suno_prompt.txt`
   - Validates: Text file format

3. **POST /api/upload/analysis**
   - Accepts: JSON files (max 500KB)
   - Saves to: `projects/{projectId}/music/analysis.json`
   - Validates: JSON structure, required fields (version, duration, bpm, sections)

4. **GET /api/upload-status**
   - Returns: Status of uploaded files per project
   - Response:
     ```json
     {
       "music": true/false,
       "sunoPrompt": true/false,
       "analysis": true/false
     }
     ```

5. **GET /prompts/ai_music_analysis_prompt.txt**
   - Serves: Shared AI analysis prompt
   - Not project-specific (used by all projects)

**Features**:
- Project-scoped uploads (each project has isolated files)
- File type validation (extension and MIME type)
- File size limits
- JSON structure validation for analysis
- Security checks (sanitize filenames, prevent directory traversal)

---

## User Workflow

### Step 1: Upload Music & Analysis

**Option A: Already Have Music**
1. Drag MP3 file to "Music File" upload zone
2. Click "View AI Analysis Prompt" link
3. Copy the prompt
4. Paste into another AI (Claude, ChatGPT, etc.) with music file
5. Download the JSON response
6. Upload JSON to "Analysis JSON" zone
7. (Optional) Upload or paste Suno prompt if you have one

**Option B: Need to Generate Music**
1. Create Suno prompt (or paste existing one)
2. Upload/paste Suno prompt to "Suno Prompt" zone
3. Generate music in Suno using that prompt
4. Download MP3 from Suno
5. Upload MP3 to "Music File" zone
6. Follow Option A steps 2-6 for analysis

### Step 2: Verify Status

The "Current Project Status" card shows:
- ✅ Music File: Uploaded (green) or ⭕ Not uploaded (gray)
- ✅ Suno Prompt: Uploaded (green) or ⭕ Not uploaded (gray)
- ✅ Analysis JSON: Uploaded (green) or ⭕ Not uploaded (gray)

### Step 3: Ready for Shot Creation

Once music and analysis are uploaded, I (Claude) can:
- Read the analysis.json to understand song structure
- Use section boundaries for shot timing
- Match energy levels to visual intensity
- Sync action to beat grid
- Create perfectly timed shot intents

---

## File Locations

All uploads are saved per project:

```
projects/YOUR_PROJECT/
└── music/
    ├── song.mp3                 # Uploaded music file
    ├── suno_prompt.txt          # Uploaded/pasted Suno prompt
    └── analysis.json            # Uploaded AI analysis
```

The AI analysis prompt template is shared:
```
prompts/
└── ai_music_analysis_prompt.txt   # Shared across all projects
```

---

## Validation

### Music Files
- Extensions: `.mp3`
- MIME types: `audio/mpeg`
- Max size: 50MB

### Suno Prompts
- Extensions: `.txt`
- MIME types: `text/plain`
- Max size: 50KB

### Analysis JSON
- Extensions: `.json`
- MIME types: `application/json`
- Max size: 500KB
- Required fields:
  - `version` (string)
  - `duration` (number)
  - `bpm` (number)
  - `sections` (array)

---

## Toast Notifications

The system shows toast notifications for all upload events:

- **Success**: "Upload successful - filename.mp3 uploaded" (green, 3s)
- **Error**: "Upload failed - Error message" (red, 4s)
- **Info**: "Creating project..." (blue, persistent)

---

## AI Analysis Prompt Features

The AI analysis prompt includes:

1. **Clear Task Definition**
   - What to analyze
   - What to return
   - Output format (JSON only, no markdown)

2. **Complete Schema**
   - All required and optional fields
   - Field descriptions
   - Value constraints (enums, ranges)

3. **Examples**
   - Full example with realistic data
   - 180-second synthwave song
   - 7 sections, beat grid, key moments

4. **Analysis Guidelines**
   - How to identify sections
   - How to rate energy levels
   - Timestamp precision requirements
   - Validation checklist

5. **Field Tiers**
   - Tier 1: Essential (duration, BPM, sections, energy)
   - Tier 2: Highly Useful (beat grid, key moments, mood)
   - Tier 3: Nice to Have (energy curve, vocal tracking)

---

## Security

All uploads are validated:
- File type validation (extension + MIME type)
- File size limits enforced
- Filename sanitization (remove special characters)
- Directory traversal prevention
- JSON structure validation
- Project isolation (can't access other projects' files)

---

## Next Steps

After uploading music and analysis:

1. **User provides**: Script/concept for music video
2. **User and I discuss**: Characters, locations, visual style
3. **I write**: All Bible JSON files (canon)
4. **I read**: `music/analysis.json` for timing data
5. **I create**: Shot intents timed to music sections
6. **I compile**: Prompts (Kling A/B/C/D, Nano Banana, Suno)
7. **User browses**: Prompts in UI
8. **User renders**: Videos in AI tools

---

## Testing

To test the upload system:

1. Start the server:
   ```bash
   npm run serve
   ```

2. Open http://localhost:8000/

3. Select a project (or create new one)

4. Try uploading:
   - A test MP3 file
   - A text file with Suno prompt
   - The example analysis JSON from `examples/music_analysis_example.json`

5. Verify:
   - Files appear in `projects/YOUR_PROJECT/music/`
   - Status indicators update (green checkmarks)
   - Toast notifications appear
   - Files can be re-uploaded (overwrites existing)

---

## Known Limitations

1. **No file preview**: Can't preview MP3 or play audio in UI (could add later)
2. **No JSON editor**: Can't edit analysis.json in UI (must re-upload)
3. **No validation UI**: JSON validation happens on upload, but doesn't show detailed schema errors in UI
4. **Overwrites files**: Uploading same file type replaces existing (no versioning)

These are acceptable for Phase 1 - focus is on getting files uploaded for Claude to use.

---

## Summary

**What**: Complete upload system for music, Suno prompts, and AI analysis
**Why**: Enable users to provide music data that Claude can use for shot timing
**How**: Drag-and-drop uploads, server endpoints, status tracking, AI analysis prompt
**Result**: Users can upload music context, I can read it and create perfectly timed shots

**Total new code**: ~800 lines (HTML, CSS, JS, server-side)
**Total new files**: 2 (AI analysis prompt + this doc)
