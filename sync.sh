#!/bin/bash

# Sync script to push code + production .env to the server, ignoring
# local dev files. Critically never touches the remote's data/ (live
# production database) -- .env IS synced (it's the canonical production
# config now; edit it here, not on the server, or the next sync will
# revert a server-side hand-edit).
rsync -avz \
  --exclude='.git' \
  --exclude='docker-compose.local*.yml' \
  --exclude='data' \
  --exclude='logs' \
  --exclude='.env.local' \
  --exclude='.mcp.json' \
  --exclude='.worktrees' \
  --exclude='.security' \
  --exclude='docs' \
  --exclude='.claude/settings.local.json' \
  --exclude='src/app/static/css/style.css' \
  --exclude='src/builder/builder' \
  --exclude='.gemini/settings.json' \
  --exclude='.superpowers' \
  . chris@theonewhocentres:~/repos/researchiq-gova

ssh chris@theonewhocentres "chmod 600 ~/repos/researchiq-gova/.env && cd ~/repos/researchiq-gova && docker compose up -d --build"

# Cloudflare caches static assets (JS/CSS) at the edge for 4h regardless of
# origin changes, so without this, deployed UI changes can take up to 4h to
# actually reach users. Purge on every sync so changes go live immediately.
set -a
source .env
set +a
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache" \
  -H "Authorization: Bearer ${CF_CACHE_PURGE_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}' | grep -q '"success":true' \
  && echo "Cloudflare cache purged." \
  || echo "WARNING: Cloudflare cache purge failed."
