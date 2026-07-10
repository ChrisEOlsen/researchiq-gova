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
