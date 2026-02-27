#!/bin/bash
set -euo pipefail

echo "=== Mise Go Backend Memory Issue Reproduction ==="
echo ""
echo "This script demonstrates excessive memory usage when mise validates"
echo "go: backend tools. The issue: 'go list -versions' spawns 15+ child"
echo "processes that can exhaust available memory."
echo ""

cd "$(dirname "$0")"

# Clean any existing cache
echo "Cleaning mise cache..."
rm -rf ~/.local/share/mise/installs/go* 2>/dev/null || true

# Start monitoring in background
echo ""
echo "Starting resource monitor..."
(
    while sleep 2; do
        echo "[$(date +%T)] Memory: $(free -h | grep Mem | awk '{print $3 "/" $2}')"
        echo "  go processes: $(pgrep -c go 2>/dev/null || echo 0)"
        ps aux | grep -E "go (list|get|install)" | grep -v grep | head -5 || true
        echo ""
    done
) &
monitor_pid=$!

# Trust the config
echo "Running: mise trust --yes"
mise trust --yes

# This triggers the issue - mise validates ALL tools including upgrade-provider
echo ""
echo "Running: mise ls golangci-lint --json -c"
echo "This will validate upgrade-provider and spawn 15+ go list processes..."
echo ""

mise ls golangci-lint --json -c || echo "Command failed with exit code $?"

# Stop monitoring
kill $monitor_pid 2>/dev/null || true

echo ""
echo "=== Reproduction complete ==="
echo ""
echo "Expected behavior: Should complete with reasonable memory usage"
echo "Actual behavior: Spawns 15+ concurrent 'go list' processes, exhausts memory"
