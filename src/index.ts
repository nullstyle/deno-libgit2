/**
 * @module index
 * Git index (staging area) operations
 */

import { getLibrary, type LibGit2 } from "./library.ts";
import { checkError, GitError } from "./error.ts";
import { GitErrorCode, type Pointer } from "./types.ts";
import {
  createOutPointer,
  Defer,
  fromCString,
  ptrOf,
  readOidHex,
  readPointer,
  readPointerValueFromPtrView,
  toCString,
} from "./utils.ts";
import { Repository } from "./repository.ts";

const INDEX_ENTRY_MODE_OFFSET = 24;
const INDEX_ENTRY_FILE_SIZE_OFFSET = 36;
const INDEX_ENTRY_OID_OFFSET = 40;
const INDEX_ENTRY_FLAGS_OFFSET = 60;
const INDEX_ENTRY_PATH_OFFSET = 64;

/**
 * Index entry information
 */
export interface IndexEntry {
  /** Entry path */
  path: string;
  /** Entry OID */
  oid: string;
  /** File mode */
  mode: number;
  /** File size */
  fileSize: number;
  /** Stage number (0 for normal, 1-3 for conflicts) */
  stage: number;
}

/**
 * Represents a Git index (staging area)
 */
export class Index {
  private _ptr: Pointer;
  private _lib: LibGit2;
  private _closed = false;

  /**
   * Create an Index instance from a pointer
   * @internal
   */
  constructor(ptr: Pointer, lib?: LibGit2) {
    if (ptr === null) {
      throw new GitError("Invalid index pointer", GitErrorCode.EINVALID);
    }
    this._ptr = ptr;
    this._lib = lib ?? getLibrary();
  }

  /**
   * Get the raw pointer (for advanced usage)
   */
  get pointer(): Pointer {
    this.ensureOpen();
    return this._ptr;
  }

  /**
   * Check if the index is closed
   */
  get isClosed(): boolean {
    return this._closed;
  }

  /**
   * Ensure the index is open
   */
  private ensureOpen(): void {
    if (this._closed) {
      throw new GitError("Index is closed", GitErrorCode.EINVALID);
    }
  }

  /**
   * Get the index for a repository
   */
  static fromRepository(repo: Repository): Index {
    const lib = getLibrary();
    const outPtr = createOutPointer();

    const result = lib.symbols.git_repository_index(
      ptrOf(outPtr),
      repo.pointer,
    );
    checkError(lib, result, "Failed to get repository index");

    return new Index(readPointer(outPtr));
  }

  /**
   * Open an index file directly
   * @param path - Path to the index file
   */
  static open(path: string): Index {
    const lib = getLibrary();
    const outPtr = createOutPointer();
    const pathBuf = toCString(path);

    const result = lib.symbols.git_index_open(
      ptrOf(outPtr),
      ptrOf(pathBuf),
    );
    checkError(lib, result, `Failed to open index at ${path}`);

    return new Index(readPointer(outPtr));
  }

  /**
   * Close the index and free resources
   */
  close(): void {
    if (!this._closed && this._ptr !== null) {
      this._lib.symbols.git_index_free(this._ptr);
      this._ptr = null;
      this._closed = true;
    }
  }

  /**
   * Alias for close()
   */
  free(): void {
    this.close();
  }

  [Symbol.dispose](): void {
    this.close();
  }

  /**
   * Read the index from disk
   * @param force - Force read even if index is up to date
   */
  read(force = false): void {
    this.ensureOpen();
    const result = this._lib.symbols.git_index_read(this._ptr, force ? 1 : 0);
    checkError(this._lib, result, "Failed to read index");
  }

  /**
   * Write the index to disk
   */
  write(): void {
    this.ensureOpen();
    const result = this._lib.symbols.git_index_write(this._ptr);
    checkError(this._lib, result, "Failed to write index");
  }

  /**
   * Get the number of entries in the index
   */
  get entryCount(): number {
    this.ensureOpen();
    return Number(this._lib.symbols.git_index_entrycount(this._ptr));
  }

  /**
   * Check if the index has conflicts
   */
  get hasConflicts(): boolean {
    this.ensureOpen();
    return this._lib.symbols.git_index_has_conflicts(this._ptr) !== 0;
  }

  /**
   * Get an entry by index
   * @param index - The entry index
   */
  getByIndex(index: number): IndexEntry | null {
    this.ensureOpen();
    const entryPtr = this._lib.symbols.git_index_get_byindex(
      this._ptr,
      BigInt(index),
    );
    if (entryPtr === null) {
      return null;
    }
    return this.readIndexEntry(entryPtr);
  }

  /**
   * Get an entry by path
   * @param path - The file path
   * @param stage - The stage number (0 for normal)
   */
  getByPath(path: string, stage = 0): IndexEntry | null {
    this.ensureOpen();
    const pathBuf = toCString(path);
    const entryPtr = this._lib.symbols.git_index_get_bypath(
      this._ptr,
      ptrOf(pathBuf),
      stage,
    );
    if (entryPtr === null) {
      return null;
    }
    return this.readIndexEntry(entryPtr);
  }

  /**
   * Add a file to the index by path
   * @param path - Path to the file (relative to working directory)
   */
  add(path: string): void {
    this.ensureOpen();
    const pathBuf = toCString(path);
    const result = this._lib.symbols.git_index_add_bypath(
      this._ptr,
      ptrOf(pathBuf),
    );
    checkError(this._lib, result, `Failed to add ${path} to index`);
  }

  /**
   * Add multiple files to the index
   * @param paths - Paths to add
   */
  addAll(paths: string[]): void {
    for (const path of paths) {
      this.add(path);
    }
  }

  /**
   * Remove a file from the index by path
   * @param path - Path to the file
   */
  remove(path: string): void {
    this.ensureOpen();
    const pathBuf = toCString(path);
    const result = this._lib.symbols.git_index_remove_bypath(
      this._ptr,
      ptrOf(pathBuf),
    );
    checkError(this._lib, result, `Failed to remove ${path} from index`);
  }

  /**
   * Write the index as a tree object
   * @returns The OID of the created tree
   */
  writeTree(): string {
    this.ensureOpen();
    const oidBuf = new Uint8Array(20);
    const result = this._lib.symbols.git_index_write_tree(
      ptrOf(oidBuf),
      this._ptr,
    );
    checkError(this._lib, result, "Failed to write tree from index");
    return readOidHex(ptrOf(oidBuf)) ?? "";
  }

  /**
   * Write the index as a tree object to a specific repository
   * @param repo - The repository to write to
   * @returns The OID of the created tree
   */
  writeTreeTo(repo: Repository): string {
    this.ensureOpen();
    const oidBuf = new Uint8Array(20);
    const result = this._lib.symbols.git_index_write_tree_to(
      ptrOf(oidBuf),
      this._ptr,
      repo.pointer,
    );
    checkError(this._lib, result, "Failed to write tree from index");
    return readOidHex(ptrOf(oidBuf)) ?? "";
  }

  /**
   * Get all entries in the index
   */
  entries(): IndexEntry[] {
    this.ensureOpen();
    const count = this.entryCount;
    const entries: IndexEntry[] = [];

    for (let i = 0; i < count; i++) {
      const entry = this.getByIndex(i);
      if (entry !== null) {
        entries.push(entry);
      }
    }

    return entries;
  }

  /**
   * Iterate over all entries
   */
  *[Symbol.iterator](): Generator<IndexEntry> {
    const count = this.entryCount;
    for (let i = 0; i < count; i++) {
      const entry = this.getByIndex(i);
      if (entry !== null) {
        yield entry;
      }
    }
  }

  /**
   * Read an index entry from a pointer
   */
  private readIndexEntry(entryPtr: Pointer): IndexEntry {
    const view = new Deno.UnsafePointerView(entryPtr!);

    // git_index_entry structure layout:
    // ctime (8), mtime (8), dev (4), ino (4), mode (4), uid (4), gid (4),
    // file_size (4), oid (20), flags (2), flags_extended (2), path (pointer)

    const mode = view.getUint32(INDEX_ENTRY_MODE_OFFSET);

    const fileSize = view.getUint32(INDEX_ENTRY_FILE_SIZE_OFFSET);

    // Read OID
    const oidBytes = new Uint8Array(20);
    for (let i = 0; i < 20; i++) {
      oidBytes[i] = view.getUint8(INDEX_ENTRY_OID_OFFSET + i);
    }
    const oid = Array.from(oidBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Read flags (contains stage in bits 12-13)
    const flags = view.getUint16(INDEX_ENTRY_FLAGS_OFFSET);
    const stage = (flags >> 12) & 0x3;

    const pathPtrValue = readPointerValueFromPtrView(
      view,
      INDEX_ENTRY_PATH_OFFSET,
    );
    const pathPtr = pathPtrValue === 0n
      ? null
      : Deno.UnsafePointer.create(pathPtrValue);
    const path = fromCString(pathPtr) ?? "";

    return { path, oid, mode, fileSize, stage };
  }

  /**
   * Use the index with automatic cleanup
   */
  static use<T>(repo: Repository, fn: (index: Index) => T): T {
    using index = Index.fromRepository(repo);
    return fn(index);
  }
}
