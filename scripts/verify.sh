#!/bin/sh
# Type-check, test and check file lengths, printing only errors, failures and warnings (one line when all is well).
out=$(npx tsc --noEmit --pretty false 2>&1) || { echo "$out" | head -40; echo "TYPE CHECK FAILED"; exit 1; }
out=$(npx vitest run --reporter=dot --silent 2>&1) || { echo "$out" | grep -v '^[·x*-]*$' | head -80; echo "TESTS FAILED"; exit 1; }
tests=$(echo "$out" | grep -E 'Tests +[0-9]' | sed 's/^ *//')
# Source files: at most 480 lines (split by responsibility past that), ideally 400 (CLAUDE.md, Conventions).
lengths=$(find src -name '*.ts' ! -name '*.test.ts' -exec wc -l {} + | grep -v ' total$')
long=$(echo "$lengths" | awk '$1 > 480 { print "  " $2 ": " $1 " lines" }')
[ -n "$long" ] && { echo "$long"; echo "FILES OVER 480 LINES"; exit 1; }
near=$(echo "$lengths" | awk '$1 > 400 { n++ } END { print n + 0 }')
[ "$near" -gt 0 ] && tests="$tests · $near files over 400 lines"
echo "OK: $tests"
