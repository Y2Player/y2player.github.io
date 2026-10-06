#!/usr/bin/env bash
# Publica o y2player.com na Cloudflare a partir do último commit, numa cópia limpa.
# Assim só vai pro ar o que está no repositório: as páginas internas e o material
# que ficam só no computador (refs, áudios, decupagem) nunca entram no build.
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
tmp="$(mktemp -d)"
trap 'git -C "$root" worktree remove --force "$tmp" >/dev/null 2>&1 || true' EXIT

git -C "$root" worktree add --detach "$tmp" HEAD >/dev/null
cd "$tmp"
npm ci --silent
npm run build
npx wrangler deploy
