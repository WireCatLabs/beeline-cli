#!/usr/bin/env bash
# The built CLI beside the latest published CLI of every parity group, each run in an empty home with D-Bus off;
# fails only on a new finding that names this CLI.
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"
command=$(node --input-type=module -e "import('$root/dist/identity.js').then((m) => console.log(m.IDENTITY.command))")
exec "$root/node_modules/.bin/cli-dev" audit --cli "dist/bin/$command.js" --family
