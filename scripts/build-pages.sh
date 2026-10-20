#!/bin/sh
# Builds the GitHub Pages site: production (latest v* tag) at the root, development (master) under /dev/.
# Usage: sh scripts/build-pages.sh [out-dir]   (default: site). Needs full history and tags (fetch-depth: 0).
# Before the first release tag the root serves master too, so the public URL never goes blank.
set -eu
out=${1:-site}
dev_ref=${DEV_REF:-origin/master}
git rev-parse -q --verify "$dev_ref^{commit}" >/dev/null || dev_ref=HEAD
prod_ref=${PROD_REF:-$(git tag -l 'v*' --sort=-v:refname | head -n1)}
prod_ref=${prod_ref:-$dev_ref}
work=${RUNNER_TEMP:-${TMPDIR:-/tmp}}/tower-guard-pages
rm -rf "$out" "$work"
mkdir -p "$out" "$work"

# build <ref> <dir under $out>
build() {
  sha=$(git rev-parse "$1^{commit}")
  src="$work/$sha"
  if [ ! -d "$src" ]; then
    git worktree add --detach "$src" "$sha" >/dev/null
    (cd "$src" && npm ci --no-audit --no-fund --loglevel=error && npm run -s build)
  fi
  mkdir -p "$out/$2"
  cp -R "$src/dist/." "$out/$2"
  printf '%s %s\n' "$1" "$sha" > "$out/$2/version.txt"
  echo "built $1 ($sha) -> /$2"
}

build "$prod_ref" ""
build "$dev_ref" "dev"
for dir in "$work"/*; do git worktree remove --force "$dir"; done
