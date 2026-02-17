# Step 1 Writing Guide

Use these constraints when drafting Step 1 content. Each field feeds downstream steps — write with precision.

---

## Concept (`concept.txt`)

- 2-5 sentences describing protagonist/subject, action, and visual world.
- Include one narrative arc or contrast (e.g., "loss → renewal", "isolation → connection").
- Use specific nouns and concrete imagery.

### Weak vs Strong Examples

**Weak**: "A person explores a beautiful city at night with cool colors and an emotional vibe."

**Strong**: "A lone dancer crosses a rain-soaked neon city while memories flicker as holograms above the wet pavement. She moves through districts of increasing decay, each one dissolving a layer of her holographic past, until she reaches the harbor where the last projection merges with the sunrise."

**Why it matters**: The concept defines characters and locations for Step 3. Vague concepts produce vague canon data.

---

## Inspiration (`inspiration.txt`)

- Include at least two concrete references (films, directors, artists, visual movements).
- Add one sentence that translates references into production direction.

### Weak vs Strong Examples

**Weak**: "Inspired by sci-fi movies and cool music videos."

**Strong**: "Blade Runner 2049 lighting and environmental scale, Wong Kar-wai's intimate color work in In the Mood for Love, and the glitch-art overlays of A$AP Rocky's L$D video. Combine Villeneuve's wide anamorphic framing with Wong's saturated close-ups for the emotional scenes."

**Why it matters**: Inspiration references become `visual_style.json.influences` in Step 3 and guide prompt style in Step 5.

---

## Mood (`mood.txt`)

- Name primary and secondary emotions.
- Include intensity/energy: low-burn, rising, explosive, restrained, oscillating.
- Include spatial temperature: intimate, vast, claustrophobic, expansive.

### Weak vs Strong Examples

**Weak**: "Sad and hopeful."

**Strong**: "Melancholic but defiantly hopeful — a low-burn ache that crescendos into catharsis. Intimate and nocturnal for the first half, shifting to expansive and luminous after the midpoint. Energy rises from restrained whisper to full-chest release."

**Why it matters**: Mood directly translates to Suno music prompts in Step 2. "Low-burn ache" becomes "sparse arrangement, minor key, gradual layering." Vague moods produce generic music.

---

## Genre (`genre.txt`)

- Combine musical-video genre and visual style.
- Mention camera/lighting texture in one phrase.
- Name the visual treatment approach.

### Weak vs Strong Examples

**Weak**: "Cinematic music video with a modern look."

**Strong**: "Cinematic synthwave, neon-noir, surreal urban dreamscape. Shot in glossy anamorphic widescreen with teal-and-amber color grade. Soft halation on highlights, deep blacks, and atmospheric fog in every exterior. Camera moves slowly and deliberately — no handheld, no crash zooms."

**Why it matters**: Genre choices define `visual_style.json` and `cinematography.json` in Step 3. Camera/lighting descriptors become forbidden/allowed movement rules that constrain every prompt variation.

---

## Style Rules

- Prefer specific nouns over broad adjectives ("rain-soaked neon city" not "cool urban setting").
- Avoid contradictory descriptors unless intentional and explained.
- Avoid placeholder tokens like "TBD", "TODO", or "fill in later" in saved text.
- Avoid generic qualifiers: "beautiful", "amazing", "cool", "nice", "interesting".

## Downstream Cascade

```
concept.txt  →  characters.json, locations.json, shot_list.json (Step 3)
inspiration.txt  →  visual_style.json.influences (Step 3)
mood.txt  →  suno_prompt.txt (Step 2), visual_style.json.atmosphere (Step 3)
genre.txt  →  visual_style.json, cinematography.json (Step 3), prompt style (Step 5)
```

Every weak choice here multiplies into weak output across all downstream steps. Invest in specificity.
