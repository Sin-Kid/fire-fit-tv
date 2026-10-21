#!/usr/bin/env bash
# Rebuilds apps/FireFitVega/src/fitcoach from apps/FireFitTV/src (the main app),
# applying the two Vega differences:
#   1. react-native-svg is imported as @amazon-devices/react-native-svg
#   2. no text-to-speech on Vega: speech.ts is a no-op, so the player captions coaching lines
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
src="$here/../FireFitTV/src"
dst="$here/src/fitcoach"
keep_speech="$(mktemp)"; cp "$dst/lib/speech.ts" "$keep_speech"
keep_types="$(mktemp -d)"; cp -r "$dst/types" "$keep_types/"
rm -rf "$dst" && mkdir -p "$dst" && cp -R "$src/." "$dst/"
cp "$keep_speech" "$dst/lib/speech.ts"
cp -r "$keep_types/types" "$dst/"
grep -rl "from 'react-native-svg'" "$dst" | while read -r f; do
  sed -i.bak "s#from 'react-native-svg'#from '@amazon-devices/react-native-svg'#" "$f" && rm -f "$f.bak"
done
echo "Synced FireFitTV/src -> FireFitVega/src/fitcoach"
