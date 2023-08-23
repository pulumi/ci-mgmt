#!/usr/bin/env bash

set -euo pipefail

PROVIDER_DIR="$1"
if command -v shellcheck >/dev/null 2>&1; then
  if ! find "$PROVIDER_DIR" -type f -name '*.sh' -exec false {} + >/dev/null 2>&1; then
    echo "Running shellcheck on $PROVIDER_DIR/**/*.sh"
    shellcheck -s bash "$(find "$PROVIDER_DIR" -type f -name '*.sh')"
  fi
  if [ -f "$PROVIDER_DIR"/Makefile ]; then
    echo "Running shellcheck on $PROVIDER_DIR/Makefile"
    # We unset Make related variables so that we can check the Makefile's dry-run output without
    # Make thinking it's running recursively.
    (
      unset MAKELEVEL MAKEFLAGS MFLAGS
      make -f "$PROVIDER_DIR"/Makefile -n | shellcheck -s bash -
    )
  fi
else
  echo "shellcheck is not installed. Skipping shell script linting."
  echo "Follow instructions here to install: https://github.com/koalaman/shellcheck#installing"
fi
