# How Skills Work in AIMVDashboard

A skill is a folder containing a required `SKILL.md` file with:

- `name`: unique skill identifier
- `description`: trigger text that tells an AI when to use the skill
- body instructions: workflow, checks, and commands

Skills are designed to be LLM-agnostic — they work identically with both OpenAI (GPT-4, GPT-4o, GPT-5) and Anthropic (Claude Sonnet, Claude Opus) models.

## How an AI agent uses a skill

1. **Trigger**: User asks for a task matching the skill description.
2. **Load**: Agent reads `SKILL.md` for that skill.
3. **References**: Agent loads any referenced docs from `references/` subdirectory.
4. **Execute**: Agent follows the workflow and runs listed commands/scripts.
5. **Validate**: Agent runs the completeness checks in the skill.
6. **Report**: Agent summarizes artifacts created/updated and validation results.

Prompt-generation rule: when a skill writes prompts for other AI systems, require that skill's system-specific best-practice reference and quality gate before marking complete.

## How you should prompt correctly

Use this format:

- "Use skill `<skill-name>` for project `<project-id>` and complete Step `<N>` fully."
- Include constraints (genre, tone, target audience, runtime) in the same request.
- Require validation: "Run the skill checks and show results."

Example prompts:

- `Use skill step1-theme-concept for project default and complete Step 1 fully.`
- `Use skill step2-music-analysis for project default and complete Step 2 fully. Run completeness checks and report gaps.`
- `Use skill step3-content-blueprint for project my-video and fill all 8 canon files.`
- `Use skill step4-references-assets for project my-video and ensure every canon character/location has 3 references.`
- `Use skill step5-shots-prompts for project default and generate all platform prompts.`
- `Use skill step6-storyboard-preview for project default and assemble the storyboard from rendered assets.`

## Available step skills

| Skill | Step | Page |
|-------|------|------|
| `step1-theme-concept` | Step 1: Theme & Concept | `ui/step1.html` |
| `step2-music-analysis` | Step 2: Music & Analysis | `ui/step2.html` |
| `step3-content-blueprint` | Step 3: Content Blueprint | `ui/step3.html` |
| `step4-references-assets` | Step 4: References & Assets | `ui/step4.html` |
| `step5-shots-prompts` | Step 5: Shots & Prompts | `ui/index.html` |
| `step6-storyboard-preview` | Step 6: Storyboard Preview | `ui/storyboard.html` |

## Shared references

All skills can reference shared documents in `skills/_shared/references/`:

- `universal-prompt-rules.md` — Cross-cutting platform rules, canon schemas, identity anchor methodology, negative prompt catalog
- `llm-agnostic-patterns.md` — Provider-neutral instruction conventions, output format patterns, validation command patterns

## Skill structure

Each skill follows this enhanced template:

```
skills/<skill-name>/
├── SKILL.md                     # Required: skill definition
├── references/                  # Optional: best-practice guides
│   └── <topic>.md
└── scripts/                     # Optional: automation scripts
    └── <script>.py
```

### SKILL.md sections

| Section | Purpose |
|---------|---------|
| Prerequisites | What must exist before this step runs |
| Required Artifacts | Output file paths and descriptions |
| Execute | Numbered steps with file paths and API endpoints |
| Platform-Specific Best Practices | Embedded rules for relevant generation platforms |
| Quality Checks | Criteria to verify before declaring completion |
| Completeness Check | Cross-platform `node -e` validation commands |
| LLM Guidance | Provider-neutral notes on output format and common pitfalls |
