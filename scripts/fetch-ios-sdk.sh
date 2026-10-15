#!/usr/bin/env bash
# Usage: fetch-ios-sdk.sh <xcframework zip url> <sha256>
# Downloads the Amazon IVS Broadcast xcframework into ios/Frameworks and verifies its
# checksum. A no-op when the pinned build is already in place.
set -euo pipefail

URL="$1"
SHA="$2"
LIB_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$LIB_DIR/ios/Frameworks"
FRAMEWORK="$DEST/AmazonIVSBroadcast.xcframework"
STAMP="$DEST/.sha256"

if [[ -d "$FRAMEWORK" && -f "$STAMP" && "$(cat "$STAMP")" == "$SHA" ]]; then
  exit 0
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "[react-native-ivs-broadcast] Downloading $URL"
curl --fail --location --silent --show-error --retry 3 -o "$TMP/sdk.zip" "$URL"

ACTUAL="$(shasum -a 256 "$TMP/sdk.zip" | awk '{print $1}')"
if [[ "$ACTUAL" != "$SHA" ]]; then
  echo "[react-native-ivs-broadcast] Checksum mismatch: expected $SHA, got $ACTUAL" >&2
  exit 1
fi

unzip -q "$TMP/sdk.zip" -d "$TMP/out"
rm -rf "$DEST"
mkdir -p "$DEST"
mv "$TMP/out/AmazonIVSBroadcast.xcframework" "$FRAMEWORK"
echo "$SHA" > "$STAMP"
echo "[react-native-ivs-broadcast] Installed AmazonIVSBroadcast.xcframework"
