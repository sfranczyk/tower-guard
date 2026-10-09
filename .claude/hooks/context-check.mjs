// Warns (the user and Claude) when the session's context grows past a threshold, once per threshold.
// Context size = the last assistant turn's input tokens (fresh + cache read + cache write) from the transcript.
import { readFileSync, writeFileSync, openSync, readSync, fstatSync, closeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const LEVELS = [130_000, 180_000, 250_000];
const TAIL_BYTES = 512 * 1024;

const input = JSON.parse(readFileSync(0, 'utf8'));
const tokens = lastContextTokens(input.transcript_path);
const level = LEVELS.filter((l) => tokens >= l).length;
const stateFile = join(tmpdir(), `tower-guard-context-${input.session_id}`);
let warned = 0;
try { warned = Number(readFileSync(stateFile, 'utf8')) || 0; } catch {}
if (level === 0 || level <= warned) process.exit(0);
writeFileSync(stateFile, String(level));

const k = Math.round(tokens / 1000);
const userText = `Context is ~${k}k tokens: every turn now costs that much. Consider finishing this feature, committing and starting a fresh session.`;
const out = { systemMessage: userText };
if (input.hook_event_name === 'UserPromptSubmit') {
  out.hookSpecificOutput = {
    hookEventName: 'UserPromptSubmit',
    additionalContext: `The session context is ~${k}k tokens. At a natural break, remind the user, commit finished work and offer to clear the session (only after they agree).`,
  };
}
console.log(JSON.stringify(out));

function lastContextTokens(path) {
  if (!path) return 0;
  let text;
  try {
    const fd = openSync(path, 'r');
    const size = fstatSync(fd).size;
    const len = Math.min(size, TAIL_BYTES);
    const buf = Buffer.alloc(len);
    readSync(fd, buf, 0, len, size - len);
    closeSync(fd);
    text = buf.toString('utf8');
  } catch {
    return 0;
  }
  const lines = text.split('\n').reverse();
  for (const line of lines) {
    if (!line.includes('"usage"')) continue;
    try {
      const u = JSON.parse(line).message?.usage;
      if (u) return (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
    } catch {}
  }
  return 0;
}
