# Canon Authoring Guide

Deep reference for authoring production-quality canon data in Step 3.

---

## 1. Character Identity Anchor Construction

The character identity anchor is the compressed description embedded in every prompt. It ensures visual consistency across all generated frames.

### Anchor Extraction Process

1. Read `characters.json` for the target character
2. Extract: physicalCore.age + physicalCore.build + physicalCore.skinTone
3. Extract: faceSignature.structure + faceSignature.eyes + faceSignature.hair
4. Extract: costume.default.description + costume.default.signature

### Compact Anchor (~80 chars, for Kling 500-char limit)

Template: `[Age] [ethnicity/skin] [gender], [build], [hair], [costume signature]`

Example: "Late-20s Thai woman, slender build, warm brown skin, long dark hair, futuristic terracotta drapes"

### Full Anchor (~200 chars, for SeedDream 2000-char limit)

Template: `[Full physical description]. [Full face description]. [Full costume with colors and signature item].`

Example: "Woman in her late 20s, slender graceful build, warm brown skin with golden undertones. Soft oval face with deep brown expressive eyes, long dark flowing hair past shoulders. Futuristic draped clothing in warm terracotta and faded gold with asymmetric outer layer."

### Common Mistakes

| Mistake | Problem | Fix |
|---------|---------|-----|
| "She is beautiful" | Non-renderable adjective | "Soft oval face with defined cheekbones" |
| "Normal clothes" | Too vague, each frame different | "Dark leather jacket, white t-shirt, silver chain" |
| "Brown hair" | Not distinctive enough | "Wavy chestnut hair, shoulder-length, side-parted" |
| No signature item | Costume varies between frames | Add one item that ALWAYS appears: "red scarf" |

---

## 2. Location Visual Anchor Construction

Visual anchors are the signature elements that MUST appear in every prompt set at a location. They are the visual fingerprint.

### Anchor Selection Rules

- Choose 2-5 elements that are unique to this location
- Each element must be visually renderable (an AI model can draw it)
- Elements should span different scales: one large (architecture), one medium (furniture/objects), one small (particles/details)

### Good vs Bad Visual Anchors

| Bad Anchor | Why | Good Anchor |
|-----------|-----|-------------|
| "Nice atmosphere" | Not renderable | "Floating luminous particles in blue-green haze" |
| "Urban setting" | Too generic | "Wet asphalt reflecting vertical neon signage" |
| "Dark room" | No distinctive elements | "Bare concrete walls with a single amber desk lamp" |
| "Forest" | Every forest looks different | "Towering redwoods with shafts of golden light through canopy, fern-covered floor" |

### Anchor Usage in Prompts

Every visual anchor item MUST appear in the prompt when a shot is set at that location. If a location has 4 visual anchors, all 4 appear in every prompt for that location.

---

## 3. Visual Style Configuration

The visual style file defines the aesthetic DNA of the entire project.

### overallStyle

One sentence capturing the complete aesthetic. This appears in every prompt.

- **Weak**: "Cinematic and cool"
- **Strong**: "Cinematic futuristic surreal music video — Blade Runner 2049 meets Ghost in the Shell, with organic textures and atmospheric particle effects"

### influences

At least 1 influence entry. Each needs both `source` (what) and `aspect` (what to take from it).

- **Weak**: `{ "source": "Sci-fi movies", "aspect": "The look" }`
- **Strong**: `{ "source": "Blade Runner 2049", "aspect": "Environmental mood, scale, and amber/teal color temperature" }`

### forbiddenElements

Items that must NEVER appear in any prompt or generated output. Be specific.

- **Weak**: `["bad things"]`
- **Strong**: `["cartoon or comedy style", "flat even lighting", "plastic or artificial skin texture", "distorted anatomy", "visible text, logos, or watermarks", "camera shake or handheld wobble", "cheerful primary colors"]`

### negativePromptBase

This string is appended to EVERY generated prompt. Keep it concise and platform-universal.

Template: `"no text, logos, watermarks, distorted anatomy, cartoon style, flat lighting, plastic skin, [project-specific exclusions]"`

---

## 4. Cinematography Configuration

### CRITICAL Constraints

Rules marked `"enforcement": "CRITICAL"` are hard requirements:

1. **One action per shot** — Each shot contains exactly one continuous action. No "she walks and then sits down."
2. **No scene cuts within a shot** — One continuous take for the full 8 seconds.
3. **No location changes within a shot** — Start and end in the same place.

### Camera Movement Rules

- `allowed` array: Only these movement types can appear in prompts.
- `forbidden` array: These must NEVER appear in any Kling prompt.

If a movement type is not in `allowed`, it should not be used. This prevents inconsistent camera language across shots.

### Lens Selection Strategy

Standard lens set for A/B/C/D variations:

| Variation | Lens | Angle | Movement | Composition |
|-----------|------|-------|----------|-------------|
| A | 35mm anamorphic | Eye-level | Default movement | Rule of thirds |
| B | 50mm standard | Low angle | Static hold or slower | Centered |
| C | 24mm wide | High angle | Different movement type | Leading lines |
| D | 85mm portrait | Eye-level | Tracking or orbit | Depth layering |

---

## 5. Shot List Construction

### Timing Alignment

- Every shot's `timing.musicSection` should reference a section ID from `analysis.json`
- Shots should cover the full song duration with no gaps
- Default shot duration is 8 seconds (from `cinematography.json.shotDuration.default`)
- Number of shots = song duration / 8 (approximately)

### Shot Intent Writing

The `intent` object describes WHAT happens, not HOW the prompt should read:

- **what**: Concrete scene description in one sentence
- **why**: Narrative purpose — why does this shot exist?
- **emotionalBeat**: Emotional arc using "state A → state B" format

### Character Prominence

- **primary**: Character is the subject of the shot. Full identity anchors in prompt.
- **secondary**: Character is present but not the focus. Compressed anchor.
- **background**: Character appears in the scene. Minimal description.

### Status Tracking

| Status | Meaning |
|--------|---------|
| `draft` | Shot defined but not reviewed |
| `approved` | Shot intent approved for prompt generation |
| `prompts_generated` | Prompts have been compiled |
| `rendered` | AI generation complete |
| `final` | Shot selected and locked in storyboard |

---

## 6. Cross-File Coherence Checklist

Run these checks after completing all canon files:

- [ ] Every `CHAR_` ID in shot_list.json exists in characters.json
- [ ] Every `LOC_` ID in shot_list.json exists in locations.json
- [ ] Every `timing.musicSection` in shot_list.json matches a section ID in analysis.json
- [ ] costume.default.signature exists and is non-empty for every character
- [ ] visualAnchors has at least 2 items for every location
- [ ] forbiddenElements in visual_style.json has at least 3 items
- [ ] negativePromptBase is non-empty
- [ ] All constraints with "CRITICAL" enforcement exist in cinematography.json
- [ ] No placeholder text ("TBD", "TODO") in any field
- [ ] All IDs follow naming patterns: `CHAR_<UPPER>`, `LOC_<UPPER>`, `SHOT_<DIGITS>`

---

## 7. Anti-Patterns

| Anti-Pattern | Why It Fails | Correct Approach |
|-------------|--------------|-----------------|
| Copy-paste characters | All characters render identically | Give each character unique physical features and costume |
| Vague visual anchors | Location looks different every frame | List 3-5 specific, renderable signature elements |
| Missing negative prompt | Unwanted elements appear in renders | Always define negativePromptBase in visual_style.json |
| Inconsistent IDs | Cross-references break | Use exact ID patterns and verify with completeness check |
| Overlapping shot timing | Shots conflict in storyboard | Ensure contiguous timing: each shot starts where previous ends |
| Motion verbs in static descriptions | Nano Banana generates blurred images | Use pose descriptions: "mid-stride" not "walking" |
