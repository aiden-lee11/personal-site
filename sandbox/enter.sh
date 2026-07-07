#!/usr/bin/env bash
# One-liner to build (if needed) and drop into the sandbox shell.
# Usage:  ./sandbox/enter.sh
set -euo pipefail
cd "$(dirname "$0")"
docker compose build
exec docker compose run --rm --service-ports claude
