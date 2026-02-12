# How Skills Work in AIMVDashboard

A skill is a folder containing a required `SKILL.md` file with:

- `name`: unique skill identifier
- `description`: trigger text that tells an AI when to use the skill
- body instructions: workflow, checks, and commands

## How an AI agent uses a skill

1. **Trigger**: User asks for a task matching the skill description.
2. **Load**: Agent reads `SKILL.md` for that skill.
3. **Execute**: Agent follows the workflow and runs listed commands/scripts.
4. **Validate**: Agent runs the completeness checks in the skill.
5. **Report**: Agent summarizes artifacts created/updated and validation results.

Prompt-generation rule: when a skill writes prompts for other AI systems, require that skill's system-specific best-practice reference and quality gate before marking complete.

## How you should prompt correctly

Use this format:

- "Use skill `<skill-name>` for project `<project-id>` and complete Step `<N>` fully."
- Include constraints (genre, tone, target audience, runtime) in the same request.
- Require validation: "Run the skill checks and show results."

Example prompts:

- `Use skill step2-music-analysis for project default and complete Step 2 fully. Run completeness checks and report gaps.`
- `Use skill step4-references-assets for project my-video and ensure every canon character/location has 3 references.`

## Available step skills

- `step1-theme-concept`
- `step2-music-analysis`
- `step3-content-blueprint`
- `step4-references-assets`
- `step5-shots-prompts`

These are designed to map directly to the workflow pages:

- Step 1: `ui/step1.html`
- Step 2: `ui/step2.html`
- Step 3: `ui/step3.html`
- Step 4: `ui/step4.html`
- Step 5: `ui/index.html`
