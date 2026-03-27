#!/bin/sh
set -e

# If we mounted a host volume that doesn't have node_modules, install them
if [ ! -d "node_modules" ] || [ -z "$(ls -A node_modules)" ]; then
  echo "node_modules not found. Running yarn install..."
  yarn install
  yarn workspace @affine/server postinstall
fi

exec "$@"
