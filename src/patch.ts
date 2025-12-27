/**
 * @module patch
 * Git patch operations for libgit2
 */

import { getLibrary, type LibGit2 } from "./library.ts";
import { checkError } from "./error.ts";
import type { Pointer } from "./types.ts";
import {
  createGitBuf,
  createOutPointer,
  createPointerArray,
  fromCString,
  POINTER_SIZE,
  ptrOf,
  readGitBuf,
  readPointer,
  readPointerArrayValue,
  readSizeValueFromPtrView,
} from "./utils.ts";
import { type Diff, type DiffDelta, DiffDeltaType } from "./diff.ts";

/**
 * Line statistics for a patch
 */
export interface PatchLineStats {
  /** Number of context lines */
  context: number;
  /** Number of added lines */
  additions: number;
  /** Number of deleted lines */
  deletions: number;
}

/**
 * Read a git_diff_file struct from memory
 */
function alignOffset(value: number, alignment: number): number {
  return Math.ceil(value / alignment) * alignment;
}

function readDiffFile(
  ptr: Pointer,
): { oid: string; path: string; size: bigint; flags: number; mode: number } {
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
 */
function readDiffDelta(ptr: Pointer): DiffDelta {
  if (!ptr) {
    throw new Error("Null diff delta pointer");
  }
  const view = new Deno.UnsafePointerView(ptr);

  const status = view.getUint32(0) as DiffDeltaType;
  const flags = view.getUint32(4);
  const similarity = view.getUint16(8);
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

  const newFilePtr = Deno.UnsafePointer.create(
    Deno.UnsafePointer.value(ptr) + BigInt(oldFileOffset + diffFileSize),
  );
  const newFile = readDiffFile(newFilePtr!);

  return { status, flags, similarity, nfiles, oldFile, newFile };
}

/**
 * Git patch object
 */
export class Patch {
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

  /** Get the number of hunks in this patch */
  get numHunks(): number {
    if (this._freed) throw new Error("Patch has been freed");
    return Number(this._lib.symbols.git_patch_num_hunks(this._ptr));
  }

  /**
   * Get the delta associated with this patch
   * @returns Delta info
   */
  getDelta(): DiffDelta {
    if (this._freed) throw new Error("Patch has been freed");

    const deltaPtr = this._lib.symbols.git_patch_get_delta(this._ptr);
    if (!deltaPtr) throw new Error("Failed to get delta from patch");

    return readDiffDelta(deltaPtr);
  }

  /**
   * Get line statistics for this patch
   * @returns Line stats (context, additions, deletions)
   */
  get lineStats(): PatchLineStats {
    if (this._freed) throw new Error("Patch has been freed");

    const contextPtr = createPointerArray(1);
    const additionsPtr = createPointerArray(1);
    const deletionsPtr = createPointerArray(1);

    const result = this._lib.symbols.git_patch_line_stats(
      ptrOf(contextPtr),
      ptrOf(additionsPtr),
      ptrOf(deletionsPtr),
      this._ptr,
    );

    checkError(this._lib, result, "Failed to get patch line stats");

    return {
      context: Number(readPointerArrayValue(contextPtr, 0)),
      additions: Number(readPointerArrayValue(additionsPtr, 0)),
      deletions: Number(readPointerArrayValue(deletionsPtr, 0)),
    };
  }

  /**
   * Convert this patch to a string (unified diff format)
   * @returns Patch as string
   */
  toString(): string {
    if (this._freed) throw new Error("Patch has been freed");

    const buf = createGitBuf();
    try {
      const result = this._lib.symbols.git_patch_to_buf(ptrOf(buf), this._ptr);
      checkError(this._lib, result, "Failed to convert patch to buffer");
      return readGitBuf(buf) ?? "";
    } finally {
      this._lib.symbols.git_buf_dispose(ptrOf(buf));
    }
  }

  /** Free the patch object */
  free(): void {
    if (!this._freed) {
      this._lib.symbols.git_patch_free(this._ptr);
      this._freed = true;
    }
  }

  [Symbol.dispose](): void {
    this.free();
  }
}

/**
 * Create a patch from a diff entry
 *
 * @param lib - LibGit2 library instance
 * @param diff - Diff object
 * @param index - Index of the delta in the diff
 * @returns Patch object or null if the delta is binary/unchanged
 */
export function patchFromDiff(
  lib: LibGit2,
  diff: Diff,
  index: number,
): Patch | null {
  const outPtr = createOutPointer();

  const result = lib.symbols.git_patch_from_diff(
    ptrOf(outPtr),
    diff.ptr,
    BigInt(index),
  );

  checkError(lib, result, "Failed to create patch from diff");

  const ptr = readPointer(outPtr);
  if (!ptr) return null;

  return new Patch(ptr, lib);
}
