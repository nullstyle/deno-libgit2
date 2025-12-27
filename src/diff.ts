/**
 * @module diff
 * Git diff operations for libgit2
 */

import { getLibrary, type LibGit2 } from "./library.ts";
import { checkError } from "./error.ts";
import type { Pointer } from "./types.ts";
import {
  createOutPointer,
  fromCString,
  POINTER_SIZE,
  ptrOf,
  readPointer,
  readSizeValueFromPtrView,
} from "./utils.ts";

/**
 * Diff delta type
 */
export enum DiffDeltaType {
  UNMODIFIED = 0,
  ADDED = 1,
  DELETED = 2,
  MODIFIED = 3,
  RENAMED = 4,
  COPIED = 5,
  IGNORED = 6,
  UNTRACKED = 7,
  TYPECHANGE = 8,
  UNREADABLE = 9,
  CONFLICTED = 10,
}

/**
 * Diff file flags
 */
export enum DiffFileFlags {
  VALID_ID = (1 << 0),
  BINARY = (1 << 1),
  NOT_BINARY = (1 << 2),
  VALID_SIZE = (1 << 3),
  EXISTS = (1 << 4),
}

/**
 * Diff file info
 */
export interface DiffFile {
  /** OID of the file */
  oid: string;
  /** Path to the file */
  path: string;
  /** File size in bytes */
  size: bigint;
  /** File flags */
  flags: number;
  /** File mode */
  mode: number;
}

/**
 * Diff delta info
 */
export interface DiffDelta {
  /** Delta type */
  status: DiffDeltaType;
  /** Flags for the delta */
  flags: number;
  /** Similarity percentage for renames/copies */
  similarity: number;
  /** Number of files in the delta */
  nfiles: number;
  /** Old file info */
  oldFile: DiffFile;
  /** New file info */
  newFile: DiffFile;
}

/**
 * Read a git_diff_file struct from memory
 *
 * git_diff_file layout (v1.1.0):
 * - git_oid id (20 bytes)
 * - const char *path (8 bytes pointer)
 * - git_object_size_t size (8 bytes)
 * - uint32_t flags (4 bytes)
 * - uint16_t mode (2 bytes)
 * - uint16_t id_abbrev (2 bytes)
 * Total: 44 bytes
 */
function alignOffset(value: number, alignment: number): number {
  return Math.ceil(value / alignment) * alignment;
}

function readDiffFile(ptr: Pointer): DiffFile {
  if (!ptr) {
    throw new Error("Null diff file pointer");
  }
  const view = new Deno.UnsafePointerView(ptr);

  // Read OID (20 bytes at offset 0)
  const oidBytes = new Uint8Array(20);
  for (let i = 0; i < 20; i++) {
    oidBytes[i] = view.getUint8(i);
  }
  const oid = Array.from(oidBytes).map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const pathOffset = alignOffset(20, POINTER_SIZE);
  const pathPtr = view.getPointer(pathOffset);
  const path = fromCString(pathPtr) ?? "";

  const sizeOffset = pathOffset + POINTER_SIZE;
  const size = readSizeValueFromPtrView(view, sizeOffset);

  const flagsOffset = sizeOffset + POINTER_SIZE;
  const flags = view.getUint32(flagsOffset);

  const modeOffset = flagsOffset + 4;
  const mode = view.getUint16(modeOffset);

  return { oid, path, size, flags, mode };
}

/**
 * Read a git_diff_delta struct from memory
 *
 * git_diff_delta layout (v1.1.0):
 * - git_delta_t status (4 bytes enum)
 * - uint32_t flags (4 bytes)
 * - uint16_t similarity (2 bytes)
 * - uint16_t nfiles (2 bytes)
 * - git_diff_file old_file (48 bytes, aligned)
 * - git_diff_file new_file (48 bytes)
 */
function readDiffDelta(ptr: Pointer): DiffDelta {
  if (!ptr) {
    throw new Error("Null diff delta pointer");
  }
  const view = new Deno.UnsafePointerView(ptr);

  // Read status (4 bytes at offset 0)
  const status = view.getUint32(0) as DiffDeltaType;

  // Read flags (4 bytes at offset 4)
  const flags = view.getUint32(4);

  // Read similarity (2 bytes at offset 8)
  const similarity = view.getUint16(8);

  // Read nfiles (2 bytes at offset 10)
  const nfiles = view.getUint16(10);

  const headerSize = 4 + 4 + 2 + 2;
  const oldFileOffset = alignOffset(headerSize, POINTER_SIZE);
  const diffFileSize = alignOffset(
    alignOffset(20, POINTER_SIZE) + POINTER_SIZE + POINTER_SIZE + 4 + 2 + 2,
    POINTER_SIZE,
  );
  const oldFilePtr = Deno.UnsafePointer.create(
    Deno.UnsafePointer.value(ptr) + BigInt(oldFileOffset),
  );
  const oldFile = readDiffFile(oldFilePtr!);

  // Read new_file (immediately after old_file)
  const newFilePtr = Deno.UnsafePointer.create(
    Deno.UnsafePointer.value(ptr) + BigInt(oldFileOffset + diffFileSize),
  );
  const newFile = readDiffFile(newFilePtr!);

  return { status, flags, similarity, nfiles, oldFile, newFile };
}

/**
 * Git diff object
 */
export class Diff {
  private _ptr: Pointer;
  private _lib: LibGit2;
  private _freed = false;

  constructor(ptr: Pointer, lib?: LibGit2) {
    this._ptr = ptr;
    this._lib = lib ?? getLibrary();
  }

  /** Get the underlying pointer */
  get ptr(): Pointer {
    return this._ptr;
  }

  /** Get the number of deltas in this diff */
  get numDeltas(): number {
    if (this._freed) throw new Error("Diff has been freed");
    return Number(this._lib.symbols.git_diff_num_deltas(this._ptr));
  }

  /**
   * Get a delta from this diff by index
   * @param index - Index of the delta (0-based)
   * @returns Delta info or null if index is out of bounds
   */
  getDelta(index: number): DiffDelta | null {
    if (this._freed) throw new Error("Diff has been freed");

    const deltaPtr = this._lib.symbols.git_diff_get_delta(
      this._ptr,
      BigInt(index),
    );
    if (!deltaPtr) return null;

    return readDiffDelta(deltaPtr);
  }

  /**
   * Iterate over all deltas in this diff
   */
  *deltas(): Generator<DiffDelta> {
    const count = this.numDeltas;
    for (let i = 0; i < count; i++) {
      const delta = this.getDelta(i);
      if (delta) yield delta;
    }
  }

  /** Free the diff object */
  free(): void {
    if (!this._freed) {
      this._lib.symbols.git_diff_free(this._ptr);
      this._freed = true;
    }
  }

  [Symbol.dispose](): void {
    this.free();
  }
}

/**
 * Create a diff between two trees
 *
 * @param lib - LibGit2 library instance
 * @param repoPtr - Repository pointer
 * @param oldTreePtr - Old tree pointer (can be null)
 * @param newTreePtr - New tree pointer (can be null)
 * @returns Diff object
 */
export function diffTreeToTree(
  lib: LibGit2,
  repoPtr: Pointer,
  oldTreePtr: Pointer | null,
  newTreePtr: Pointer | null,
): Diff {
  const outPtr = createOutPointer();

  const result = lib.symbols.git_diff_tree_to_tree(
    ptrOf(outPtr),
    repoPtr,
    oldTreePtr,
    newTreePtr,
    null, // options (use defaults)
  );

  checkError(lib, result, "Failed to create diff between trees");

  return new Diff(readPointer(outPtr), lib);
}

/**
 * Create a diff between a tree and the index
 *
 * @param lib - LibGit2 library instance
 * @param repoPtr - Repository pointer
 * @param treePtr - Tree pointer (can be null for empty tree)
 * @param indexPtr - Index pointer (can be null for repo index)
 * @returns Diff object
 */
export function diffTreeToIndex(
  lib: LibGit2,
  repoPtr: Pointer,
  treePtr: Pointer | null,
  indexPtr: Pointer | null,
): Diff {
  const outPtr = createOutPointer();

  const result = lib.symbols.git_diff_tree_to_index(
    ptrOf(outPtr),
    repoPtr,
    treePtr,
    indexPtr,
    null, // options (use defaults)
  );

  checkError(lib, result, "Failed to create diff between tree and index");

  return new Diff(readPointer(outPtr), lib);
}

/**
 * Create a diff between the index and the working directory
 *
 * @param lib - LibGit2 library instance
 * @param repoPtr - Repository pointer
 * @param indexPtr - Index pointer (can be null for repo index)
 * @returns Diff object
 */
export function diffIndexToWorkdir(
  lib: LibGit2,
  repoPtr: Pointer,
  indexPtr: Pointer | null,
): Diff {
  const outPtr = createOutPointer();

  const result = lib.symbols.git_diff_index_to_workdir(
    ptrOf(outPtr),
    repoPtr,
    indexPtr,
    null, // options (use defaults)
  );

  checkError(lib, result, "Failed to create diff between index and workdir");

  return new Diff(readPointer(outPtr), lib);
}

/**
 * Create a diff between a tree and the working directory
 *
 * @param lib - LibGit2 library instance
 * @param repoPtr - Repository pointer
 * @param treePtr - Tree pointer (can be null for empty tree)
 * @returns Diff object
 */
export function diffTreeToWorkdir(
  lib: LibGit2,
  repoPtr: Pointer,
  treePtr: Pointer | null,
): Diff {
  const outPtr = createOutPointer();

  const result = lib.symbols.git_diff_tree_to_workdir(
    ptrOf(outPtr),
    repoPtr,
    treePtr,
    null, // options (use defaults)
  );

  checkError(lib, result, "Failed to create diff between tree and workdir");

  return new Diff(readPointer(outPtr), lib);
}
