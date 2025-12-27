/**
 * @module worktree
 * Git worktree operations for libgit2
 */

import { getLibrary, type LibGit2 } from "./library.ts";
import { checkError } from "./error.ts";
import type { Pointer } from "./types.ts";
import {
  createGitBuf,
  createOutPointer,
  fromCString,
  POINTER_SIZE,
  ptrOf,
  readGitBuf,
  readPointer,
  readStrarray,
  toCString,
} from "./utils.ts";

/**
 * Worktree prune flags
 */
export enum WorktreePruneFlags {
  /** Prune working tree even if working tree is valid */
  VALID = 1 << 0,
  /** Prune working tree even if it is locked */
  LOCKED = 1 << 1,
  /** Prune checked out working tree */
  WORKING_TREE = 1 << 2,
}

/**
 * Lock information for a worktree
 */
export interface WorktreeLockInfo {
  locked: boolean;
  reason: string | null;
}

/**
 * Worktree add options
 */
export interface WorktreeAddOptions {
  /** Lock newly created worktree */
  lock?: boolean;
  /** Allow checkout of an existing branch matching the worktree name */
  checkoutExisting?: boolean;
}

function alignOffset(value: number, alignment: number): number {
  const remainder = value % alignment;
  return remainder === 0 ? value : value + (alignment - remainder);
}

function addField(offset: number, size: number, alignment: number): number {
  return alignOffset(offset, alignment) + size;
}

const CHECKOUT_OPTIONS_SIZE = (() => {
  let offset = 0;
  offset = addField(offset, 4, 4); // version
  offset = addField(offset, 4, 4); // checkout_strategy
  offset = addField(offset, 4, 4); // disable_filters
  offset = addField(offset, 4, 4); // dir_mode
  offset = addField(offset, 4, 4); // file_mode
  offset = addField(offset, 4, 4); // file_open_flags
  offset = addField(offset, 4, 4); // notify_flags
  offset = addField(offset, POINTER_SIZE, POINTER_SIZE); // notify_cb
  offset = addField(offset, POINTER_SIZE, POINTER_SIZE); // notify_payload
  offset = addField(offset, POINTER_SIZE, POINTER_SIZE); // progress_cb
  offset = addField(offset, POINTER_SIZE, POINTER_SIZE); // progress_payload
  offset = addField(offset, POINTER_SIZE, POINTER_SIZE); // paths.strings
  offset = addField(offset, POINTER_SIZE, POINTER_SIZE); // paths.count
  for (let i = 0; i < 8; i++) {
    offset = addField(offset, POINTER_SIZE, POINTER_SIZE);
  }
  return alignOffset(offset, POINTER_SIZE);
})();

const WORKTREE_ADD_LOCK_OFFSET = 4;
const WORKTREE_ADD_CHECKOUT_EXISTING_OFFSET = 8;
const WORKTREE_ADD_REF_OFFSET = alignOffset(12, POINTER_SIZE);
const WORKTREE_ADD_CHECKOUT_OPTIONS_OFFSET = alignOffset(
  WORKTREE_ADD_REF_OFFSET + POINTER_SIZE,
  POINTER_SIZE,
);
const WORKTREE_ADD_OPTIONS_SIZE = alignOffset(
  WORKTREE_ADD_CHECKOUT_OPTIONS_OFFSET + CHECKOUT_OPTIONS_SIZE,
  POINTER_SIZE,
);

/**
 * Worktree prune options
 */
export interface WorktreePruneOptions {
  /** Prune flags */
  flags?: WorktreePruneFlags;
}

/**
 * Represents a Git worktree
 */
export class Worktree {
  private _ptr: Pointer;
  private _lib: LibGit2;
  private _freed = false;

  constructor(ptr: Pointer, lib?: LibGit2) {
    this._ptr = ptr;
    this._lib = lib ?? getLibrary();
  }

  /**
   * Get the raw pointer
   */
  get ptr(): Pointer {
    return this._ptr;
  }

  /**
   * Get the worktree name
   */
  get name(): string {
    this.ensureNotFreed();
    const namePtr = this._lib.symbols.git_worktree_name(this._ptr);
    return fromCString(namePtr) ?? "";
  }

  /**
   * Get the worktree path
   */
  get path(): string {
    this.ensureNotFreed();
    const pathPtr = this._lib.symbols.git_worktree_path(this._ptr);
    return fromCString(pathPtr) ?? "";
  }

  /**
   * Validate the worktree
   * @returns true if valid, false otherwise
   */
  validate(): boolean {
    this.ensureNotFreed();
    const result = this._lib.symbols.git_worktree_validate(this._ptr);
    return result === 0;
  }

  /**
   * Lock the worktree
   * @param reason - Optional reason for locking
   */
  lock(reason?: string): void {
    this.ensureNotFreed();
    const reasonBytes = reason ? toCString(reason) : null;
    const reasonPtr = reasonBytes ? ptrOf(reasonBytes) : null;
    const result = this._lib.symbols.git_worktree_lock(this._ptr, reasonPtr);
    checkError(this._lib, result, "Failed to lock worktree");
  }

  /**
   * Unlock the worktree
   */
  unlock(): void {
    this.ensureNotFreed();
    const result = this._lib.symbols.git_worktree_unlock(this._ptr);
    // Result of 1 means it was not locked, which is fine
    if (result < 0) {
      checkError(this._lib, result, "Failed to unlock worktree");
    }
  }

  /**
   * Check if the worktree is locked
   * @returns Lock information including whether locked and reason
   */
  isLocked(): WorktreeLockInfo {
    this.ensureNotFreed();

    const buf = createGitBuf();

    try {
      const result = this._lib.symbols.git_worktree_is_locked(
        ptrOf(buf),
        this._ptr,
      );

      if (result < 0) {
        checkError(this._lib, result, "Failed to check worktree lock status");
      }

      const locked = result > 0;
      const reason = locked ? readGitBuf(buf) : null;

      return { locked, reason };
    } finally {
      this._lib.symbols.git_buf_dispose(ptrOf(buf));
    }
  }

  /**
   * Check if the worktree is prunable
   * @param options - Prune options
   * @returns true if prunable, false otherwise
   */
  isPrunable(options?: WorktreePruneOptions): boolean {
    this.ensureNotFreed();

    // Create prune options struct
    // git_worktree_prune_options: { version: u32, flags: u32 }
    const optsSize = 4 + 4;
    const opts = new Uint8Array(optsSize);
    const optsView = new DataView(opts.buffer);
    optsView.setUint32(0, 1, true); // version
    optsView.setUint32(4, options?.flags ?? 0, true); // flags

    const result = this._lib.symbols.git_worktree_is_prunable(
      this._ptr,
      ptrOf(opts),
    );

    return result > 0;
  }

  /**
   * Prune the worktree
   * @param options - Prune options
   */
  prune(options?: WorktreePruneOptions): void {
    this.ensureNotFreed();

    // Create prune options struct
    const optsSize = 4 + 4;
    const opts = new Uint8Array(optsSize);
    const optsView = new DataView(opts.buffer);
    optsView.setUint32(0, 1, true); // version
    optsView.setUint32(4, options?.flags ?? 0, true); // flags

    const result = this._lib.symbols.git_worktree_prune(this._ptr, ptrOf(opts));
    checkError(this._lib, result, "Failed to prune worktree");
  }

  /**
   * Free the worktree object
   */
  free(): void {
    if (!this._freed) {
      this._lib.symbols.git_worktree_free(this._ptr);
      this._freed = true;
    }
  }

  [Symbol.dispose](): void {
    this.free();
  }

  private ensureNotFreed(): void {
    if (this._freed) {
      throw new Error("Worktree has been freed");
    }
  }
}

/**
 * List worktrees for a repository
 * @param lib - LibGit2 library instance
 * @param repoPtr - Repository pointer
 * @returns Array of worktree names
 */
export function listWorktrees(lib: LibGit2, repoPtr: Pointer): string[] {
  // git_strarray: { strings: pointer, count: size_t }
  const array = new Uint8Array(POINTER_SIZE * 2);

  const result = lib.symbols.git_worktree_list(ptrOf(array), repoPtr);
  checkError(lib, result, "Failed to list worktrees");

  try {
    return readStrarray(ptrOf(array));
  } finally {
    lib.symbols.git_strarray_free(ptrOf(array));
  }
}

/**
 * Lookup a worktree by name
 * @param lib - LibGit2 library instance
 * @param repoPtr - Repository pointer
 * @param name - Worktree name
 * @returns Worktree object or null if not found
 */
export function lookupWorktree(
  lib: LibGit2,
  repoPtr: Pointer,
  name: string,
): Worktree | null {
  const outPtr = createOutPointer();
  const nameBytes = toCString(name);

  const result = lib.symbols.git_worktree_lookup(
    ptrOf(outPtr),
    repoPtr,
    ptrOf(nameBytes),
  );

  if (result < 0) {
    // Check if it's a "not found" error
    return null;
  }

  return new Worktree(readPointer(outPtr), lib);
}

/**
 * Add a new worktree
 * @param lib - LibGit2 library instance
 * @param repoPtr - Repository pointer
 * @param name - Worktree name
 * @param path - Path to create worktree at
 * @param options - Add options
 * @returns New Worktree object
 */
export function addWorktree(
  lib: LibGit2,
  repoPtr: Pointer,
  name: string,
  path: string,
  options?: WorktreeAddOptions,
): Worktree {
  const outPtr = createOutPointer();
  const nameBytes = toCString(name);
  const pathBytes = toCString(path);

  let opts: Uint8Array | null = null;

  if (options) {
    opts = new Uint8Array(WORKTREE_ADD_OPTIONS_SIZE);
    const initResult = lib.symbols.git_worktree_add_options_init(
      ptrOf(opts),
      1,
    );
    checkError(lib, initResult, "Failed to init worktree add options");

    const optsView = new DataView(
      opts.buffer,
      opts.byteOffset,
      opts.byteLength,
    );
    optsView.setInt32(WORKTREE_ADD_LOCK_OFFSET, options.lock ? 1 : 0, true);
    if (options.checkoutExisting !== undefined) {
      optsView.setInt32(
        WORKTREE_ADD_CHECKOUT_EXISTING_OFFSET,
        options.checkoutExisting ? 1 : 0,
        true,
      );
    }
  }

  const result = lib.symbols.git_worktree_add(
    ptrOf(outPtr),
    repoPtr,
    ptrOf(nameBytes),
    ptrOf(pathBytes),
    opts ? ptrOf(opts) : null,
  );

  checkError(lib, result, "Failed to add worktree");

  return new Worktree(readPointer(outPtr), lib);
}

/**
 * Open worktree from repository
 * @param lib - LibGit2 library instance
 * @param repoPtr - Repository pointer
 * @returns Worktree object or null if not a worktree
 */
export function openWorktreeFromRepository(
  lib: LibGit2,
  repoPtr: Pointer,
): Worktree | null {
  const outPtr = createOutPointer();

  const result = lib.symbols.git_worktree_open_from_repository(
    ptrOf(outPtr),
    repoPtr,
  );

  if (result < 0) {
    return null;
  }

  return new Worktree(readPointer(outPtr), lib);
}
