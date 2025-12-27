/**
 * @module apply
 * Git apply operations for libgit2
 */

import { getLibrary, type LibGit2 } from "./library.ts";
import { checkError } from "./error.ts";
import type { Pointer } from "./types.ts";
import {
  createOutPointer,
  readPointer,
  ptrOf,
} from "./utils.ts";
import { type Diff } from "./diff.ts";
import { Index } from "./index.ts";

/**
 * Apply location - where to apply the diff
 */
export enum ApplyLocation {
  /** Apply to the working directory */
  WORKDIR = 0,
  /** Apply to the index */
  INDEX = 1,
  /** Apply to both the working directory and index */
  BOTH = 2,
}

/**
 * Apply a diff to the repository
 * 
 * @param lib - LibGit2 library instance
 * @param repoPtr - Repository pointer
 * @param diff - Diff to apply
 * @param location - Where to apply the diff
 */
export function apply(
  lib: LibGit2,
  repoPtr: Pointer,
  diff: Diff,
  location: ApplyLocation
): void {
  const result = lib.symbols.git_apply(
    repoPtr,
    diff.ptr,
    location,
    null // options (use defaults)
  );

  checkError(lib, result, "Failed to apply diff");
}

/**
 * Apply a diff to a tree, producing an index
 * 
 * @param lib - LibGit2 library instance
 * @param repoPtr - Repository pointer
 * @param treePtr - Tree pointer to apply diff to
 * @param diff - Diff to apply
 * @returns Index with the applied changes
 */
export function applyToTree(
  lib: LibGit2,
  repoPtr: Pointer,
  treePtr: Pointer,
  diff: Diff
): Index {
  const outPtr = createOutPointer();

  const result = lib.symbols.git_apply_to_tree(
    ptrOf(outPtr),
    repoPtr,
    treePtr,
    diff.ptr,
    null // options (use defaults)
  );

  checkError(lib, result, "Failed to apply diff to tree");

  return new Index(readPointer(outPtr), lib);
}
