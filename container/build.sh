#!/bin/bash
# Build the NanoClaw agent container images.
#
# Builds three images:
#   <base>:latest              — group/chat agents (main image)
#   nanoclaw-agent-python:latest — project agents (Python repos)
#   nanoclaw-agent-node:latest   — project agents (Node repos)
#
# Reads one optional build flag from ../.env:
#   INSTALL_CJK_FONTS=true   — add Chinese/Japanese/Korean fonts (~200MB)
# setup/container.ts reads the same file, so both build paths stay in sync.
# Callers can also override by exporting INSTALL_CJK_FONTS directly.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$SCRIPT_DIR"

# Derive the image name from the project root so two NanoClaw installs on the
# same host don't overwrite each other's `nanoclaw-agent:latest` tag. Matches
# setup/lib/install-slug.sh + src/install-slug.ts.
# shellcheck source=../setup/lib/install-slug.sh
source "$PROJECT_ROOT/setup/lib/install-slug.sh"
IMAGE_NAME="$(container_image_base)"
TAG="${1:-latest}"
CONTAINER_RUNTIME="${CONTAINER_RUNTIME:-docker}"

# Caller's env takes precedence; fall back to .env.
if [ -z "${INSTALL_CJK_FONTS:-}" ] && [ -f "../.env" ]; then
    INSTALL_CJK_FONTS="$(grep '^INSTALL_CJK_FONTS=' ../.env | tail -n1 | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '[:space:]')"
fi

BUILD_ARGS=()
if [ "${INSTALL_CJK_FONTS:-false}" = "true" ]; then
    echo "CJK fonts: enabled (adds ~200MB)"
    BUILD_ARGS+=(--build-arg INSTALL_CJK_FONTS=true)
fi

# Verify yaks vendor is present — run sync-yaks.sh to update it.
if [ ! -f "tools/yaks/yak.py" ]; then
  echo "Error: tools/yaks/yak.py not found." >&2
  echo "Run ./sync-yaks.sh to sync the vendor from https://github.com/joelgwebber/yaks" >&2
  exit 1
fi

build_image() {
  local name="$1"
  local dockerfile="$2"
  echo "Building ${name}:${TAG} from ${dockerfile}..."
  ${CONTAINER_RUNTIME} build "${BUILD_ARGS[@]}" -t "${name}:${TAG}" -f "${dockerfile}" .
  echo "  Done: ${name}:${TAG}"
}

build_image "${IMAGE_NAME}"              "Dockerfile"
build_image "nanoclaw-agent-python" "Dockerfile.project-python"
build_image "nanoclaw-agent-node"   "Dockerfile.project-node"

echo ""
echo "All images built:"
echo "  ${IMAGE_NAME}:${TAG}        — group/chat agents"
echo "  nanoclaw-agent-python:${TAG} — project agents (Python repos)"
echo "  nanoclaw-agent-node:${TAG}   — project agents (Node repos)"
