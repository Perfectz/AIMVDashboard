#!/usr/bin/env python3
"""Write AIMVDashboard Step 1 content files for a project."""

from __future__ import annotations

import argparse
from pathlib import Path
import sys


def _clean(value: str) -> str:
    return (value or "").strip()


def _non_empty(name: str, value: str) -> str:
    cleaned = _clean(value)
    if not cleaned:
        raise ValueError(f"{name} must be non-empty")
    return cleaned


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fill Step 1 (concept/inspiration/mood/genre) files for a project."
    )
    parser.add_argument("--project", default="default", help="Project id under projects/")
    parser.add_argument("--concept", required=True, help="Project concept text")
    parser.add_argument("--inspiration", required=True, help="Visual inspiration text")
    parser.add_argument("--mood", required=True, help="Mood and tone text")
    parser.add_argument("--genre", required=True, help="Genre and visual style text")
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    try:
        concept = _non_empty("concept", args.concept)
        inspiration = _non_empty("inspiration", args.inspiration)
        mood = _non_empty("mood", args.mood)
        genre = _non_empty("genre", args.genre)
    except ValueError as error:
        print(f"Error: {error}", file=sys.stderr)
        return 2

    project_music_dir = Path("projects") / args.project / "music"
    project_root = project_music_dir.parent

    if not project_root.exists():
        print(
            f"Error: project '{args.project}' was not found at {project_root}",
            file=sys.stderr,
        )
        return 2

    project_music_dir.mkdir(parents=True, exist_ok=True)

    files = {
        "concept.txt": concept,
        "inspiration.txt": inspiration,
        "mood.txt": mood,
        "genre.txt": genre,
    }

    for filename, content in files.items():
        (project_music_dir / filename).write_text(content + "\n", encoding="utf-8")

    print(f"Saved Step 1 content for project '{args.project}'")
    for filename in files:
        path = project_music_dir / filename
        print(f"- {path} ({path.stat().st_size} bytes)")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
