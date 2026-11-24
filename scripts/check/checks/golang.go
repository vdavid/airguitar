package checks

import (
	"fmt"
	"os/exec"
	"path/filepath"
)

func goIn(ctx *CheckContext, args ...string) (string, error) {
	cmd := exec.Command("go", args...)
	cmd.Dir = filepath.Join(ctx.RootDir, "scripts", "check")
	return RunCommand(cmd, true)
}

// RunGoVet vets the check runner itself.
func RunGoVet(ctx *CheckContext) (CheckResult, error) {
	if out, err := goIn(ctx, "vet", "./..."); err != nil {
		return CheckResult{}, fmt.Errorf("go vet found problems\n%s", indentOutput(out))
	}
	return Success("no problems"), nil
}

// RunGoTests runs the check runner's own tests.
func RunGoTests(ctx *CheckContext) (CheckResult, error) {
	if out, err := goIn(ctx, "test", "./..."); err != nil {
		return CheckResult{}, fmt.Errorf("go tests failed\n%s", indentOutput(out))
	}
	return Success("passed"), nil
}
