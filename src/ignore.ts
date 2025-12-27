/**
 * @module ignore
 * Git ignore rule operations
 */

import type { LibGit2 } from "./library.ts";
import type { Pointer } from "./types.ts";
import { ptrOf, toCString } from "./utils.ts";
import { checkError } from "./error.ts";

/**
 * Add ignore rules for a repository.
 *
 * Rules added via this function are in-memory only and will not persist.
 * They are applied in addition to rules from .gitignore files.
 *
 * @param lib - LibGit2 instance
 * @param repoPtr - Repository pointer
 * @param rules - Text of rules, a la .gitignore file contents.
 *                Multiple rules should be separated by newlines.
 *
 * @example
 * ```typescript
 * // Add multiple rules
 * addIgnoreRule(lib, repoPtr, "*.log\nbuild/\n*.tmp\n");
 * ```
 */
export function addIgnoreRule(
  lib: LibGit2,
  repoPtr: Pointer,
  rules: string,
): void {
  const rulesStr = toCString(rules);
  const result = lib.symbols.git_ignore_add_rule(
    repoPtr,
    ptrOf(rulesStr),
  ) as number;
  checkError(lib, result, "Failed to add ignore rule");
}

/**
 * Clear ignore rules that were explicitly added via addIgnoreRule.
 *
 * Resets to the default internal ignore rules (".", "..", ".git").
 * This does NOT affect rules in actual .gitignore files.
 *
 * @param lib - LibGit2 instance
 * @param repoPtr - Repository pointer
 */
export function clearIgnoreRules(lib: LibGit2, repoPtr: Pointer): void {
  const result = lib.symbols.git_ignore_clear_internal_rules(repoPtr) as number;
  checkError(lib, result, "Failed to clear ignore rules");
}

/**
 * Test if the ignore rules apply to a given path.
 *
 * This function checks the ignore rules to see if they would apply to the
 * given file. This indicates if the file would be ignored regardless of
 * whether the file is already in the index or committed to the repository.
 *
 * Equivalent to `git check-ignore --no-index`.
 *
 * @param lib - LibGit2 instance
 * @param repoPtr - Repository pointer
 * @param path - File path to check, relative to the repo's workdir
 * @returns true if the path is ignored, false otherwise
 *
 * @example
 * ```typescript
 * const ignored = pathIsIgnored(lib, repoPtr, "build/output.js");
 * if (ignored) {
 *   console.log("File is ignored");
 * }
 * ```
 */
export function pathIsIgnored(
  lib: LibGit2,
  repoPtr: Pointer,
  path: string,
): boolean {
  const pathStr = toCString(path);
  const ignoredOut = new Int32Array(1);

  const result = lib.symbols.git_ignore_path_is_ignored(
    Deno.UnsafePointer.of(ignoredOut),
    repoPtr,
    ptrOf(pathStr),
  ) as number;

  checkError(lib, result, `Failed to check if path is ignored: ${path}`);

  return ignoredOut[0] !== 0;
}
