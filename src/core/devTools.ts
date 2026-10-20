/**
 * Developer tools (labs, `?tune`, `?debug`, `?coop`, `?net=local`, the menu's "Dev tools" row) exist in local and
 * `/dev/` builds only. The production page is built with `npm run build:release` (webpack `--env release`), which
 * defines `__DEV_TOOLS__` as false; tests and every other build see true.
 */
declare const __DEV_TOOLS__: boolean | undefined;

export const DEV_TOOLS: boolean = typeof __DEV_TOOLS__ === 'undefined' ? true : __DEV_TOOLS__;
