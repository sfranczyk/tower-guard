---
name: release
description: Promote the current master of Tower Guard to the production page (version tag v*), or roll production back. Use when the user asks to release, ship, publish to production, or roll back prod.
---

# Release (master → production page)

Production (`/` on GitHub Pages) is the latest `v*` tag; development (`/dev/`) is master. Pushing a tag redeploys
both (`.github/workflows/deploy-page.yml`). Never push a tag without the user asking for a release.

1. `git fetch origin master --tags` and check out master at `origin/master`, clean tree. Releasing anything else is a
   hotfix (step 6).
2. Last master deploy green: GitHub MCP `actions_list` for workflow `deploy-page.yml` on master. If the newest run
   failed, stop and report it. Locally: `npm run -s verify`.
3. Pick the version from the commits since the last tag (`git log $(git describe --tags --abbrev=0)..HEAD --oneline`;
   all of history if there is no tag yet, first release is `v1.0.0`): **patch** for fixes and tuning, **minor** for a new
   enemy, arrow, mode or other feature, **major** only if the user says so. Say which and why in the reply.
4. `npm version <patch|minor|major> -m "Release v%s"` (bumps `package.json`, commits, tags), then
   `git push origin master --follow-tags`. If master is protected or the session can only push its own branch, push
   the branch, merge it, then tag the merged master commit (`git tag -a vX.Y.Z -m "Release vX.Y.Z" <sha>`) and push
   the tag only.
5. Watch the tag's `deploy-page.yml` run. When it is green, `https://<owner>.github.io/<repo>/version.txt` names the
   tag. Reply with the version, the change list in one line each, and both page links.
6. **Hotfix** (master holds unreleasable work): branch from the tag, fix, verify, tag the next patch on that branch and
   push the tag; then land the same fix on master.
7. **Rollback**: tag the last good commit with a *new, higher* version (`git tag -a v1.4.1 -m "Rollback to v1.3.0"
   v1.3.0^{commit}`) and push the tag. Never delete or move a published tag; prod always follows the highest one.
