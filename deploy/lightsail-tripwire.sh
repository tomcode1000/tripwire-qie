#!/usr/bin/env bash
# Adds the Tripwire website to the existing Lightsail server (the one already running Detour and
# Tacitum behind Caddy). Run on the server (Lightsail "Connect using SSH"):
#   curl -fsSL https://raw.githubusercontent.com/tomcode1000/tripwire-qie/main/deploy/lightsail-tripwire.sh | bash
#
# What it does, without touching the other sites:
#   - clones github.com/tomcode1000/tripwire-qie to /opt/tripwire (or pulls if it is already there)
#   - the site is static (web/), so Caddy serves the files directly: no Node service to run
#   - APPENDS one site to the Caddyfile (HTTPS via Let's Encrypt), validates it, reloads Caddy,
#     and restores the previous Caddyfile if validation fails
set -euo pipefail

APP=/opt/tripwire
IP_DASHED="$(curl -fsS https://checkip.amazonaws.com | tr -d '\n' | tr . -)"
SITE="${TRIPWIRE_SITE:-tripwire.${IP_DASHED}.sslip.io}"
echo "site: https://$SITE"

command -v caddy >/dev/null || { echo "Caddy is not installed on this server."; exit 1; }
command -v git >/dev/null || sudo apt-get install -y git

if [ ! -d "$APP/.git" ]; then
  sudo git clone --depth 1 https://github.com/tomcode1000/tripwire-qie.git "$APP"
  sudo chown -R "$USER":"$USER" "$APP"
else
  git -C "$APP" pull --ff-only
fi
# Caddy runs as its own user; it only needs to read the web folder.
sudo chmod -R o+rX "$APP/web"
sudo chmod o+x /opt "$APP"

CF=/etc/caddy/Caddyfile
if ! grep -q "$SITE" "$CF"; then
  BACKUP="$CF.bak-tripwire-$(date +%s)"
  sudo cp "$CF" "$BACKUP"
  sudo tee -a "$CF" >/dev/null <<CADDY

# --- Tripwire (added by deploy/lightsail-tripwire.sh) ---
$SITE {
  root * $APP/web
  encode gzip
  file_server
  @assets path /assets/* /img/*
  header @assets Cache-Control "public, max-age=3600"
  header /data.json Cache-Control "no-cache"
  header {
    X-Content-Type-Options nosniff
    Referrer-Policy strict-origin-when-cross-origin
    X-Frame-Options SAMEORIGIN
  }
}
CADDY
  if ! sudo caddy validate --config "$CF" --adapter caddyfile; then
    echo "Caddyfile did not validate; restoring the previous one."
    sudo cp "$BACKUP" "$CF"
    exit 1
  fi
fi
sudo systemctl reload caddy

echo
echo "Done. Tripwire is at https://$SITE"
echo "Update later with: bash $APP/deploy/update-tripwire.sh"
