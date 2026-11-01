# Repository Guidelines

## Project Structure & Module Organization

Chrome Block is a Chrome Manifest V3 extension with opt-in protection by hostname.

- `src/background/`: service worker, declarative rules, settings, messages, and session logs.
- `src/content/`: MAIN-world interception and the isolated-world controller.
- `src/popup/`: Spanish-language menu, styles, and status presentation.
- `src/shared/`: permission patterns, policy, and message validation.
- `extension/`: manifest and bundled PNG icons.
- `tests/`: Node tests, Chrome API adapters in `helpers/`, and manual fixtures in `fixtures/`.
- `scripts/`: build, package checks, fixture server, and icon generation.
- `docs/`: design, implementation plan, and verification notes.
- `dist/`: generated extension; rebuild rather than edit directly.

## Build, Test, and Development Commands

Use Node.js 24 or newer. No npm dependencies are required.

- `node --run test`: run the full automated suite.
- `node --run build`: recreate `dist/`, stripping TypeScript types and copying assets.
- `node --run check`: rebuild and check JavaScript syntax and manifest resource paths.
- `node --run fixtures`: serve browser fixtures at `http://localhost:8765/protected`.
- `python3 scripts/icons.py`: regenerate bundled icons.

Load `dist/` through **Load unpacked** in `chrome://extensions`. Reload the extension after rebuilding. The package check does not perform TypeScript type checking or validate behavior inside Chrome.

## Coding Style & Naming Conventions

Use TypeScript with ES module imports, two-space indentation, semicolons, and single-quoted strings. Keep imports pointing to `.ts` source files; the build rewrites extensions. Use camelCase for functions and variables, PascalCase for types, and uppercase message names such as `SET_SITE`. Keep modules focused. No formatter or linter is currently configured.

## Testing Guidelines

Tests use `node:test` and `node:assert/strict` in `tests/*.test.mjs`. Use descriptive behavior-based test names. Add regression tests for fixes, especially permission requests, hostname boundaries, settings rollback, and message authorization. No numeric coverage threshold is configured. Report browser verification separately from simulated API tests.

## Commit & Pull Request Guidelines

This checkout has no Git metadata, so no historical commit convention is available. Prefer concise imperative subjects, optionally prefixed with `fix:`, `feat:`, or `docs:`. PRs should describe behavior changes, relevant issues, validation commands, and remaining limitations. Include screenshots for menu changes.

## Security & Configuration

Keep protection opt-in. Request explicit HTTP/HTTPS permissions only for selected hosts. Validate privileged message senders and recovery URLs. Preserve existing site CSP headers. Keep destination logs in session storage and never add telemetry implicitly.
