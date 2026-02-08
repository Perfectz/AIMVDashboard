# Prompt Lint Rules

**Version:** 2026-02-07

This document defines all lint rules enforced by the linter. Rules are categorized by severity:
- **CRITICAL**: Prompt FAILS and cannot be used
- **WARNING**: Prompt passes but should be reviewed

---

## GLOBAL RULES (All AI Tools)

### G001: No Cross-References to Previous Shots [CRITICAL]
**Rule:** Prompts must be standalone and never reference previous shots or context.

**Forbidden phrases:**
- "same as before"
- "continue"
- "again"
- "earlier shot"
- "previous scene"
- "as seen in"
- "like the last one"

**Reason:** Each prompt is submitted independently to AI tools. Cross-references break consistency and fail to provide complete context.

**Example FAIL:**
```
Same character as before, now walking through the alley.
```

**Example PASS:**
```
Young woman with angular face, sharp green eyes, short black hair, black leather jacket with red stripe, walking through narrow neon-lit alley.
```

---

### G002: Version Tag Required [CRITICAL]
**Rule:** Every prompt file must include a version tag and creation date.

**Required format:**
```
Version: YYYY-MM-DD
Created: YYYY-MM-DD
```

**Reason:** Track prompt iterations and ensure using latest approved version.

---

### G003: Locked Canon Anchors Required [CRITICAL]
**Rule:** Prompts featuring characters or locations must include ALL identity anchors from bible files.

**For Characters (from `bible/characters.json`):**
- physicalCore (age, build, height, skinTone)
- faceSignature (structure, eyes, hair)
- costume.default (description, signature item)

**For Locations (from `bible/locations.json`):**
- setting (type, architecture)
- atmosphere (lighting, colorPalette)
- visualAnchors (all signature elements)

**Reason:** Consistency is 9/10 priority. Identity anchors prevent visual drift.

---

## KLING 3.0 SPECIFIC RULES

### K001: Complete Character Description Required [CRITICAL]
**Rule:** If character appears, include full character description from canon.

**Must include:**
- Physical characteristics
- Face details
- Costume description

**Reason:** Kling generates video from scratch each time. Incomplete descriptions cause visual drift.

---

### K002: Complete Location Description Required [CRITICAL]
**Rule:** If location appears, include full location description from canon.

**Must include:**
- Setting type and architecture
- Lighting and atmosphere
- Visual anchor elements
- Color palette

**Reason:** Location consistency requires explicit description every time.

---

### K003: Camera Framing Required [CRITICAL]
**Rule:** Must specify camera framing/shot size.

**Options:** extreme close-up, close-up, medium shot, medium wide, wide shot, extreme wide

**Reason:** Ambiguous framing causes inconsistent shot scales.

---

### K004: Camera Movement Required [CRITICAL]
**Rule:** Must explicitly state camera movement (or "static shot" if no movement).

**Allowed movements (from `bible/cinematography.json`):**
- push in
- pull back
- dolly tracking
- slow pan
- crane up
- orbit
- static hold

**Reason:** Unspecified camera movement leads to unpredictable results.

---

### K005: Lighting Description Required [CRITICAL]
**Rule:** Must describe lighting quality and sources.

**Include:**
- Lighting quality (e.g., "high-contrast dramatic")
- Light sources (e.g., "neon signs, street lights")
- Color palette in lighting

**Reason:** Lighting defines visual mood and consistency.

---

### K006: One Action Per Shot [CRITICAL]
**Rule:** Describe only ONE continuous action suitable for 8-second duration.

**FAIL Examples:**
- "Character walks down alley, then stops, then turns around, then looks up"
- "Character enters building, climbs stairs, opens door"

**PASS Example:**
- "Character walks slowly down rain-slicked alley, looking up at flickering neon signs"

**Reason:** Shot duration is 8 seconds. Multiple actions cause cramped pacing or incomplete execution.

---

### K007: No Scene Cuts [CRITICAL]
**Rule:** No scene cuts, location changes, or time jumps within a single shot.

**FAIL:** "Character in alley, then cut to rooftop"

**PASS:** "Character in alley" (separate shot for rooftop)

**Reason:** Each Kling shot is one continuous take.

---

### K008: No Ambiguous Camera Directions [CRITICAL]
**Rule:** Camera movement must be clear and non-conflicting.

**FAIL:** "Camera pushes in while pulling back"

**FAIL:** "Camera orbits and pans left and zooms"

**PASS:** "Camera slowly pushes in on character's face"

**Reason:** Conflicting directions confuse the generator.

---

### K009: Negative Prompt Required [CRITICAL]
**Rule:** Must include negative prompt with forbidden elements.

**Required negatives (from `bible/visual_style.json`):**
```
no text, logos, watermarks, distorted anatomy, cartoon style, flat lighting, plastic skin, camera shake
```

**Reason:** Prevent common AI generation artifacts.

---

### K010: Multiple Locations [CRITICAL]
**Rule:** Only ONE location per shot.

**FAIL:** "Alley and rooftop visible"

**PASS:** "Alley" OR "Rooftop" (separate shots)

**Reason:** Mixing locations breaks spatial consistency.

---

## NANO BANANA PRO 3 SPECIFIC RULES

### N001: Complete Character Description Required [CRITICAL]
**Rule:** Same as K001 - full character description from canon.

---

### N002: Composition Required [CRITICAL]
**Rule:** Must specify composition approach.

**Options (from `bible/cinematography.json`):**
- rule of thirds
- centered
- symmetrical
- leading lines
- depth layering

**Reason:** Composition defines visual structure.

---

### N003: Style/Influences Required [CRITICAL]
**Rule:** Must reference overall style from `bible/visual_style.json`.

**Include:**
- Overall style statement
- Key influences
- Texture quality

**Example:** "Stylized cyberpunk with cinematic realism, Blade Runner lighting, 1990s anime expressive silhouettes"

**Reason:** Nano Banana needs explicit style guidance for consistency.

---

### N004: Lighting + Palette Required [CRITICAL]
**Rule:** Must describe lighting and color palette.

**Include:**
- Lighting quality
- Light sources
- Color palette (from visual style or location)

**Reason:** Lighting and color define visual identity.

---

### N005: No Motion Verbs [CRITICAL]
**Rule:** Image generation prompts must NOT describe motion or time progression.

**Forbidden:**
- walking
- running
- turning
- moving
- flying
- "in the process of"

**Use static descriptions:**
- FAIL: "Character walking through alley"
- PASS: "Character mid-stride in alley, one foot forward"

**Reason:** Nano Banana generates single frames, not animation.

---

### N006: No Time Progression [CRITICAL]
**Rule:** Cannot describe events unfolding over time.

**FAIL:** "Character looks left, then looks right"

**PASS:** "Character looking left"

**Reason:** Single image cannot show temporal sequence.

---

### N007: Negative Prompt Required [CRITICAL]
**Rule:** Same as K009 - include forbidden elements from visual style canon.

---

## SUNO SPECIFIC RULES

### S001: Music-Focused Only [CRITICAL]
**Rule:** Prompts must describe music, not visual scenes.

**FAIL:** "Character walking through neon alley with dramatic music"

**PASS:** "Dark electronic, moody synthesizers, slow tempo, cyberpunk atmosphere"

**Reason:** Suno generates music, not images or video.

---

### S002: No Visual Scene Descriptions [CRITICAL]
**Rule:** Do not describe visual elements, characters, or locations.

**Describe instead:**
- Genre
- Mood/emotion
- Instrumentation
- Tempo
- Musical structure

**Reason:** Visual descriptions are irrelevant to music generation.

---

## STYLE CONSISTENCY RULES

### C001: Visual Style Consistency [WARNING]
**Rule:** Prompts should reflect locked visual style from `bible/visual_style.json`.

**Check:**
- Color palette aligns with canon
- Lighting quality matches signature
- Forbidden elements are excluded
- Texture quality is consistent

**Reason:** Maintain cohesive visual identity across all shots.

---

### C002: Cinematography Consistency [WARNING]
**Rule:** Camera choices should follow cinematography canon.

**Check:**
- Lens choice appropriate for shot type
- Camera movement is smooth and motivated
- Shot duration aligns with 8-second rule
- Composition follows established patterns

**Reason:** Consistent camera language creates professional feel.

---

## LINTER OUTPUT FORMAT

The linter generates `lint/report.json` with this structure:

```json
{
  "timestamp": "2026-02-07T10:30:00Z",
  "summary": {
    "totalPrompts": 12,
    "passed": 10,
    "failed": 2,
    "warnings": 3
  },
  "results": [
    {
      "file": "prompts/kling/SHOT_01_option_A.txt",
      "status": "FAIL",
      "errors": [
        {
          "rule": "K006",
          "severity": "CRITICAL",
          "message": "Multiple actions detected: 'walks down alley, stops, turns around'"
        }
      ],
      "warnings": []
    }
  ]
}
```

---

## ENFORCEMENT PHILOSOPHY

**Critical = Hard Requirement**
- Prompt cannot be used if CRITICAL rules fail
- Must fix and re-lint before using in AI tools

**Warning = Best Practice**
- Prompt can be used but should be reviewed
- Consider revision for better consistency

**Quality > Speed**
- Better to fail a prompt and fix it than to render inconsistent output
- Consistency is 9/10 priority
