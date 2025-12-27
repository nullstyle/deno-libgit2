/**
 * @module pathspec
 * Git pathspec pattern matching operations
 */

import type { LibGit2 } from "./library.ts";
import { getLibrary } from "./library.ts";
import type { Pointer } from "./types.ts";
import {
  createOutPointer,
  createStrarray,
  fromCString,
  oidFromHex,
  ptrOf,
  readPointer,
  toCString,
} from "./utils.ts";
import { checkError } from "./error.ts";

/**
 * Flags controlling how pathspec match should be executed
 */
export enum GitPathspecFlags {
  /** Default behavior */
  DEFAULT = 0,
  /** Force case-insensitive match */
  IGNORE_CASE = 1 << 0,
  /** Force case-sensitive match */
  USE_CASE = 1 << 1,
  /** Disable glob patterns, use simple string comparison */
  NO_GLOB = 1 << 2,
  /** Return GIT_ENOTFOUND if no matches */
  NO_MATCH_ERROR = 1 << 3,
  /** Track which patterns had no matches */
  FIND_FAILURES = 1 << 4,
  /** Don't keep matching filenames, just test for matches */
  FAILURES_ONLY = 1 << 5,
}

/**
 * List of filenames matching a pathspec
 */
export class PathspecMatchList {
  private _ptr: Pointer;
  private _lib: LibGit2;
  private _closed = false;

  constructor(ptr: Pointer, lib: LibGit2) {
    this._ptr = ptr;
    this._lib = lib;
  }

  /** Get the raw pointer */
  get ptr(): Pointer {
    return this._ptr;
  }

  /**
   * Get the number of items in the match list
   */
  get entryCount(): number {
    this.ensureOpen();
    return Number(
      this._lib.symbols.git_pathspec_match_list_entrycount(this._ptr),
    );
  }

  /**
   * Get a matching filename by position
   * @param pos - Index into the list
   * @returns The filename of the match, or null if out of range
   */
  entry(pos: number): string | null {
    this.ensureOpen();
    const ptr = this._lib.symbols.git_pathspec_match_list_entry(
      this._ptr,
      BigInt(pos),
    ) as Pointer;
    if (!ptr) return null;
    return fromCString(ptr);
  }

  /**
   * Get all matching entries as an array
   */
  entries(): string[] {
    const result: string[] = [];
    for (let i = 0; i < this.entryCount; i++) {
      const entry = this.entry(i);
      if (entry) result.push(entry);
    }
    return result;
  }

  /**
   * Get the number of pathspec items that did not match
   * This will be zero unless FIND_FAILURES flag was used
   */
  get failedEntryCount(): number {
    this.ensureOpen();
    return Number(
      this._lib.symbols.git_pathspec_match_list_failed_entrycount(this._ptr),
    );
  }

  /**
   * Get an original pathspec string that had no matches
   * @param pos - Index into the failed items
   * @returns The pathspec pattern that didn't match, or null if out of range
   */
  failedEntry(pos: number): string | null {
    this.ensureOpen();
    const ptr = this._lib.symbols.git_pathspec_match_list_failed_entry(
      this._ptr,
      BigInt(pos),
    ) as Pointer;
    if (!ptr) return null;
    return fromCString(ptr);
  }

  /**
   * Get all failed entries as an array
   */
  failedEntries(): string[] {
    const result: string[] = [];
    for (let i = 0; i < this.failedEntryCount; i++) {
      const entry = this.failedEntry(i);
      if (entry) result.push(entry);
    }
    return result;
  }

  private ensureOpen(): void {
    if (this._closed) {
      throw new Error("PathspecMatchList has been freed");
    }
  }

  /**
   * Free the match list
   */
  free(): void {
    if (!this._closed) {
      this._lib.symbols.git_pathspec_match_list_free(this._ptr);
      this._closed = true;
    }
  }

  [Symbol.dispose](): void {
    this.free();
  }
}

/**
 * Compiled pathspec for pattern matching
 */
export class Pathspec {
  private _ptr: Pointer;
  private _lib: LibGit2;
  private _closed = false;

  constructor(ptr: Pointer, lib: LibGit2) {
    this._ptr = ptr;
    this._lib = lib;
  }

  /** Get the raw pointer */
  get ptr(): Pointer {
    return this._ptr;
  }

  /**
   * Test if a path matches this pathspec
   * @param path - The path to test
   * @param flags - Optional flags to control matching
   * @returns true if the path matches, false otherwise
   */
  matchesPath(
    path: string,
    flags: GitPathspecFlags = GitPathspecFlags.DEFAULT,
  ): boolean {
    this.ensureOpen();
    const pathStr = toCString(path);
    const result = this._lib.symbols.git_pathspec_matches_path(
      this._ptr,
      flags,
      ptrOf(pathStr),
    ) as number;
    return result === 1;
  }

  /**
   * Match this pathspec against the working directory
   * @param repo - The repository (must have a working directory)
   * @param flags - Optional flags to control matching
   * @returns A PathspecMatchList with the results
   */
  matchWorkdir(
    repo: { ptr: Pointer },
    flags: GitPathspecFlags = GitPathspecFlags.DEFAULT,
  ): PathspecMatchList {
    this.ensureOpen();
    const outBuf = createOutPointer();
    const result = this._lib.symbols.git_pathspec_match_workdir(
      ptrOf(outBuf),
      repo.ptr,
      flags,
      this._ptr,
    ) as number;
    checkError(this._lib, result, "Failed to match pathspec against workdir");
    return new PathspecMatchList(
      readPointer(outBuf),
      this._lib,
    );
  }

  /**
   * Match this pathspec against an index
   * @param index - The index to match against
   * @param flags - Optional flags to control matching
   * @returns A PathspecMatchList with the results
   */
  matchIndex(
    index: { ptr: Pointer },
    flags: GitPathspecFlags = GitPathspecFlags.DEFAULT,
  ): PathspecMatchList {
    this.ensureOpen();
    const outBuf = createOutPointer();
    const result = this._lib.symbols.git_pathspec_match_index(
      ptrOf(outBuf),
      index.ptr,
      flags,
      this._ptr,
    ) as number;
    checkError(this._lib, result, "Failed to match pathspec against index");
    return new PathspecMatchList(
      readPointer(outBuf),
      this._lib,
    );
  }

  /**
   * Match this pathspec against a tree
   * @param repo - The repository
   * @param treeOid - The OID of the tree to match against
   * @param flags - Optional flags to control matching
   * @returns A PathspecMatchList with the results
   */
  matchTree(
    repo: { ptr: Pointer },
    treeOid: string,
    flags: GitPathspecFlags = GitPathspecFlags.DEFAULT,
  ): PathspecMatchList {
    this.ensureOpen();

    // First, lookup the tree
    const treeOutBuf = createOutPointer();
    const oidBytes = oidFromHex(treeOid);

    // Get the commit first
    const commitOutBuf = createOutPointer();
    let commitResult = this._lib.symbols.git_commit_lookup(
      ptrOf(commitOutBuf),
      repo.ptr,
      ptrOf(oidBytes),
    ) as number;
    checkError(this._lib, commitResult, "Failed to lookup commit");
    const commitPtr = readPointer(commitOutBuf);

    // Get the tree from the commit
    const treeResult = this._lib.symbols.git_commit_tree(
      ptrOf(treeOutBuf),
      commitPtr,
    ) as number;
    checkError(this._lib, treeResult, "Failed to get commit tree");
    const treePtr = readPointer(treeOutBuf);

    // Free the commit
    this._lib.symbols.git_commit_free(commitPtr);

    // Match against the tree
    const outBuf = createOutPointer();
    const result = this._lib.symbols.git_pathspec_match_tree(
      ptrOf(outBuf),
      treePtr,
      flags,
      this._ptr,
    ) as number;

    // Free the tree
    this._lib.symbols.git_tree_free(treePtr);

    checkError(this._lib, result, "Failed to match pathspec against tree");
    return new PathspecMatchList(
      readPointer(outBuf),
      this._lib,
    );
  }

  /**
   * Match this pathspec against a diff
   * @param diff - The diff to match against
   * @param flags - Optional flags to control matching
   * @returns A PathspecMatchList with the results
   */
  matchDiff(
    diff: { ptr: Pointer },
    flags: GitPathspecFlags = GitPathspecFlags.DEFAULT,
  ): PathspecMatchList {
    this.ensureOpen();
    const outBuf = createOutPointer();
    const result = this._lib.symbols.git_pathspec_match_diff(
      ptrOf(outBuf),
      diff.ptr,
      flags,
      this._ptr,
    ) as number;
    checkError(this._lib, result, "Failed to match pathspec against diff");
    return new PathspecMatchList(
      readPointer(outBuf),
      this._lib,
    );
  }

  private ensureOpen(): void {
    if (this._closed) {
      throw new Error("Pathspec has been freed");
    }
  }

  /**
   * Free the pathspec
   */
  free(): void {
    if (!this._closed) {
      this._lib.symbols.git_pathspec_free(this._ptr);
      this._closed = true;
    }
  }

  [Symbol.dispose](): void {
    this.free();
  }
}

/**
 * Create a new pathspec from an array of patterns
 * @param lib - LibGit2 instance
 * @param patterns - Array of pathspec patterns
 * @returns A compiled Pathspec object
 */
export function createPathspec(lib: LibGit2, patterns: string[]): Pathspec {
  // Use the createStrarray helper
  const strarray = createStrarray(patterns);

  const outBuf = createOutPointer();
  const result = lib.symbols.git_pathspec_new(
    ptrOf(outBuf),
    ptrOf(strarray.buffer),
  ) as number;

  checkError(lib, result, "Failed to create pathspec");

  return new Pathspec(readPointer(outBuf), lib);
}
