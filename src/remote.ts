/**
 * @module remote
 * Remote repository operations
 */

import { getLibrary } from "./library.ts";
import { checkError } from "./error.ts";
import {
  createOutPointer,
  fromCString,
  POINTER_SIZE,
  ptrOf,
  readPointer,
  readStrarray,
  toCString,
} from "./utils.ts";
import type { Pointer } from "./types.ts";

/**
 * Represents a remote repository
 */
export class Remote {
  private _ptr: Pointer;
  private _lib: ReturnType<typeof getLibrary>;

  constructor(ptr: Pointer) {
    this._ptr = ptr;
    this._lib = getLibrary();
  }

  /**
   * Get the underlying pointer
   */
  get ptr(): Pointer {
    return this._ptr;
  }

  /**
   * Get the remote name
   */
  get name(): string | null {
    const namePtr = this._lib.symbols.git_remote_name(this._ptr);
    return fromCString(namePtr);
  }

  /**
   * Get the remote URL (fetch URL)
   */
  get url(): string | null {
    const urlPtr = this._lib.symbols.git_remote_url(this._ptr);
    return fromCString(urlPtr);
  }

  /**
   * Get the remote push URL (null if not set, defaults to fetch URL)
   */
  get pushUrl(): string | null {
    const urlPtr = this._lib.symbols.git_remote_pushurl(this._ptr);
    return fromCString(urlPtr);
  }

  /**
   * Free the remote
   */
  free(): void {
    if (this._ptr) {
      this._lib.symbols.git_remote_free(this._ptr);
      this._ptr = null;
    }
  }

  [Symbol.dispose](): void {
    this.free();
  }
}

/**
 * Create a new remote in a repository
 *
 * @param repoPtr - Repository pointer
 * @param name - Remote name
 * @param url - Remote URL
 * @returns The created remote
 */
export function createRemote(
  repoPtr: Pointer,
  name: string,
  url: string,
): Remote {
  const lib = getLibrary();
  const outPtr = createOutPointer();
  const namePtr = ptrOf(toCString(name));
  const urlPtr = ptrOf(toCString(url));

  const error = lib.symbols.git_remote_create(
    ptrOf(outPtr),
    repoPtr,
    namePtr,
    urlPtr,
  );
  checkError(lib, error, "Failed to create remote");

  const remotePtr = readPointer(outPtr);
  return new Remote(remotePtr);
}

/**
 * Look up a remote by name
 *
 * @param repoPtr - Repository pointer
 * @param name - Remote name
 * @returns The remote or null if not found
 */
export function lookupRemote(repoPtr: Pointer, name: string): Remote | null {
  const lib = getLibrary();
  const outPtr = createOutPointer();
  const namePtr = ptrOf(toCString(name));

  const error = lib.symbols.git_remote_lookup(ptrOf(outPtr), repoPtr, namePtr);

  if (error !== 0) {
    return null;
  }

  const remotePtr = readPointer(outPtr);
  return new Remote(remotePtr);
}

/**
 * List all remotes in a repository
 *
 * @param repoPtr - Repository pointer
 * @returns Array of remote names
 */
export function listRemotes(repoPtr: Pointer): string[] {
  const lib = getLibrary();

  // git_strarray struct: { char **strings; size_t count; }
  const strarray = new Uint8Array(POINTER_SIZE * 2);

  const error = lib.symbols.git_remote_list(ptrOf(strarray), repoPtr);
  checkError(lib, error, "Failed to list remotes");

  try {
    return readStrarray(ptrOf(strarray));
  } finally {
    lib.symbols.git_strarray_free(ptrOf(strarray));
  }
}

/**
 * Set the URL for a remote
 *
 * @param repoPtr - Repository pointer
 * @param name - Remote name
 * @param url - New URL
 */
export function setRemoteUrl(
  repoPtr: Pointer,
  name: string,
  url: string,
): void {
  const lib = getLibrary();
  const namePtr = ptrOf(toCString(name));
  const urlPtr = ptrOf(toCString(url));

  const error = lib.symbols.git_remote_set_url(repoPtr, namePtr, urlPtr);
  checkError(lib, error, "Failed to set remote URL");
}

/**
 * Set the push URL for a remote
 *
 * @param repoPtr - Repository pointer
 * @param name - Remote name
 * @param url - New push URL
 */
export function setRemotePushUrl(
  repoPtr: Pointer,
  name: string,
  url: string,
): void {
  const lib = getLibrary();
  const namePtr = ptrOf(toCString(name));
  const urlPtr = ptrOf(toCString(url));

  const error = lib.symbols.git_remote_set_pushurl(repoPtr, namePtr, urlPtr);
  checkError(lib, error, "Failed to set remote push URL");
}

/**
 * Delete a remote
 *
 * @param repoPtr - Repository pointer
 * @param name - Remote name
 */
export function deleteRemote(repoPtr: Pointer, name: string): void {
  const lib = getLibrary();
  const namePtr = ptrOf(toCString(name));

  const error = lib.symbols.git_remote_delete(repoPtr, namePtr);
  checkError(lib, error, "Failed to delete remote");
}

/**
 * Rename a remote
 *
 * @param repoPtr - Repository pointer
 * @param oldName - Current remote name
 * @param newName - New remote name
 * @returns Array of problems encountered (empty if successful)
 */
export function renameRemote(
  repoPtr: Pointer,
  oldName: string,
  newName: string,
): string[] {
  const lib = getLibrary();

  // git_strarray for problems
  const problems = new Uint8Array(POINTER_SIZE * 2);
  const oldNamePtr = ptrOf(toCString(oldName));
  const newNamePtr = ptrOf(toCString(newName));

  const error = lib.symbols.git_remote_rename(
    ptrOf(problems),
    repoPtr,
    oldNamePtr,
    newNamePtr,
  );
  checkError(lib, error, "Failed to rename remote");

  try {
    return readStrarray(ptrOf(problems));
  } finally {
    lib.symbols.git_strarray_free(ptrOf(problems));
  }
}
