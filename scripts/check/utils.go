package main

import (
	"fmt"
	"os"
	"path/filepath"
)

// findRootDir walks up from the working directory to the repo root (the folder with both
// package.json and scripts/check/).
func findRootDir() (string, error) {
	dir, err := os.Getwd()
	if err != nil {
		return "", err
	}
	for {
		_, pkgErr := os.Stat(filepath.Join(dir, "package.json"))
		_, chkErr := os.Stat(filepath.Join(dir, "scripts", "check"))
		if pkgErr == nil && chkErr == nil {
			return dir, nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "", fmt.Errorf("could not find project root (looking for package.json next to scripts/check)")
		}
		dir = parent
	}
}
