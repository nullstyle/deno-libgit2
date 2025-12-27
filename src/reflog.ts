/**
 * @module reflog
 * Git reflog operations for libgit2
 */

import { getLibrary, type LibGit2 } from "./library.ts";
import { checkError, GitError } from "./error.ts";
import { GitErrorCode, type GitSignature, type Pointer } from "./types.ts";
import {
  createOutPointer,
  fromCString,
  ptrOf,
  readOidHex,
  readPointer,
  readSignature as readSignatureValue,
  toCString,
} from "./utils.ts";

/**
 * Represents a reflog entry
 */
export interface ReflogEntry {
  /** The old OID (before the change) */
  oldOid: string;
  /** The new OID (after the change) */
  newOid: string;
  /** The committer who made the change */
  committer: GitSignature;
  /** The reflog message */
  message: string | null;
}

/**
 * Represents a git reflog
 */
export class Reflog {
  private _ptr: Pointer;
  private _lib: LibGit2;
  private _closed = false;

  constructor(ptr: Pointer) {
    if (ptr === null) {
      throw new GitError("Invalid reflog pointer", GitErrorCode.EINVALID);
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
   * Get the number of entries in the reflog
   */
  get entryCount(): number {
    this.ensureOpen();
    return Number(this._lib.symbols.git_reflog_entrycount(this._ptr));
  }

  /**
   * Get a reflog entry by index
   * Index 0 returns the most recent entry
   */
  getEntry(index: number): ReflogEntry | null {
    this.ensureOpen();
    const entryPtr = this._lib.symbols.git_reflog_entry_byindex(
      this._ptr,
      BigInt(index),
    );
    if (entryPtr === null) {
      return null;
    }
    return this.readEntry(entryPtr);
  }

  /**
   * Get all entries in the reflog
   * Returns entries in reverse chronological order (newest first)
   */
  entries(): ReflogEntry[] {
    this.ensureOpen();
    const result: ReflogEntry[] = [];
    const count = this.entryCount;
    for (let i = 0; i < count; i++) {
      const entry = this.getEntry(i);
      if (entry) {
        result.push(entry);
      }
    }
    return result;
  }

  /**
   * Write the reflog to disk
   */
  write(): void {
    this.ensureOpen();
    const result = this._lib.symbols.git_reflog_write(this._ptr);
    checkError(this._lib, result, "Failed to write reflog");
  }

  /**
   * Drop an entry from the reflog by index
   * @param index The index of the entry to drop
   * @param rewritePreviousEntry If true, rewrite the history to close the gap
   */
  drop(index: number, rewritePreviousEntry = true): void {
    this.ensureOpen();
    const result = this._lib.symbols.git_reflog_drop(
      this._ptr,
      BigInt(index),
      rewritePreviousEntry ? 1 : 0,
    );
    checkError(
      this._lib,
      result,
      `Failed to drop reflog entry at index ${index}`,
    );
  }

  /**
   * Free the reflog object
   */
  free(): void {
    if (!this._closed && this._ptr !== null) {
      this._lib.symbols.git_reflog_free(this._ptr);
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
      throw new GitError("Reflog has been freed", GitErrorCode.EINVALID);
    }
  }

  /**
   * Read a reflog entry from a pointer
   */
  private readEntry(entryPtr: Pointer): ReflogEntry {
    // Get old OID
    const oldOidPtr = this._lib.symbols.git_reflog_entry_id_old(entryPtr);
    const oldOid = oldOidPtr
      ? (readOidHex(oldOidPtr) ?? "0".repeat(40))
      : "0".repeat(40);

    // Get new OID
    const newOidPtr = this._lib.symbols.git_reflog_entry_id_new(entryPtr);
    const newOid = newOidPtr
      ? (readOidHex(newOidPtr) ?? "0".repeat(40))
      : "0".repeat(40);

    // Get committer
    const committerPtr = this._lib.symbols.git_reflog_entry_committer(entryPtr);
    const committer = this.readSignature(committerPtr);

    // Get message
    const messagePtr = this._lib.symbols.git_reflog_entry_message(entryPtr);
    const message = fromCString(messagePtr);

    return {
      oldOid,
      newOid,
      committer,
      message,
    };
  }

  /**
   * Read a git_signature from a pointer
   */
  private readSignature(ptr: Pointer): GitSignature {
    const signature = readSignatureValue(ptr);
    if (signature === null) {
      return {
        name: "",
        email: "",
        when: { time: 0n, offset: 0, sign: "+" },
      };
    }
    return signature;
  }
}

/**
 * Read the reflog for a reference
 */
export function readReflog(
  lib: LibGit2,
  repoPtr: Pointer,
  name: string,
): Reflog {
  const outPtr = createOutPointer();
  const nameBuf = toCString(name);

  const result = lib.symbols.git_reflog_read(
    ptrOf(outPtr),
    repoPtr,
    ptrOf(nameBuf),
  );
  checkError(lib, result, `Failed to read reflog for: ${name}`);

  return new Reflog(readPointer(outPtr));
}

/**
 * Delete the reflog for a reference
 */
export function deleteReflog(
  lib: LibGit2,
  repoPtr: Pointer,
  name: string,
): void {
  const nameBuf = toCString(name);

  const result = lib.symbols.git_reflog_delete(repoPtr, ptrOf(nameBuf));
  checkError(lib, result, `Failed to delete reflog for: ${name}`);
}

/**
 * Rename a reflog
 */
export function renameReflog(
  lib: LibGit2,
  repoPtr: Pointer,
  oldName: string,
  newName: string,
): void {
  const oldNameBuf = toCString(oldName);
  const newNameBuf = toCString(newName);

  const result = lib.symbols.git_reflog_rename(
    repoPtr,
    ptrOf(oldNameBuf),
    ptrOf(newNameBuf),
  );
  checkError(
    lib,
    result,
    `Failed to rename reflog from ${oldName} to ${newName}`,
  );
}
