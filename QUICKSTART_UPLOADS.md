# Quick Start: Upload System

## Step-by-Step Guide to Upload Music & Analysis

---

## 🎯 Start Here

1. **Start the server**:
   ```bash
   npm run serve
   ```

2. **Open browser**: http://localhost:8000/

3. **You'll see the new upload section** at the top of the home page with 3 upload zones

---

## 📤 Upload Option A: Already Have Music

If you already have an MP3 file:

### Step 1: Upload Music
- Drag your MP3 into the "Music File" zone
- Or click the zone to browse for the file
- ✅ Status will show "Uploaded" when complete

### Step 2: Get AI Analysis
1. Click the **"📖 View AI Analysis Prompt"** link (bottom right upload zone)
2. Click **"📋 Copy Prompt"** button in the modal
3. Open another AI tool:
   - Claude (https://claude.ai)
   - ChatGPT (https://chat.openai.com)
   - Gemini (https://gemini.google.com)
4. Paste the prompt
5. Upload your MP3 file to that AI
6. Wait for the AI to analyze and return JSON
7. Copy the JSON response

### Step 3: Upload Analysis
- Create a file called `analysis.json` and paste the JSON
- Drag `analysis.json` into the "Analysis JSON" zone
- ✅ Status will show "Uploaded"

### Step 4: Upload Suno Prompt (Optional)
If you have the Suno prompt that generated the music:
- Drag the `.txt` file to "Suno Prompt" zone
- OR click **"📋 Paste from Clipboard"** to paste the text directly

**Done!** All 3 status indicators should be green ✅

---

## 🎵 Upload Option B: Need to Generate Music

If you don't have music yet:

### Step 1: Create/Upload Suno Prompt
- Write your Suno prompt in a text editor
- Either:
  - Save as `suno_prompt.txt` and drag to "Suno Prompt" zone
  - Click **"📋 Paste from Clipboard"** and paste the text

### Step 2: Generate Music in Suno
1. Go to Suno (https://suno.com)
2. Use your prompt to generate music
3. Download the MP3 when ready

### Step 3: Upload Music
- Drag the Suno MP3 to "Music File" zone
- ✅ Status updates

### Step 4: Get AI Analysis
- Follow "Upload Option A, Step 2" above
- Use another AI to analyze the Suno-generated music
- Upload the resulting `analysis.json`

**Done!** All 3 files uploaded

---

## 🤖 AI Analysis Prompt Preview

When you click "View AI Analysis Prompt", you'll see a comprehensive prompt that tells another AI:

1. **What to analyze**:
   - Song duration, BPM, time signature, key
   - Section boundaries (intro, verse, chorus, etc.)
   - Energy levels per section
   - Key moments (drops, build-ups, transitions)

2. **What to return**:
   - Structured JSON with all analysis data
   - No markdown, no extra text, just pure JSON

3. **How to format**:
   - Complete schema with examples
   - Required fields vs. optional fields
   - Energy levels: low/medium/high/climax
   - Timestamps in seconds

The AI will respond with a complete JSON file ready to upload.

---

## 📊 What Happens Next

After you upload all 3 files:

1. **You provide me** (Claude in this chat) with:
   - Script/concept for your music video
   - Character descriptions (or I propose options)
   - Location descriptions (or I propose options)

2. **I read your files**:
   - `music/analysis.json` - For song structure and timing
   - `music/suno_prompt.txt` - For understanding the music's intent
   - `music/song.mp3` - (I can't actually listen, but you reference it)

3. **I write all the JSON files**:
   - `bible/characters.json` - Character canon
   - `bible/locations.json` - Location canon
   - `bible/visual_style.json` - Visual style canon
   - `bible/cinematography.json` - Camera rules

4. **I create shot intents**:
   - Each shot timed to music sections from `analysis.json`
   - Energy matched to section energy
   - Action synced to beat grid (if provided)

5. **I generate all prompts**:
   - `prompts/kling/SHOT_XX_option_A.txt` (+ B/C/D variations)
   - `prompts/nanobanana/SHOT_XX_frame.txt`
   - All prompts standalone, ready to copy/paste

6. **You use the UI**:
   - Browse prompts (All Prompts, Kling, Nano Banana)
   - Copy to clipboard
   - Paste into AI tools (Kling, Nano Banana)
   - Render videos

7. **You assemble**:
   - Import rendered videos to CapCut
   - Sync to music timeline
   - Export final music video

---

## ✅ Quick Verification

After uploading, verify in the file system:

```bash
# Check files were saved
ls projects/YOUR_PROJECT/music/

# Should see:
# - song.mp3 (or your filename)
# - suno_prompt.txt (if uploaded)
# - analysis.json (if uploaded)
```

Or check the **"Current Project Status"** card in the UI:
- ✅ Music File: Uploaded
- ✅ Suno Prompt: Uploaded
- ✅ Analysis JSON: Uploaded

---

## 🔧 Troubleshooting

### "Upload failed - No file provided"
- Make sure you're dragging a file, not a folder
- Try clicking the zone and browsing instead of dragging

### "Upload failed - Only .json files allowed"
- Analysis must be a `.json` file
- If you copied JSON from AI, save it as a `.json` file first

### "Upload failed - Missing required fields"
- The JSON is missing required fields
- Make sure the AI returned complete JSON with all fields
- Required: `version`, `duration`, `bpm`, `sections`

### "Upload failed - Invalid JSON format"
- The JSON has syntax errors
- Validate it at https://jsonlint.com
- Common issue: Missing quotes, trailing commas

### Status indicators not updating
- Refresh the page
- Or switch to another project and back

### Can't find uploaded files
- Files are saved to `projects/YOUR_PROJECT/music/`
- Each project has separate files (isolation)
- Make sure you're viewing the correct project

---

## 💡 Tips

1. **Start with analysis**: Get the music analyzed first, it's the most important file
2. **Suno prompt is optional**: If you don't have it, that's OK
3. **You can re-upload**: Uploading again overwrites the previous file
4. **Copy the AI prompt**: Save it for future projects - you'll use it again
5. **Test with example**: Try uploading `examples/music_analysis_example.json` to test

---

## 📚 Full Documentation

For complete details, see:
- **Music Analysis System**: [docs/MUSIC_ANALYSIS.md](docs/MUSIC_ANALYSIS.md)
- **Upload System**: [docs/UPLOAD_SYSTEM.md](docs/UPLOAD_SYSTEM.md)
- **AI Analysis Prompt**: [prompts/ai_music_analysis_prompt.txt](prompts/ai_music_analysis_prompt.txt)

---

## 🎬 Ready to Collaborate?

Once you've uploaded your files, come back to this chat and say:

**"I've uploaded my music and analysis. Here's my concept: [describe your music video idea]"**

And we'll begin creating your cinematic music video together!
