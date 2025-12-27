/**
 * @module blob
 * Git blob operations for reading file content
 */

import { getLibrary, type LibGit2 } from "./library.ts";
import { checkError, GitError } from "./error.ts";
import { GitErrorCode, type Pointer } from "./types.ts";
import {
  createOutPointer,
  ptrOf,
  readOidHex,
  readPointer,
  toCString,
} from "./utils.ts";
import type { Repository } from "./repository.ts";
import { getTreeEntryByPath, Tree } from "./tree.ts";

/**
 * Represents a Git blob (file content)
 */
export class Blob {
  private _ptr: Pointer;
  private _lib: LibGit2;
  private _closed = false;

  /**
   * Create a Blob instance from a pointer
   * @internal
   */
  constructor(ptr: Pointer) {
    if (ptr === null) {
      throw new GitError("Invalid blob pointer", GitErrorCode.EINVALID);
    }
    this._ptr = ptr;
    this._lib = getLibrary();
  }

  /**
   * Get the raw pointer
   */
  get pointer(): Pointer {
    this.ensureOpen();
    return this._ptr;
  }

  /**
   * Check if the blob is closed
   */
  get isClosed(): boolean {
    return this._closed;
  }

  /**
   * Ensure the blob is open
   */
  private ensureOpen(): void {
    if (this._closed) {
      throw new GitError("Blob is closed", GitErrorCode.EINVALID);
    }
  }

  /**
   * Lookup a blob by OID
   * @param repo - The repository
   * @param oid - The blob OID (hex string)
   */
  static lookup(repo: Repository, oid: string): Blob {
    const lib = getLibrary();
    const outPtr = createOutPointer();
    const oidBuf = new Uint8Array(20);
    const oidStr = toCString(oid);

    const parseResult = lib.symbols.git_oid_fromstr(
      ptrOf(oidBuf),
      ptrOf(oidStr),
    );
    checkError(lib, parseResult, `Invalid OID: ${oid}`);

    const result = lib.symbols.git_blob_lookup(
      ptrOf(outPtr),
      repo.pointer,
      ptrOf(oidBuf),
    );
    checkError(lib, result, `Failed to lookup blob ${oid}`);

    return new Blob(readPointer(outPtr));
  }

  /**
   * Close the blob and free resources
   */
  close(): void {
    if (!this._closed && this._ptr !== null) {
      this._lib.symbols.git_blob_free(this._ptr);
      this._ptr = null;
      this._closed = true;
    }
  }

  [Symbol.dispose](): void {
    this.close();
  }

  /**
   * Get the blob OID
   */
  get oid(): string {
    this.ensureOpen();
    const oidPtr = this._lib.symbols.git_blob_id(this._ptr);
    return readOidHex(oidPtr) ?? "";
  }

  /**
   * Get the raw size of the blob in bytes
   */
  get size(): number {
    this.ensureOpen();
    return Number(this._lib.symbols.git_blob_rawsize(this._ptr));
  }

  /**
   * Check if the blob is binary
   */
  get isBinary(): boolean {
    this.ensureOpen();
    return this._lib.symbols.git_blob_is_binary(this._ptr) !== 0;
  }

  /**
   * Get the raw content as a Uint8Array
   */
  rawContent(): Uint8Array {
    this.ensureOpen();
    const contentPtr = this._lib.symbols.git_blob_rawcontent(this._ptr);
    const size = this.size;

    if (contentPtr === null || size === 0) {
      return new Uint8Array(0);
    }

    const view = new Deno.UnsafePointerView(contentPtr);
    const bytes = new Uint8Array(size);
    view.copyInto(bytes);

    return bytes;
  }

  /**
   * Get the content as a string (UTF-8)
   */
  content(): string {
    const bytes = this.rawContent();
    return new TextDecoder().decode(bytes);
  }

  /**
   * Use the blob with automatic cleanup
   */
  static use<T>(repo: Repository, oid: string, fn: (blob: Blob) => T): T {
    using blob = Blob.lookup(repo, oid);
    return fn(blob);
  }
}

/**
 * Get the content of a blob by OID
 * @param repo - The repository
 * @param oid - The blob OID
 */
export function getBlobContent(repo: Repository, oid: string): string {
  return Blob.use(repo, oid, (blob) => blob.content());
}

/**
 * Get the raw content of a blob by OID
 * @param repo - The repository
 * @param oid - The blob OID
 */
export function getBlobRawContent(repo: Repository, oid: string): Uint8Array {
  return Blob.use(repo, oid, (blob) => blob.rawContent());
}

/**
 * Get the content of a file at a specific tree
 * @param repo - The repository
 * @param treeOid - The tree OID
 * @param path - The file path within the tree
 */
export function getFileContent(
  repo: Repository,
  treeOid: string,
  path: string,
): string | null {
  const entry = getTreeEntryByPath(repo, treeOid, path);
  if (entry === null) {
    return null;
  }

  return getBlobContent(repo, entry.oid);
}

/**
 * Get the raw content of a file at a specific tree
 * @param repo - The repository
 * @param treeOid - The tree OID
 * @param path - The file path within the tree
 */
export function getFileRawContent(
  repo: Repository,
  treeOid: string,
  path: string,
): Uint8Array | null {
  const entry = getTreeEntryByPath(repo, treeOid, path);
  if (entry === null) {
    return null;
  }

  return getBlobRawContent(repo, entry.oid);
}

/**
 * Get the content of a file at a specific commit
 * @param repo - The repository
 * @param commitOid - The commit OID
 * @param path - The file path
 */
export function getFileAtCommit(
  repo: Repository,
  commitOid: string,
  path: string,
): string | null {
  const commit = repo.lookupCommit(commitOid);
  return getFileContent(repo, commit.treeOid, path);
}

/**
 * Get the raw content of a file at a specific commit
 * @param repo - The repository
 * @param commitOid - The commit OID
 * @param path - The file path
 */
export function getFileRawAtCommit(
  repo: Repository,
  commitOid: string,
  path: string,
): Uint8Array | null {
  const commit = repo.lookupCommit(commitOid);
  return getFileRawContent(repo, commit.treeOid, path);
}

/**
 * Check if a file exists at a specific commit
 * @param repo - The repository
 * @param commitOid - The commit OID
 * @param path - The file path
 */
export function fileExistsAtCommit(
  repo: Repository,
  commitOid: string,
  path: string,
): boolean {
  const commit = repo.lookupCommit(commitOid);
  return Tree.use(repo, commit.treeOid, (tree) => tree.hasPath(path));
}
