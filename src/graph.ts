/**
 * @module graph
 * Git graph traversal operations for libgit2
 */

import { getLibrary, type LibGit2 } from "./library.ts";
import { checkError } from "./error.ts";
import type { Pointer } from "./types.ts";
import {
  createPointerArray,
  oidFromHex,
  ptrOf,
  readPointerArrayValue,
} from "./utils.ts";

/**
 * Result of ahead/behind calculation
 */
export interface AheadBehindResult {
  /** Number of unique commits in local that are not in upstream */
  ahead: number;
  /** Number of unique commits in upstream that are not in local */
  behind: number;
}

/**
 * Count the number of unique commits between two commit objects.
 *
 * There is no need for branches containing the commits to have any
 * upstream relationship, but it helps to think of one as a branch and
 * the other as its upstream, the `ahead` and `behind` values will be
 * what git would report for the branches.
 *
 * @param lib - LibGit2 library instance
 * @param repoPtr - Repository pointer
 * @param localOid - The commit OID for local (hex string)
 * @param upstreamOid - The commit OID for upstream (hex string)
 * @returns Object with ahead and behind counts
 */
export function aheadBehind(
  lib: LibGit2,
  repoPtr: Pointer,
  localOid: string,
  upstreamOid: string,
): AheadBehindResult {
  // Create output buffers for ahead and behind counts
  const aheadBuf = createPointerArray(1);
  const behindBuf = createPointerArray(1);

  // Convert OIDs from hex strings
  const localOidBytes = oidFromHex(localOid);
  const upstreamOidBytes = oidFromHex(upstreamOid);

  const result = lib.symbols.git_graph_ahead_behind(
    ptrOf(aheadBuf),
    ptrOf(behindBuf),
    repoPtr,
    ptrOf(localOidBytes),
    ptrOf(upstreamOidBytes),
  );
  checkError(lib, result, "Failed to calculate ahead/behind");

  return {
    ahead: Number(readPointerArrayValue(aheadBuf, 0)),
    behind: Number(readPointerArrayValue(behindBuf, 0)),
  };
}

/**
 * Determine if a commit is the descendant of another commit.
 *
 * Note that a commit is NOT considered a descendant of itself, in contrast
 * to `git merge-base --is-ancestor`.
 *
 * @param lib - LibGit2 library instance
 * @param repoPtr - Repository pointer
 * @param commitOid - The commit OID to check (hex string)
 * @param ancestorOid - The potential ancestor commit OID (hex string)
 * @returns true if commit is a descendant of ancestor, false otherwise
 */
export function isDescendantOf(
  lib: LibGit2,
  repoPtr: Pointer,
  commitOid: string,
  ancestorOid: string,
): boolean {
  // Convert OIDs from hex strings
  const commitOidBytes = oidFromHex(commitOid);
  const ancestorOidBytes = oidFromHex(ancestorOid);

  const result = lib.symbols.git_graph_descendant_of(
    repoPtr,
    ptrOf(commitOidBytes),
    ptrOf(ancestorOidBytes),
  );

  // Returns 1 if descendant, 0 if not, negative on error
  if (result < 0) {
    checkError(lib, result, "Failed to check descendant relationship");
  }

  return result === 1;
}
