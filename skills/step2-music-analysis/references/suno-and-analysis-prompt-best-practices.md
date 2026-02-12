# Step 2 Prompt Best Practices (Suno + Analysis AI)

Use this guide when Step 2 requires generating prompts for external AIs.

## Suno prompt writing (`suno_prompt.txt`)

Include:

1. Genre + subgenre
2. Mood trajectory (start -> peak -> resolve)
3. BPM/tempo range
4. Instrumentation and sonic texture
5. Vocal style/language notes (if needed)
6. Song structure cues (intro/verse/chorus/etc.)

Avoid:

- Camera language
- Shot descriptions
- Character/location visual detail

## Analysis prompt usage (for another AI)

When asking another AI to generate `analysis.json`:

1. Provide strict output format: JSON only.
2. Require fields:
   - `version`, `duration`, `bpm`, `sections`
3. Require section timing precision (`startSec`, `endSec`).
4. Ask for musically grounded labels (energy, instruments, vocal presence).
5. Reject prose around JSON.

## Validation gate

Before marking Step 2 complete:

- `suno_prompt.txt` is non-empty and music-focused.
- `analysis.json` parses and includes required keys.
- Values are plausible (duration > 0, bpm > 0, non-empty sections).
