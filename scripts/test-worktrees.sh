#!/bin/bash
# End-to-end validation for per-yak worktree container mounting fixes.
# Uses the existing gnusto/gnusto-85aa worktree — no network or Calcifer service needed.
set -euo pipefail

WORKTREE_DIR="$(pwd)/data/projects/gnusto/worktrees/gnusto-85aa"
REPO_DIR="$(pwd)/data/projects/gnusto/repo"
IMAGE="nanoclaw-agent-python:latest"
PASS=0
FAIL=0

pass() { printf '\033[32m✓\033[0m %s\n' "$1"; ((PASS++)) || true; }
fail() { printf '\033[31m✗\033[0m %s\n' "$1"; ((FAIL++)) || true; }

require() {
  if [ ! -e "$1" ]; then
    echo "SKIP: $1 not found — run from calcifer root with gnusto worktree present"
    exit 0
  fi
}

require "$WORKTREE_DIR/.git"
require "$REPO_DIR/.git"

RUN="docker run --rm --entrypoint bash"
MOUNTS_2=(-v "$WORKTREE_DIR:/workspace/task" -v "$REPO_DIR:$REPO_DIR" --workdir /workspace/task)
MOUNTS_1=(-v "$WORKTREE_DIR:/workspace/task" --workdir /workspace/task)

echo ""
echo "=== 1. git resolves in container WITH main repo mount ==="
if $RUN "${MOUNTS_2[@]}" "$IMAGE" -c 'git status --short' >/dev/null 2>&1; then
  pass "git status succeeds with dual mount"
else
  fail "git status failed even with dual mount"
fi

echo ""
echo "=== 2. git FAILS without main repo mount (fix is load-bearing) ==="
if $RUN "${MOUNTS_1[@]}" "$IMAGE" -c 'git status --short' >/dev/null 2>&1; then
  fail "git status unexpectedly succeeded without main repo mount"
else
  pass "git status correctly fails without main repo mount"
fi

echo ""
echo "=== 3. entrypoint clone guard: -d vs -e on worktree .git file ==="
result=$($RUN "${MOUNTS_2[@]}" "$IMAGE" -c '
  [ ! -d /workspace/task/.git ] && echo OLD_WOULD_CLONE || echo OLD_WOULD_SKIP
  [ ! -e /workspace/task/.git ] && echo NEW_WOULD_CLONE || echo NEW_WOULD_SKIP
')
old=$(echo "$result" | grep OLD | sed 's/OLD_WOULD_//')
new=$(echo "$result" | grep NEW | sed 's/NEW_WOULD_//')

if [ "$old" = "CLONE" ]; then
  pass "old -d guard was broken (would clone on top of worktree)"
else
  fail "old -d guard: expected CLONE got '$old'"
fi
if [ "$new" = "SKIP" ]; then
  pass "new -e guard correctly skips clone"
else
  fail "new -e guard: expected SKIP got '$new'"
fi

echo ""
echo "=== 4. git branch and log work inside container ==="
branch=$($RUN "${MOUNTS_2[@]}" "$IMAGE" -c 'git rev-parse --abbrev-ref HEAD 2>/dev/null' || true)
if [[ "$branch" == yak-* ]]; then
  pass "worktree is on branch $branch"
else
  fail "unexpected branch: '$branch'"
fi

log_line=$($RUN "${MOUNTS_2[@]}" "$IMAGE" -c 'git log --oneline -1 2>/dev/null' || true)
if [ -n "$log_line" ]; then
  pass "git log works: $log_line"
else
  fail "git log returned nothing"
fi

echo ""
printf '=== Results: \033[32m%d passed\033[0m, \033[31m%d failed\033[0m ===\n' "$PASS" "$FAIL"
echo ""
[ "$FAIL" -eq 0 ]
