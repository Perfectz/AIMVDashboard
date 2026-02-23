# Security Scan Report — 2026-02-17

## Scope
- Repository: `AIMVDashboard`
- Focus: dependency vulnerability checks and lightweight static pattern review.

## Commands Run
1. `npm audit --json`
   - Result: **blocked** (`403 Forbidden` from npm advisories endpoint).
   - Note: dependency advisory API could not be reached from this environment.
2. `npm run lint`
   - Result: **pass** (project lint checks passed).
3. `rg -n "(eval\(|new Function\(|innerHTML\s*=|child_process|exec\(|spawn\(|md5|sha1|http://|document\.write\()" scripts ui`
   - Result: matched expected usage patterns requiring manual review.
4. `rg -n "(API_KEY|SECRET|TOKEN|PASSWORD|PRIVATE KEY|-----BEGIN|process\.env\.[A-Z0-9_]*KEY)" scripts ui docs --glob '!**/*.min.*'`
   - Result: no hardcoded credential values discovered; environment-variable based secret loading present.

## Findings

### 1) Dependency audit could not complete (environment limitation)
- `npm audit` failed with `403 Forbidden` against `https://registry.npmjs.org/-/npm/v1/security/advisories/bulk`.
- No advisory-based risk rating can be produced until network/policy access is fixed.

### 2) Server-side process execution usage found (reviewed)
- `child_process` usage appears in operational scripts and services:
  - `scripts/services/video_assembly_service.js`
  - `scripts/services/agent_prompt_tools.js`
  - `scripts/compile_prompts.js`
  - `scripts/health_check.js`
  - `scripts/restart.js`
- Risk level: **medium** if any command arguments become user-controlled.
- Current recommendation: ensure all subprocess invocations are argument-array based (no shell interpolation) and validate/allowlist every user-provided segment.

### 3) DOM injection surfaces present in UI code (reviewed)
- Multiple `innerHTML` assignments are used across UI modules/pages.
- Risk level: **medium** for XSS if unsanitized user content is inserted.
- Current recommendation: keep using `escapeHtml` where dynamic content is inserted; prefer `textContent` where HTML templating is unnecessary.

### 4) Secret handling pattern appears acceptable in sampled files
- API tokens and secrets are referenced via environment variables and `.env` loading paths (e.g., `REPLICATE_API_TOKEN`, provider keys).
- No plaintext secret values were detected by pattern scan.
- Note: this is pattern-based verification, not cryptographic proof of absence.

## Recommended Next Steps
1. Re-run dependency scan from an environment with npm advisory API access:
   - `npm audit --production`
2. Add/enable a CI security job with:
   - dependency audit,
   - secret scan,
   - SAST checks for command execution and XSS sinks.
3. Add targeted unit tests for any code path that builds subprocess arguments from request data.
4. Add lint rules or utility wrappers to discourage unsafe `innerHTML` for untrusted data.

## Improvements I Would Make (Prioritized)

### P0 — Unblock dependency advisory scanning in CI
- **Why:** current `npm audit` is blocked, so known CVEs in dependencies can go undetected.
- **Action:** run `npm audit --omit=dev --audit-level=high` in CI from an environment that can access npm advisories, and fail builds on high/critical findings.
- **Hardening add-on:** check in `package-lock.json` (already present) and enforce deterministic installs (`npm ci`) to reduce supply-chain drift.

### P1 — Reduce command-execution risk in server scripts
- **Why:** `child_process` usage is necessary for this project, but can become dangerous if user-controlled values are forwarded.
- **Action:** standardize all subprocess calls to `spawn/execFile` with explicit argument arrays and `shell: false`.
- **Guardrails:**
  - add input validation + allowlists for command names, model/provider IDs, output paths, and filenames;
  - reject path traversal (`..`, absolute paths outside project root);
  - centralize subprocess creation in a wrapper utility that enforces these defaults.

### P1 — Mitigate XSS from `innerHTML` sink usage
- **Why:** UI code relies on `innerHTML` in many places; this is safe only when all interpolated values are escaped/trusted.
- **Action:**
  - introduce a small safe-render utility (`setText`, `setHtmlTrusted`) and migrate low-risk areas to `textContent` first;
  - keep `innerHTML` only for static templates or sanitized content;
  - add tests for representative rendering paths that currently interpolate user/project content.

### P2 — Add automated secret scanning
- **Why:** pattern scan found no hardcoded secrets, but continuous protection is needed.
- **Action:** add a CI job with a secret scanner (e.g., Gitleaks/TruffleHog) on pull requests and default branch.
- **Policy:** block merges on verified leaks and provide a documented rotation playbook.

### P2 — Strengthen security testing baseline
- **Action:** add a `security` npm script that runs:
  1) dependency audit,
  2) secret scan,
  3) targeted grep/SAST checks for dangerous sinks (`innerHTML`, `eval`, raw shell execution).
- **Outcome:** one command for local + CI reproducible security checks.
