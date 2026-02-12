---
name: step4-references-assets
description: Fill out Step 4 (References & Assets) for AIMVDashboard by completing character/location reference libraries and keeping them aligned with canon IDs. Use when asked to complete or verify Step 4 page content.
---

# Step 4 References & Assets Skill

Complete reference libraries for every character and location used in canon.

Required structure:

- `projects/<project-id>/reference/characters/<CHAR_ID>/`
- `projects/<project-id>/reference/locations/<LOC_ID>/`

Each reference folder should contain at least 3 images (`.png/.jpg/.jpeg/.webp`) and optional `guide.json`.

## Execute

1. Read `bible/characters.json` and `bible/locations.json`.
2. Ensure each ID has a matching directory under `reference/characters` or `reference/locations`.
3. Add at least 3 visual references per ID.
4. Add/update `guide.json` where useful with invariants and allowed variation.

## Completeness check

```bash
project=default
for d in "projects/$project/reference/characters"/* "projects/$project/reference/locations"/*; do
  [ -d "$d" ] || continue
  c=$(find "$d" -maxdepth 1 -type f \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.webp' \) | wc -l)
  echo "$d -> $c images"
  [ "$c" -ge 3 ] || exit 1
done
```

Step 4 is complete only when every canon character/location has populated references.
