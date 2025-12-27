/**
 * @module signature
 * Git signature handling for commits and tags
 */

import type { Pointer } from "./types.ts";
import type { LibGit2 } from "./library.ts";
import { createOutPointer, ptrOf, readPointer, toCString } from "./utils.ts";
import { checkError } from "./error.ts";
import { getLibrary } from "./library.ts";

/**
 * Signature information for author/committer
 */
export interface SignatureInfo {
  name: string;
  email: string;
  time?: number; // Unix timestamp in seconds
  offset?: number; // Timezone offset in minutes
}

/**
 * Git signature wrapper
 * Represents an author or committer identity
 */
export class Signature {
  private _ptr: Pointer;
  private _lib: LibGit2;
  private _closed = false;

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
   * Free the signature
   */
  free(): void {
    if (!this._closed && this._ptr !== null) {
      this._lib.symbols.git_signature_free(this._ptr);
      this._closed = true;
    }
  }

  /**
   * Alias for free() for consistency
   */
  close(): void {
    this.free();
  }

  [Symbol.dispose](): void {
    this.close();
  }

  /**
   * Create a new signature with current time
   */
  static now(name: string, email: string, lib?: LibGit2): Signature {
    const _lib = lib ?? getLibrary();
    const outPtr = createOutPointer();
    const nameStr = toCString(name);
    const emailStr = toCString(email);

    const result = _lib.symbols.git_signature_now(
      ptrOf(outPtr),
      ptrOf(nameStr),
      ptrOf(emailStr),
    );
    checkError(_lib, result, "Failed to create signature");

    return new Signature(readPointer(outPtr), _lib);
  }

  /**
   * Create a new signature with specific time
   */
  static create(
    name: string,
    email: string,
    time: number,
    offset: number,
    lib?: LibGit2,
  ): Signature {
    const _lib = lib ?? getLibrary();
    const outPtr = createOutPointer();
    const nameStr = toCString(name);
    const emailStr = toCString(email);

    const result = _lib.symbols.git_signature_new(
      ptrOf(outPtr),
      ptrOf(nameStr),
      ptrOf(emailStr),
      BigInt(time),
      offset,
    );
    checkError(_lib, result, "Failed to create signature");

    return new Signature(readPointer(outPtr), _lib);
  }

  /**
   * Create a signature from SignatureInfo
   */
  static fromInfo(info: SignatureInfo, lib?: LibGit2): Signature {
    if (info.time !== undefined && info.offset !== undefined) {
      return Signature.create(
        info.name,
        info.email,
        info.time,
        info.offset,
        lib,
      );
    }
    return Signature.now(info.name, info.email, lib);
  }
}

/**
 * Create a signature with current time
 */
export function createSignatureNow(
  lib: LibGit2,
  name: string,
  email: string,
): Pointer {
  const outPtr = createOutPointer();
  const nameStr = toCString(name);
  const emailStr = toCString(email);

  const result = lib.symbols.git_signature_now(
    ptrOf(outPtr),
    ptrOf(nameStr),
    ptrOf(emailStr),
  );
  checkError(lib, result, "Failed to create signature");

  return readPointer(outPtr);
}

/**
 * Free a signature pointer
 */
export function freeSignature(lib: LibGit2, sigPtr: Pointer): void {
  if (sigPtr !== null) {
    lib.symbols.git_signature_free(sigPtr);
  }
}
