package checks

import (
	"fmt"
	"os/exec"
	"regexp"
	"strconv"
)

// pnpm runs a command through pnpm in the repo root.
func pnpm(ctx *CheckContext, args ...string) (string, error) {
	cmd := exec.Command("pnpm", args...)
	cmd.Dir = ctx.RootDir
	return RunCommand(cmd, true)
}

// RunFormat checks formatting with oxfmt. Locally it formats first, so a run leaves the tree tidy;
// in CI it only checks.
func RunFormat(ctx *CheckContext) (CheckResult, error) {
	if ctx.CI {
		if out, err := pnpm(ctx, "exec", "oxfmt", "--check", "."); err != nil {
			return CheckResult{}, fmt.Errorf("files need formatting (run pnpm format)\n%s", indentOutput(out))
		}
		return Success("all files formatted"), nil
	}
	before, _ := gitDiff(ctx)
	if out, err := pnpm(ctx, "exec", "oxfmt", "."); err != nil {
		return CheckResult{}, fmt.Errorf("oxfmt failed\n%s", indentOutput(out))
	}
	if after, _ := gitDiff(ctx); after != before {
		return SuccessWithChanges("formatted files"), nil
	}
	return Success("all files formatted"), nil
}

func gitDiff(ctx *CheckContext) (string, error) {
	cmd := exec.Command("git", "diff", "--stat")
	cmd.Dir = ctx.RootDir
	return RunCommand(cmd, true)
}

// RunESLint runs type-aware ESLint with zero warnings allowed.
func RunESLint(ctx *CheckContext) (CheckResult, error) {
	if out, err := pnpm(ctx, "exec", "eslint", "--max-warnings", "0", "."); err != nil {
		return CheckResult{}, fmt.Errorf("eslint found problems\n%s", indentOutput(out))
	}
	return Success("no problems"), nil
}

// RunTypecheck runs tsc in no-emit mode.
func RunTypecheck(ctx *CheckContext) (CheckResult, error) {
	if out, err := pnpm(ctx, "exec", "tsc", "--noEmit"); err != nil {
		return CheckResult{}, fmt.Errorf("type errors\n%s", indentOutput(out))
	}
	return Success("no type errors"), nil
}

// RunVitest runs the unit tests.
func RunVitest(ctx *CheckContext) (CheckResult, error) {
	out, err := pnpm(ctx, "exec", "vitest", "--run")
	if err != nil {
		return CheckResult{}, fmt.Errorf("tests failed\n%s", indentOutput(out))
	}
	if m := regexp.MustCompile(`Tests\s+(\d+) passed`).FindStringSubmatch(out); len(m) > 1 {
		n, _ := strconv.Atoi(m[1])
		r := Success(fmt.Sprintf("%d %s passed", n, Pluralize(n, "test", "tests")))
		r.Total = n
		return r, nil
	}
	return Success("all tests passed"), nil
}

// RunBuild runs the production build.
func RunBuild(ctx *CheckContext) (CheckResult, error) {
	if out, err := pnpm(ctx, "exec", "vite", "build"); err != nil {
		return CheckResult{}, fmt.Errorf("build failed\n%s", indentOutput(out))
	}
	return Success("built"), nil
}
