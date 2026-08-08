#!/bin/sh
# Boots a space's persistent /data volume and hands off to marimo. Runs on
# every container start (including "Update"), so the seeding steps below
# must stay idempotent -- they must not clobber a notebook or database the
# user has already been working in.
set -eu

DATA_DIR=/data
mkdir -p "$DATA_DIR"

if [ -z "${MARIMO_TOKEN:-}" ]; then
  echo "MARIMO_TOKEN is required" >&2
  exit 1
fi

# Only seeded once per space: later starts leave a notebook the user has
# edited alone.
if [ ! -f "$DATA_DIR/notebook.py" ]; then
  cp /opt/pacuare/default_notebook.py "$DATA_DIR/notebook.py"
fi

# Rebuilt whenever the data doesn't exist yet, or the app explicitly dropped
# a fresh pacuare_raw.csv + `.reseed` marker on the volume (the "Reset"
# action) -- a plain container restart (e.g. "Update") does neither, so it
# leaves the existing database alone.
if [ ! -f "$DATA_DIR/pacuare.db" ] || [ -f "$DATA_DIR/.reseed" ]; then
  python3 /opt/pacuare/bootstrap.py
  rm -f "$DATA_DIR/.reseed"
fi

exec marimo edit --host 0.0.0.0 -p 8080 --token-password "$MARIMO_TOKEN" "$DATA_DIR/notebook.py"
