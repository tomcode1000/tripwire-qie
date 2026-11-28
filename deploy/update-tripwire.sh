#!/usr/bin/env bash
# Pull the latest Tripwire website. Static files: Caddy serves the new version immediately.
# Run on the server: bash /opt/tripwire/deploy/update-tripwire.sh
set -euo pipefail
git -C /opt/tripwire pull --ff-only
sudo chmod -R o+rX /opt/tripwire/web
echo "Updated to $(git -C /opt/tripwire log -1 --format='%h %s')"
