package main

import (
	"flag"
	"fmt"
	"os"
	"os/signal"
	"slices"
	"strings"
	"syscall"
	"time"

	"airguitar/scripts/check/checks"
)

// stringSlice implements flag.Value for accumulating multiple flag values
type stringSlice []string

func (s *stringSlice) String() string {
	return strings.Join(*s, ",")
}

func (s *stringSlice) Set(value string) error {
	for v := range strings.SplitSeq(value, ",") {
		v = strings.TrimSpace(v)
		if v != "" {
			*s = append(*s, v)
		}
	}
	return nil
}

// cliFlags holds the parsed command-line flags.
type cliFlags struct {
	checkNames  []string
	ciMode      bool
	verbose     bool
	includeSlow bool
	failFast    bool
	noLog       bool
}

func main() {
	// Kill all child process groups on Ctrl+C / SIGTERM so no orphans are left behind.
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigCh
		checks.KillAllProcesses()
		os.Exit(130) // 128 + SIGINT(2)
	}()

	// Validate check configuration at startup to catch nickname collisions early
	if err := checks.ValidateCheckNames(); err != nil {
		printError("Bad check configuration: %v", err)
		os.Exit(1)
	}

	flags := parseFlags()
	if flags == nil {
		return // Help was shown
	}

	rootDir, err := findRootDir()
	if err != nil {
		printError("Error: %v", err)
		os.Exit(1)
	}

	ctx := &checks.CheckContext{
		CI:      flags.ciMode,
		Verbose: flags.verbose,
		RootDir: rootDir,
	}

	checksToRun, err := selectChecks(flags)
	if err != nil {
		printError("Error: %v", err)
		os.Exit(1)
	}

	checksToRun = checks.FilterSlowChecks(checksToRun, flags.includeSlow)

	if len(checksToRun) == 0 {
		fmt.Println("No checks to run.")
		os.Exit(0)
	}

	runChecks(ctx, checksToRun, flags.failFast, flags.noLog)
}

// parseFlags parses command-line flags and returns nil if help was shown.
func parseFlags() *cliFlags {
	var (
		checkNames  stringSlice
		ciMode      = flag.Bool("ci", false, "Disable auto-fixing (for CI)")
		verbose     = flag.Bool("verbose", false, "Show detailed output")
		includeSlow = flag.Bool("include-slow", false, "Include slow checks (excluded by default)")
		failFast    = flag.Bool("fail-fast", false, "Stop on first failure")
		noLog       = flag.Bool("no-log", false, "Disable CSV stats logging")
		help        = flag.Bool("help", false, "Show help message")
		h           = flag.Bool("h", false, "Show help message")
	)
	flag.Var(&checkNames, "check", "Run specific checks by ID (can be repeated or comma-separated)")
	flag.Parse()

	if *help || *h {
		showUsage()
		return nil
	}

	return &cliFlags{
		checkNames:  checkNames,
		ciMode:      *ciMode,
		verbose:     *verbose,
		includeSlow: *includeSlow || len(checkNames) > 0,
		failFast:    *failFast,
		noLog:       *noLog || *ciMode,
	}
}

// selectChecks determines which checks to run based on flags.
func selectChecks(flags *cliFlags) ([]checks.CheckDefinition, error) {
	if len(flags.checkNames) == 0 {
		return checks.AllChecks, nil
	}

	return selectChecksByID(flags.checkNames)
}

// selectChecksByID returns checks matching the given IDs.
func selectChecksByID(names []string) ([]checks.CheckDefinition, error) {
	var result []checks.CheckDefinition
	for _, name := range names {
		check := checks.GetCheckByID(name)
		if check == nil {
			return nil, fmt.Errorf("unknown check ID: %s\nRun with --help to see available checks", name)
		}
		result = append(result, *check)
	}
	return result, nil
}

// runChecks executes the checks and prints results.
func runChecks(ctx *checks.CheckContext, checksToRun []checks.CheckDefinition, failFast, noLog bool) {
	fmt.Printf("🔍 Running %d checks...\n\n", len(checksToRun))

	startTime := time.Now()
	runner := NewRunner(ctx, checksToRun, failFast, noLog)
	failed, failedChecks := runner.Run()

	totalDuration := time.Since(startTime)
	fmt.Println()
	fmt.Printf("%s⏱️  Total runtime: %s%s\n", colorYellow, formatDuration(totalDuration), colorReset)

	if failed {
		printFailure(failedChecks)
		os.Exit(1)
	}

	fmt.Printf("%s✅ All checks passed!%s\n", colorGreen, colorReset)
}

// printFailure prints the failure message with rerun instructions.
func printFailure(failedChecks []string) {
	fmt.Printf("%s❌ Some checks failed.%s\n", colorRed, colorReset)
	if len(failedChecks) > 0 {
		fmt.Println()
		checkWord := "check"
		if len(failedChecks) > 1 {
			checkWord = "checks"
		}
		fmt.Printf("To rerun the failed %s: ./scripts/check.sh --check %s\n", checkWord, strings.Join(failedChecks, ","))
	}
}

// showUsage displays the help message with dynamically generated check list.
func showUsage() {
	fmt.Println("Usage: ./scripts/check.sh [OPTIONS]")
	fmt.Println()
	fmt.Println("Run code quality checks for the air guitar app.")
	fmt.Println()
	fmt.Println("OPTIONS:")
	fmt.Println("    --check ID               Run specific checks by ID (can be repeated or comma-separated)")
	fmt.Println("    --ci                     Disable auto-fixing (for CI)")
	fmt.Println("    --verbose                Show detailed output")
	fmt.Println("    --include-slow           Include slow checks (excluded by default)")
	fmt.Println("    --fail-fast              Stop on first failure")
	fmt.Println("    --no-log                 Disable CSV stats logging (~/airguitar-check-log.csv)")
	fmt.Println("    -h, --help               Show this help message")
	fmt.Println()
	fmt.Println("If no options are provided, runs all non-slow checks.")
	fmt.Println()
	fmt.Println("EXAMPLES:")
	fmt.Println("    ./scripts/check.sh                        # Run all checks")
	fmt.Println("    ./scripts/check.sh --check vitest          # Run specific check")
	fmt.Println("    ./scripts/check.sh --include-slow         # Include slow checks")
	fmt.Println("    ./scripts/check.sh --ci --fail-fast       # CI mode, stop on first failure")
	fmt.Println()

	if len(checks.AllChecks) == 0 {
		fmt.Println("No checks registered yet.")
		return
	}

	fmt.Println("Available checks:")
	fmt.Println()

	// Group checks by tech
	type checkGroup struct {
		tech string
		ids  []string
	}

	groupMap := make(map[string]*checkGroup)
	var groupOrder []string

	for _, check := range checks.AllChecks {
		key := check.Tech
		if _, ok := groupMap[key]; !ok {
			groupMap[key] = &checkGroup{
				tech: check.Tech,
			}
			groupOrder = append(groupOrder, key)
		}
		name := check.CLIName()
		if check.IsSlow {
			name += " (slow)"
		}
		groupMap[key].ids = append(groupMap[key].ids, name)
	}

	// Sort groups
	slices.Sort(groupOrder)

	for _, key := range groupOrder {
		g, ok := groupMap[key]
		if !ok {
			continue
		}
		fmt.Printf("  %s\n", g.tech)
		for _, id := range g.ids {
			fmt.Printf("    - %s\n", id)
		}
	}
}
