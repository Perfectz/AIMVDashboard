# Documentation Index

System-level documentation for architecture, workflows, modules, and troubleshooting.

**Last updated:** 2026-02-15

---

## Start Here

1. `../README.md` — project purpose, quick start, production workflow.
2. `workflows/SHOT_FLOW.md` — Step 5 shot generation flow and API sequence.
3. `architecture/SERVER.md` — Node server: routing, middleware, domain-scoped contexts, 20 services.
4. `architecture/FRONTEND.md` — pages, layering model, SharedUtils, auto-save, modules, DI container.

## Architecture

| Doc | Covers |
|-----|--------|
| `architecture/SERVER.md` | Server bootstrap, router, middleware, route modules, service instantiation, domain-scoped contexts |
| `architecture/FRONTEND.md` | Pages, layering model (UI → Module → Feature → Domain → Service), state management, auto-save |
| `architecture/deps.json` | Machine-readable dependency graph (86 edges across 6 layers) |

## Module Maps

| Doc | Covers |
|-----|--------|
| `modules/ROUTES.md` | Complete API endpoint catalog by route file (13 route files) |
| `modules/SERVICES.md` | All 20 backend services: responsibilities, inputs/outputs, failure modes, dependencies |
| `modules/UI.md` | UI pages (8), modules (11), services (10), domain (3), features (3), DI container |

## Design and Practices

| Doc | Covers |
|-----|--------|
| `design/DESIGN_PATTERNS.md` | APIE patterns used in this codebase |
| `UI_LAYER.md` | UI layer architecture details and extension rules |
| `AI_AGENT_WORKFLOW.md` | Task-manifest workflow for constrained AI edits |

## Troubleshooting

| Doc | Covers |
|-----|--------|
| `troubleshooting/SHOT_GENERATION.md` | SeedDream/Replicate generation diagnostics |

---

## How to Use This Documentation

When debugging or implementing features:

1. **Find the owner** — locate the responsible module/route/service in module docs.
2. **Check the interface** — confirm request/response/state contracts.
3. **Trace data flow** — validate against `deps.json` and workflow docs.
4. **Use troubleshooting** — follow known failure signatures for common issues.

For AI agents: start with `architecture/SERVER.md` and `architecture/FRONTEND.md` for system overview, then drill into `modules/SERVICES.md` and `modules/UI.md` for specific components.
