# Reference Image Curation Guide

Best practices for creating and organizing visual reference libraries in Step 4.

---

## 1. Image Quality Requirements

| Attribute | Requirement |
|-----------|-------------|
| Minimum resolution | 512x512 pixels |
| Recommended resolution | 1024x1024 or higher |
| Accepted formats | `.png`, `.jpg`, `.jpeg`, `.webp` |
| Preferred format | PNG (lossless) |
| Minimum file size | > 10KB (to reject placeholders) |
| Maximum per entity | No hard limit, but 3-6 is optimal |

---

## 2. Character Reference Best Practices

### Three Essential Angles

1. **Front-facing portrait** — Neutral expression, clear face visible, even lighting. This is the primary identity anchor.
2. **Three-quarter angle** — Shows facial depth, nose profile, cheekbone structure. Helps the model understand 3D form.
3. **Full body or action pose** — Shows complete costume, proportions, and stance. Essential for framing in wider shots.

### Optional Additional References

4. **Dramatic lighting variant** — Same character under the project's lighting signature (e.g., teal ambient, amber uplight).
5. **Costume variation** — If the character has alternate outfits defined in `costume.variations`.
6. **Emotional expression** — Key emotional state that will appear frequently in shots.

### Consistency Rules

- All references for one character must show the SAME person/design. Mixed references confuse the model.
- Costume should match `characters.json.costume.default` across all references unless showing a variation.
- Skin tone, hair style, and facial features must be consistent.

### AI-Generated Reference Prompts

When creating character references via Nano Banana Pro 3:

```
Front-facing, full body portrait, neutral standing pose
[physicalCore: age, build, height, skinTone from characters.json]
[faceSignature: structure, eyes, hair from characters.json]
[costume.default: description, colorPalette, signature from characters.json]
Framing: centered composition, full body visible head to toe
Shot Size: full body portrait
Angle: eye level, straight-on front view
Background: neutral dark studio backdrop with subtle [project color] ambient glow
Lighting: soft even studio lighting from front and slightly above
Style: clean character reference sheet, high detail, cinematic realism
Negative: no text, logos, watermarks, distorted anatomy, motion blur, cartoon style
```

---

## 3. Location Reference Best Practices

### Three Essential Views

1. **Wide establishing shot** — Full environment showing architecture, scale, and lighting. This captures the overall identity.
2. **Visual anchor detail shots** — Close-ups of each item in `locations.json.visualAnchors`. If there are 3 visual anchors, try to capture each in at least one reference.
3. **Atmosphere sample** — Showing the lighting quality, color palette, and environmental effects (particles, fog, caustics).

### Consistency Rules

- All references for one location must show the SAME environment. Different rooms, outdoor areas, or buildings should be separate location IDs.
- Color palette should match `locations.json.atmosphere.colorPalette`.
- Lighting should match `locations.json.atmosphere.lighting`.

---

## 4. guide.json Schema

Optional metadata file in each reference directory.

```json
{
  "invariants": [
    "Always shows the asymmetric draped outer layer",
    "Hair must flow past shoulders",
    "Warm brown skin tone in every lighting condition"
  ],
  "allowedVariations": [
    "Lighting angle and intensity",
    "Facial expression (neutral to emotional)",
    "Camera distance (close-up to full body)"
  ],
  "notes": "Primary character. Highest priority in reference collection."
}
```

- **invariants**: Features that MUST remain identical across all generated frames.
- **allowedVariations**: Aspects that may change between shots.
- **notes**: Internal production notes.

---

## 5. Reference Auto-Collection Logic

During generation (Step 5), the system collects references automatically:

### Priority Order

1. **Continuity frame**: Previous shot's last frame → maintains visual flow between shots
2. **Uploaded references**: User-selected images for this specific shot/variation
3. **Canon references**: Images from `reference/characters/<CHAR_ID>/` and `reference/locations/<LOC_ID>/`

### Allocation Rules

- **Maximum**: 14 input reference images per generation call
- **Primary characters**: Get full reference allocation (all 3+ images)
- **Secondary characters**: Get reduced allocation (1-2 images)
- **Background characters**: Get 0-1 images
- **Location**: Gets remaining slots after character allocation
- If total exceeds 14, lowest-priority sources are trimmed first

### File Naming Convention

Reference files follow this pattern:
- `ref_01.png`, `ref_02.png`, `ref_03.png` — Manual references
- `generated_01.png`, `generated_02.png` — AI-generated references
- `prompt_01.txt`, `prompt_02.txt` — Prompts used to generate reference images

---

## 6. Common Problems

| Problem | Cause | Solution |
|---------|-------|----------|
| Character looks different each shot | References are inconsistent | Re-generate all refs from the same seed/prompt |
| Location missing key elements | Visual anchors not in references | Add detail shots of each visual anchor |
| Too many references slow generation | Over 14 images per call | Curate to 3-4 per entity, let priority system handle rest |
| Reference doesn't match canon | Canon updated after refs created | Regenerate references when canon changes |
| Blank/placeholder images | Forgot to replace placeholders | Check file sizes (must be > 10KB) |
