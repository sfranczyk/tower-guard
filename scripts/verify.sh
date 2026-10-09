#!/bin/sh
# Type-check and test, printing only errors and failures (one line when all is well).
out=$(npx tsc --noEmit --pretty false 2>&1) || { echo "$out" | head -40; echo "TYPE CHECK FAILED"; exit 1; }
out=$(npx vitest run --reporter=dot --silent 2>&1) || { echo "$out" | grep -v '^[·x*-]*$' | head -80; echo "TESTS FAILED"; exit 1; }
echo "$out" | grep -E 'Tests +[0-9]' | sed 's/^ */OK: /'
