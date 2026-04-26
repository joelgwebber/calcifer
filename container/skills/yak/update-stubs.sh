#!/bin/bash
# Regenerate yaks:* stub skills from the vendored commands in container/tools/yaks/commands/.
#
# Upstream repo: https://github.com/joelgwebber/yaks
# Normally called by sync-yaks.sh — only run directly if you've manually
# edited the vendor and want to regenerate stubs without a full sync.
#
# Usage: bash container/skills/yak/update-stubs.sh

set -euo pipefail

SKILLS_DIR="$(cd "$(dirname "$0")/.." && pwd)"          # container/skills
VENDOR_DIR="$(cd "$(dirname "$0")/../.." && pwd)/tools/yaks"  # container/tools/yaks

if [ ! -d "$VENDOR_DIR" ]; then
  echo "error: vendor directory not found at $VENDOR_DIR" >&2
  echo "Run ./sync-yaks.sh to populate it from https://github.com/joelgwebber/yaks" >&2
  exit 1
fi

COMMANDS_DIR="$VENDOR_DIR/commands"
if [ ! -d "$COMMANDS_DIR" ]; then
  echo "error: no commands/ directory in vendor at $COMMANDS_DIR" >&2
  echo "Run ./sync-yaks.sh to populate it from https://github.com/joelgwebber/yaks" >&2
  exit 1
fi

echo "Regenerating yaks:* stubs from $COMMANDS_DIR"

for cmd_file in "$COMMANDS_DIR"/*.md; do
  cmd=$(basename "$cmd_file" .md)
  skill_dir="$SKILLS_DIR/yaks:$cmd"

  mkdir -p "$skill_dir"

  # Extract inner frontmatter (between the two --- delimiters)
  inner=$(awk 'NR==1{next} /^---/{exit} {print}' "$cmd_file")

  cat > "$skill_dir/SKILL.md" << EOF
---
${inner}
---

\`\`\`
bash /app/skills/yak/run-yak.sh ${cmd} \$ARGUMENTS
\`\`\`
EOF
  echo "  updated yaks:$cmd"
done

echo "Done."
