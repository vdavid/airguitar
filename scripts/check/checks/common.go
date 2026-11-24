package checks

import (
	"bytes"
	"os"
	"os/exec"
	"strings"
	"sync"
	"syscall"
)

// ResultCode indicates the outcome of a check.
type ResultCode int

const (
	ResultSuccess ResultCode = iota
	ResultWarning
	ResultSkipped
)

// CheckResult is returned by checks on success.
type CheckResult struct {
	Code        ResultCode
	Message     string
	MadeChanges bool // true if the check modified files (for example, formatted code)
	Total       int  // items checked (-1 = N/A)
	Issues      int  // items needing attention (-1 = N/A)
	Changes     int  // files modified (-1 = N/A)
}

// Success creates a success result with the given message (no changes made).
func Success(message string) CheckResult {
	return CheckResult{Code: ResultSuccess, Message: message, Total: -1, Issues: -1, Changes: -1}
}

// SuccessWithChanges creates a success result indicating files were modified.
func SuccessWithChanges(message string) CheckResult {
	return CheckResult{Code: ResultSuccess, Message: message, MadeChanges: true, Total: -1, Issues: -1, Changes: -1}
}

// Skipped creates a skipped result with the given reason.
func Skipped(reason string) CheckResult {
	return CheckResult{Code: ResultSkipped, Message: reason, Total: -1, Issues: -1, Changes: -1}
}

// Warning creates a warning result with the given message.
func Warning(message string) CheckResult {
	return CheckResult{Code: ResultWarning, Message: message, Total: -1, Issues: -1, Changes: -1}
}

// CheckContext holds the context for running checks.
type CheckContext struct {
	CI      bool
	Verbose bool
	RootDir string
}

// CheckFunc is the function signature for check implementations.
type CheckFunc func(ctx *CheckContext) (CheckResult, error)

// CheckDefinition defines a check's metadata and implementation.
type CheckDefinition struct {
	ID          string
	Nickname    string // Short alias shown in --help and accepted by --check (if empty, ID is used)
	DisplayName string
	Tech        string
	IsSlow      bool
	DependsOn   []string
	Run         CheckFunc
}

// processTracker keeps track of all running child processes so they can be
// killed as a group on Ctrl+C. Each command is started with its own process
// group (Setpgid), so killing -pgid cleans up all its descendants too.
var processTracker = struct {
	mu    sync.Mutex
	procs map[*exec.Cmd]struct{}
}{procs: make(map[*exec.Cmd]struct{})}

// KillAllProcesses sends SIGTERM to the process group of every tracked child.
func KillAllProcesses() {
	processTracker.mu.Lock()
	defer processTracker.mu.Unlock()
	for cmd := range processTracker.procs {
		if cmd.Process != nil {
			// Kill the entire process group (negative PID).
			_ = syscall.Kill(-cmd.Process.Pid, syscall.SIGTERM)
		}
	}
}

// RunCommand executes a command and captures its output.
// The command is started in its own process group so that all of its
// descendants can be killed together on shutdown.
func RunCommand(cmd *exec.Cmd, captureOutput bool) (string, error) {
	var stdout, stderr bytes.Buffer
	if captureOutput {
		cmd.Stdout = &stdout
		cmd.Stderr = &stderr
	} else {
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
	}

	// Give the child its own process group so we can kill the whole tree.
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}

	if err := cmd.Start(); err != nil {
		return "", err
	}

	processTracker.mu.Lock()
	processTracker.procs[cmd] = struct{}{}
	processTracker.mu.Unlock()

	err := cmd.Wait()

	processTracker.mu.Lock()
	delete(processTracker.procs, cmd)
	processTracker.mu.Unlock()

	output := stdout.String()
	if stderr.Len() > 0 {
		output += stderr.String()
	}
	return output, err
}

// CommandExists checks if a command exists in PATH.
func CommandExists(name string) bool {
	_, err := exec.LookPath(name)
	return err == nil
}

// Pluralize returns singular if count is 1, plural otherwise.
// Example: Pluralize(1, "file", "files") returns "file"
// Example: Pluralize(5, "file", "files") returns "files"
func Pluralize(count int, singular, plural string) string {
	if count == 1 {
		return singular
	}
	return plural
}

// indentOutput indents each non-empty line of output.
func indentOutput(output string) string {
	lines := strings.Split(output, "\n")
	var result strings.Builder
	for _, line := range lines {
		if strings.TrimSpace(line) != "" {
			result.WriteString("      ")
			result.WriteString(line)
			result.WriteString("\n")
		}
	}
	return result.String()
}
