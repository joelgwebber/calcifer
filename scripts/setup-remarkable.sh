#!/usr/bin/env bash
# One-time reMarkable device registration.
# Usage: ./scripts/setup-remarkable.sh <8-char-code>
# Get the code from: https://my.remarkable.com/device/browser/connect

set -euo pipefail

CODE="${1:-}"
if [[ -z "$CODE" || ${#CODE} -ne 8 ]]; then
  echo "Usage: $0 <8-character-code>"
  echo "Generate a code at: https://my.remarkable.com/device/browser/connect"
  exit 1
fi

DEVICE_ID=$(python3 -c 'import uuid; print(uuid.uuid4())')

echo "Registering device (ID: $DEVICE_ID)..."

TOKEN=$(curl -s -f -X POST https://webapp-prod.cloud.remarkable.engineering/token/json/2/device/new \
  -H 'Content-Type: application/json' \
  -d "{\"code\":\"${CODE}\",\"deviceDesc\":\"desktop-linux\",\"deviceID\":\"${DEVICE_ID}\"}")

if [[ -z "$TOKEN" ]]; then
  echo "Error: registration failed (empty response). Check that the code is valid and not expired."
  exit 1
fi

echo ""
echo "Success! Add this to your .env file:"
echo ""
echo "REMARKABLE_DEVICE_TOKEN=${TOKEN}"
echo ""
echo "Then sync to the container env:"
echo "  cp .env data/env/env"
echo "  systemctl --user restart nanoclaw   # or launchctl kickstart -k gui/\$(id -u)/com.nanoclaw"
