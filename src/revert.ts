/**
 * @module revert
 * Git revert operations for libgit2
 */

import type { LibGit2 } from "./library.ts";
import { checkError } from "./error.ts";
import type { Pointer } from "./types.ts";
import { createOutPointer, ptrOf, readPointer } from "./utils.ts";
import { Index } from "./index.ts";

/**
 * Revert options
 */
export interface RevertOptions {
  /** For merge commits, the parent to use as mainline (1-based index) */
  mainline?: number;
}

/**
 * Revert a commit against another commit, producing an index
 *
 * @param lib - LibGit2 library instance
 * @param repoPtr - Repository pointer
 * @param revertCommitPtr - Commit to revert
 * @param ourCommitPtr - Commit to revert against (e.g., HEAD)
 * @param mainline - Parent index for merge commits (0 for non-merge)
 * @returns Index containing the revert result
 */
export function revertCommit(
  lib: LibGit2,
  repoPtr: Pointer,
  revertCommitPtr: Pointer,
  ourCommitPtr: Pointer,
  mainline: number = 0,
): Index {
  const outPtr = createOutPointer();

  const result = lib.symbols.git_revert_commit(
    ptrOf(outPtr),
    repoPtr,
    revertCommitPtr,
    ourCommitPtr,
    mainline,
    null, // merge_options (use defaults)
  );

  checkError(lib, result, "Failed to revert commit");

  return new Index(readPointer(outPtr), lib);
}

/**
 * Revert a commit, modifying the index and working directory
 *
 * @param lib - LibGit2 library instance
 * @param repoPtr - Repository pointer
 * @param commitPtr - Commit to revert
 */
export function revert(
  lib: LibGit2,
  repoPtr: Pointer,
  commitPtr: Pointer,
): void {
  const result = lib.symbols.git_revert(
    repoPtr,
    commitPtr,
    null, // revert_options (use defaults)
  );

  checkError(lib, result, "Failed to revert");
}
