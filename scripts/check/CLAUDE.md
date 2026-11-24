# Check runner

Go CLI that runs the repo's checks in parallel with dependency ordering (adapted from the `swedish` repo's runner, which follows Cmdr's). Run from the repo root: `pnpm check` or `./scripts/check.sh`.

- Checks: `format` (oxfmt; formats locally, `--check` only with `--ci`), `eslint` (alias `lint`), `typecheck` (`tsc`), `vitest` (`test`), `build` (after typecheck), `scripts-go-vet` (`go-vet`), `scripts-go-tests` (`go-tests`). Lint, types, and tests wait for `format` so they see formatted files.
- `--check a,b` runs some, `--ci` disables auto-fixing and CSV logging, `--fail-fast`, `--verbose`. `--help` lists the checks.
- Stats go to `~/airguitar-check-log.csv` (one row per check per run).
- Add a check: a `Run…` func in `checks/` returning `Success(...)` or an error, then an entry in `AllChecks` (`checks/registry.go`).
