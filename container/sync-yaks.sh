#!/bin/bash
# Sync the vendored yaks content from the upstream repo and regenerate stubs.
#
# Upstream: https://github.com/joelgwebber/yaks
#
# Run this whenever yaks is updated. After it completes:
#   1. Review and commit the changes in container/tools/yaks/ and container/skills/
#   2. Run ./build.sh to rebuild container images

set -euo pipefail

REPO="https://github.com/joelgwebber/yaks"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENDOR_DIR="$SCRIPT_DIR/tools/yaks"
SKILLS_DIR="$SCRIPT_DIR/skills"
REF="${1:-main}"

tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT

echo "Cloning $REPO@$REF..."
git clone --quiet --depth 1 --branch "$REF" "$REPO" "$tmpdir/yaks" 2>/dev/null \
  || git clone --quiet --depth 1 "$REPO" "$tmpdir/yaks"
src="$tmpdir/yaks"

# Scripts — baked into all three Docker images at /opt/yaks/
echo "Syncing scripts → tools/yaks/"
mkdir -p "$VENDOR_DIR"
cp "$src/scripts/yak.py" "$VENDOR_DIR/yak.py"
rm -rf "$VENDOR_DIR/yaklib"
cp -r "$src/scripts/yaklib" "$VENDOR_DIR/yaklib"

# Commands — used by update-stubs.sh to generate the yaks:* skill stubs
echo "Syncing commands → tools/yaks/commands/"
rm -rf "$VENDOR_DIR/commands"
cp -r "$src/commands" "$VENDOR_DIR/commands"

# Mandate skill — auto-activated when .yaks/ exists in the project
echo "Syncing mandate skill → skills/yak/SKILL.md"
cp "$src/skills/yak/SKILL.md" "$SKILLS_DIR/yak/SKILL.md"

# Regenerate the yaks:* stub skills from the updated commands
echo "Regenerating yaks:* stubs..."
bash "$SKILLS_DIR/yak/update-stubs.sh"

echo ""
echo "Done. Next steps:"
echo "  git diff --stat          # review what changed"
echo "  git add -p               # stage the vendor + stub changes"
echo "  ./build.sh               # rebuild container images"
