#!/bin/bash
set -e

# Compile agent-runner TypeScript (bind-mounted source may have been updated)
cd /app && npx tsc --outDir /tmp/dist 2>&1 >&2
ln -sf /app/node_modules /tmp/dist/node_modules
chmod -R a-w /tmp/dist

# Load credentials
[ -f /workspace/credentials.env ] && set -a && . /workspace/credentials.env && set +a

# Configure git identity and GitHub credentials
git config --global user.email "${GIT_AUTHOR_EMAIL:-calcifer@local}"
git config --global user.name "${GIT_AUTHOR_NAME:-Calcifer}"
if [ -n "$GITHUB_TOKEN" ]; then
  git config --global url."https://oauth2:${GITHUB_TOKEN}@github.com/".insteadOf "https://github.com/"
fi

# Clone repo into /workspace/task on first run (volume is empty, no .git present)
PROJECT_JSON=/workspace/context/project.json
if [ -f "$PROJECT_JSON" ] && [ ! -d /workspace/task/.git ]; then
  REPO=$(node -e "const c=require('$PROJECT_JSON'); process.stdout.write(c.repo)")
  CLONE_FLAGS=$(node -e "const c=require('$PROJECT_JSON'); process.stdout.write(c.clone_flags||'')" 2>/dev/null || true)
  DEFAULT_BRANCH=$(node -e "const c=require('$PROJECT_JSON'); process.stdout.write(c.default_branch||'main')" 2>/dev/null || echo "main")

  echo "Cloning ${REPO} (branch: ${DEFAULT_BRANCH})..." >&2
  # shellcheck disable=SC2086
  git clone $CLONE_FLAGS --branch "${DEFAULT_BRANCH}" "${REPO}" /workspace/task

  # Initialize submodules if submodule_depth is set
  SUBMODULE_DEPTH=$(node -e "const c=require('$PROJECT_JSON'); process.stdout.write(String(c.submodule_depth||0))" 2>/dev/null || echo "0")
  if [ "${SUBMODULE_DEPTH}" -gt "0" ] 2>/dev/null; then
    echo "Initializing submodules (depth ${SUBMODULE_DEPTH})..." >&2
    cd /workspace/task && git submodule update --init --depth "${SUBMODULE_DEPTH}"
  fi
fi

cd /workspace/task
cat > /tmp/input.json
node /tmp/dist/index.js < /tmp/input.json
