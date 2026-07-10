#!/bin/bash

# Sync script to push code changes to production, ignoring local dev files
# and — critically — never touching the remote's data/ (live production
# database) or .env (real secrets, managed on the server directly).
rsync -avz \
  --exclude='.git' \
  --exclude='docker-compose.local*.yml' \
  --exclude='data' \
  --exclude='logs' \
  --exclude='.env' \
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

ssh chris@theonewhocentres "cd ~/repos/researchiq-gova && docker compose up -d --build"
