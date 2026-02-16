# AI Agent Workflow (Task-First)

This guide defines a machine-readable workflow so AI agents can make constrained, reliable changes.

## 1) Task Manifest

Agents should prefer a task manifest over free-form instructions when available.

- Location: `tasks/*.json` (recommended)
- Template: `templates/agent-task.template.json`

Core fields:

- `taskId`: Unique ID
- `summary`: Human-readable goal
- `allowedFiles`: Glob/path allowlist
- `requiredChecks`: Commands that must be run
- `acceptanceCriteria`: Verifiable outcomes
- `risk`: `low` | `medium` | `high`
- `notes`: Extra implementation context

## 2) Layering Rules

When implementing a feature:

1. Put validation rules in `ui/domain/*`
2. Put transport/API calls in `ui/services/*`
3. Put orchestration in `ui/features/*`
4. Keep UI files focused on view wiring and rendering

## 3) Scaffold First

Use the scaffolder to reduce drift:

```bash
npm run scaffold:feature -- my-feature --with-domain --with-service --dry-run
```

Use `--force` to overwrite existing generated files.

This creates:

- `ui/features/my-feature-feature.js`
- `ui/domain/my-feature-domain.js` *(optional)*
- `ui/services/my-feature-service.js` *(optional)*
- `tests/unit/my-feature-feature.test.js`

## 4) Required Checks

Run all checks declared in the task manifest plus:

```bash
npm run test:unit
npm run lint
npm run lint:architecture
```

All commands above are available via `package.json` scripts.

## 5) Architecture Dependency Map

Use `docs/architecture/deps.json` for a machine-readable view of layer relationships.


## 6) Layer Guardrail: direct fetch()

Run `npm run lint:architecture` to ensure `fetch()` calls are confined to `ui/services/*`.
Legacy exceptions are documented in `docs/architecture/fetch-allowlist.json`.
