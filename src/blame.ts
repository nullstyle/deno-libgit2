/**
 * @module blame
 * Git blame operations for libgit2
 */

import { getLibrary, type LibGit2 } from "./library.ts";
import { checkError, GitError } from "./error.ts";
import {
  type BlameHunk,
  type BlameOptions,
  GitErrorCode,
  type Pointer,
} from "./types.ts";
import {
  createOutPointer,
  fromCString,
  POINTER_SIZE,
  ptrOf,
  readPointer,
  readPointerValueFromPtrView,
  readSignature,
  toCString,
  writeSizeValue,
} from "./utils.ts";

/** Version for git_blame_options */
const GIT_BLAME_OPTIONS_VERSION = 1;

/**
 * Size of git_blame_options struct (approximate, may need adjustment)
 */
function alignOffset(value: number, alignment: number): number {
  return Math.ceil(value / alignment) * alignment;
}

const BLAME_NEWEST_OID_OFFSET = 10;
const BLAME_OLDEST_OID_OFFSET = BLAME_NEWEST_OID_OFFSET + 20;
const BLAME_MIN_LINE_OFFSET = alignOffset(
  BLAME_OLDEST_OID_OFFSET + 20,
  POINTER_SIZE,
);
const BLAME_MAX_LINE_OFFSET = BLAME_MIN_LINE_OFFSET + POINTER_SIZE;
const GIT_BLAME_OPTIONS_SIZE = BLAME_MAX_LINE_OFFSET + POINTER_SIZE;

/**
 * Represents a git blame result
 */
export class Blame {
  private _ptr: Pointer;
  private _lib: LibGit2;
  private _closed = false;

  constructor(ptr: Pointer) {
    if (ptr === null) {
      throw new GitError("Invalid blame pointer", GitErrorCode.EINVALID);
    }
    this._ptr = ptr;
    this._lib = getLibrary();
  }

  /**
   * Get the raw pointer
   */
  get pointer(): Pointer {
    return this._ptr;
  }

  /**
   * Get the number of hunks in the blame
   */
  get hunkCount(): number {
    this.ensureOpen();
    return this._lib.symbols.git_blame_get_hunk_count(this._ptr);
  }

  /**
   * Get the number of lines in the blamed file
   * Note: This is calculated from hunks since git_blame_linecount may not be available
   */
  get lineCount(): number {
    this.ensureOpen();
    let total = 0;
    const count = this.hunkCount;
    for (let i = 0; i < count; i++) {
      const hunk = this.getHunkByIndex(i);
      if (hunk) {
        total += hunk.linesInHunk;
      }
    }
    return total;
  }

  /**
   * Get a blame hunk by index
   */
  getHunkByIndex(index: number): BlameHunk | null {
    this.ensureOpen();
    const hunkPtr = this._lib.symbols.git_blame_get_hunk_byindex(
      this._ptr,
      index,
    );
    if (hunkPtr === null) {
      return null;
    }
    return this.readBlameHunk(hunkPtr);
  }

  /**
   * Get the blame hunk for a specific line number (1-based)
   */
  getHunkByLine(lineNo: number): BlameHunk | null {
    this.ensureOpen();
    const hunkPtr = this._lib.symbols.git_blame_get_hunk_byline(
      this._ptr,
      BigInt(lineNo),
    );
    if (hunkPtr === null) {
      return null;
    }
    return this.readBlameHunk(hunkPtr);
  }

  /**
   * Free the blame object
   */
  free(): void {
    if (!this._closed && this._ptr !== null) {
      this._lib.symbols.git_blame_free(this._ptr);
      this._closed = true;
    }
  }

  /**
   * Alias for free()
   */
  close(): void {
    this.free();
  }

  [Symbol.dispose](): void {
    this.close();
  }

  private ensureOpen(): void {
    if (this._closed) {
      throw new GitError("Blame has been freed", GitErrorCode.EINVALID);
    }
  }

  /**
   * Read a blame hunk from a pointer
   */
  private readBlameHunk(ptr: Pointer): BlameHunk {
    if (!ptr) {
      throw new GitError("Invalid blame hunk pointer", GitErrorCode.EINVALID);
    }
    const view = new Deno.UnsafePointerView(ptr);

    const linesInHunk = Number(readPointerValueFromPtrView(view, 0));

    const finalCommitOffset = POINTER_SIZE;
    const finalCommitIdBytes = new Uint8Array(20);
    for (let i = 0; i < 20; i++) {
      finalCommitIdBytes[i] = view.getUint8(finalCommitOffset + i);
    }
    const finalCommitId = Array.from(finalCommitIdBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const finalStartLineOffset = alignOffset(
      finalCommitOffset + 20,
      POINTER_SIZE,
    );
    const finalStartLineNumber = Number(
      readPointerValueFromPtrView(view, finalStartLineOffset),
    );

    const finalSignatureOffset = finalStartLineOffset + POINTER_SIZE;
    const finalCommitterOffset = finalSignatureOffset + POINTER_SIZE;
    const origCommitOffset = finalCommitterOffset + POINTER_SIZE;

    const finalSigPtrValue = readPointerValueFromPtrView(
      view,
      finalSignatureOffset,
    );
    const finalCommitterPtrValue = readPointerValueFromPtrView(
      view,
      finalCommitterOffset,
    );
    const finalSigPtr = finalSigPtrValue === 0n
      ? null
      : Deno.UnsafePointer.create(finalSigPtrValue);
    const finalCommitterPtr = finalCommitterPtrValue === 0n
      ? null
      : Deno.UnsafePointer.create(finalCommitterPtrValue);

    const origCommitIdBytes = new Uint8Array(20);
    for (let i = 0; i < 20; i++) {
      origCommitIdBytes[i] = view.getUint8(origCommitOffset + i);
    }
    const origCommitId = Array.from(origCommitIdBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const origPathOffset = alignOffset(origCommitOffset + 20, POINTER_SIZE);
    const origPathPtrValue = readPointerValueFromPtrView(view, origPathOffset);
    const origPathPtr = origPathPtrValue === 0n
      ? null
      : Deno.UnsafePointer.create(origPathPtrValue);

    const origStartLineOffset = origPathOffset + POINTER_SIZE;
    const origStartLineNumber = Number(
      readPointerValueFromPtrView(view, origStartLineOffset),
    );

    const origSignatureOffset = origStartLineOffset + POINTER_SIZE;
    const origCommitterOffset = origSignatureOffset + POINTER_SIZE;
    const summaryOffset = origCommitterOffset + POINTER_SIZE;
    const boundaryOffset = summaryOffset + POINTER_SIZE;

    const origSigPtrValue = readPointerValueFromPtrView(
      view,
      origSignatureOffset,
    );
    const origCommitterPtrValue = readPointerValueFromPtrView(
      view,
      origCommitterOffset,
    );
    const summaryPtrValue = readPointerValueFromPtrView(view, summaryOffset);
    const origSigPtr = origSigPtrValue === 0n
      ? null
      : Deno.UnsafePointer.create(origSigPtrValue);
    const origCommitterPtr = origCommitterPtrValue === 0n
      ? null
      : Deno.UnsafePointer.create(origCommitterPtrValue);
    const summaryPtr = summaryPtrValue === 0n
      ? null
      : Deno.UnsafePointer.create(summaryPtrValue);

    const boundary = view.getUint8(boundaryOffset);

    return {
      linesInHunk,
      finalCommitId,
      finalStartLineNumber,
      finalSignature: readSignature(finalSigPtr) ?? undefined,
      finalCommitter: readSignature(finalCommitterPtr) ?? undefined,
      origCommitId,
      origPath: fromCString(origPathPtr) ?? undefined,
      origStartLineNumber,
      origSignature: readSignature(origSigPtr) ?? undefined,
      origCommitter: readSignature(origCommitterPtr) ?? undefined,
      summary: fromCString(summaryPtr) ?? undefined,
      isBoundary: boundary !== 0,
    };
  }
}

/**
 * Get blame for a file
 */
export function blameFile(
  lib: LibGit2,
  repoPtr: Pointer,
  path: string,
  options?: BlameOptions,
): Blame {
  const outPtr = createOutPointer();
  const pathBuf = toCString(path);

  // Create options struct if needed
  let optsPtr: Pointer = null;
  let optsBuf: Uint8Array | null = null;

  if (options) {
    optsBuf = new Uint8Array(GIT_BLAME_OPTIONS_SIZE);
    const result = lib.symbols.git_blame_options_init(
      ptrOf(optsBuf),
      GIT_BLAME_OPTIONS_VERSION,
    );
    checkError(lib, result, "Failed to initialize blame options");

    const view = new DataView(optsBuf.buffer);

    // Set flags at offset 4 (after version)
    if (options.flags !== undefined) {
      view.setUint32(4, options.flags, true);
    }

    if (options.newestCommit) {
      setOidInBuffer(optsBuf, BLAME_NEWEST_OID_OFFSET, options.newestCommit);
    }

    if (options.oldestCommit) {
      setOidInBuffer(optsBuf, BLAME_OLDEST_OID_OFFSET, options.oldestCommit);
    }

    if (options.minLine !== undefined) {
      writeSizeValue(
        view,
        BLAME_MIN_LINE_OFFSET,
        BigInt(options.minLine),
      );
    }

    if (options.maxLine !== undefined) {
      writeSizeValue(
        view,
        BLAME_MAX_LINE_OFFSET,
        BigInt(options.maxLine),
      );
    }

    optsPtr = ptrOf(optsBuf);
  }

  const result = lib.symbols.git_blame_file(
    ptrOf(outPtr),
    repoPtr,
    ptrOf(pathBuf),
    optsPtr,
  );
  checkError(lib, result, `Failed to blame file: ${path}`);

  return new Blame(readPointer(outPtr));
}

/**
 * Set an OID in a buffer at the given offset
 */
function setOidInBuffer(
  buffer: Uint8Array,
  offset: number,
  oidHex: string,
): void {
  for (let i = 0; i < 20 && i * 2 < oidHex.length; i++) {
    buffer[offset + i] = parseInt(oidHex.slice(i * 2, i * 2 + 2), 16);
  }
}
