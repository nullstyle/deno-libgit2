/**
 * @module cherrypick
 * Git cherry-pick operations for libgit2
 */

import { getLibrary, type LibGit2 } from "./library.ts";
import { checkError } from "./error.ts";
import type { Pointer } from "./types.ts";
import {
  toCString,
  createOutPointer,
  readPointer,
  ptrOf,
} from "./utils.ts";
import { Index } from "./index.ts";

/**
 * Cherry-pick options
 */
export interface CherrypickOptions {
  /** For merge commits, the parent to use as mainline (1-based index) */
  mainline?: number;
}

/**
 * Cherry-pick a commit against another commit, producing an index
 * 
 * @param lib - LibGit2 library instance
 * @param repoPtr - Repository pointer
 * @param cherrypickCommitPtr - Commit to cherry-pick
 * @param ourCommitPtr - Commit to cherry-pick against (e.g., HEAD)
 * @param mainline - Parent index for merge commits (0 for non-merge)
 * @returns Index containing the cherry-pick result
 */
export function cherrypickCommit(
  lib: LibGit2,
  repoPtr: Pointer,
  cherrypickCommitPtr: Pointer,
  ourCommitPtr: Pointer,
  mainline: number = 0
): Index {
  const outPtr = createOutPointer();

  const result = lib.symbols.git_cherrypick_commit(
    ptrOf(outPtr),
    repoPtr,
    cherrypickCommitPtr,
    ourCommitPtr,
    mainline,
    null // merge_options (use defaults)
  );

  checkError(lib, result, "Failed to cherry-pick commit");

  return new Index(readPointer(outPtr), lib);
}

/**
 * Cherry-pick a commit, modifying the index and working directory
 * 
 * @param lib - LibGit2 library instance
 * @param repoPtr - Repository pointer
 * @param commitPtr - Commit to cherry-pick
 */
export function cherrypick(
  lib: LibGit2,
  repoPtr: Pointer,
  commitPtr: Pointer
): void {
  const result = lib.symbols.git_cherrypick(
    repoPtr,
    commitPtr,
    null // cherrypick_options (use defaults)
  );

  checkError(lib, result, "Failed to cherry-pick");
}
