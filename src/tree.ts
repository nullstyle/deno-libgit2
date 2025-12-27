/**
 * @module tree
 * Git tree operations for navigating repository file structure
 */

import { getLibrary, type LibGit2 } from "./library.ts";
import { checkError, GitError } from "./error.ts";
import { GitErrorCode, GitObjectType, type Pointer } from "./types.ts";
import {
  createOutPointer,
  fromCString,
  ptrOf,
  readOidHex,
  readPointer,
  toCString,
} from "./utils.ts";
import type { Repository } from "./repository.ts";

/**
 * File mode for tree entries
 */
export enum GitFileMode {
  /** Unreadable */
  UNREADABLE = 0o000000,
  /** Tree (directory) */
  TREE = 0o040000,
  /** Blob (file) */
  BLOB = 0o100644,
  /** Blob executable */
  BLOB_EXECUTABLE = 0o100755,
  /** Symbolic link */
  LINK = 0o120000,
  /** Commit (submodule) */
  COMMIT = 0o160000,
}

/**
 * Information about a tree entry
 */
export interface TreeEntryInfo {
  /** Entry name (filename or directory name) */
  name: string;
  /** Entry OID */
  oid: string;
  /** Object type (tree, blob, commit) */
  type: GitObjectType;
  /** File mode */
  filemode: GitFileMode;
}

/**
 * Represents a Git tree entry
 */
export class TreeEntry {
  private _ptr: Pointer;
  private _lib: LibGit2;
  private _owned: boolean;

  /**
   * Create a TreeEntry instance from a pointer
   * @param ptr - The tree entry pointer
   * @param owned - Whether this instance owns the pointer (should free it)
   * @internal
   */
  constructor(ptr: Pointer, owned = false) {
    if (ptr === null) {
      throw new GitError("Invalid tree entry pointer", GitErrorCode.EINVALID);
    }
    this._ptr = ptr;
    this._lib = getLibrary();
    this._owned = owned;
  }

  /**
   * Get the raw pointer
   */
  get pointer(): Pointer {
    return this._ptr;
  }

  /**
   * Get the entry name
   */
  get name(): string {
    const namePtr = this._lib.symbols.git_tree_entry_name(this._ptr);
    return fromCString(namePtr) ?? "";
  }

  /**
   * Get the entry OID
   */
  get oid(): string {
    const oidPtr = this._lib.symbols.git_tree_entry_id(this._ptr);
    return readOidHex(oidPtr) ?? "";
  }

  /**
   * Get the entry type
   */
  get type(): GitObjectType {
    return this._lib.symbols.git_tree_entry_type(this._ptr) as GitObjectType;
  }

  /**
   * Get the file mode
   */
  get filemode(): GitFileMode {
    return this._lib.symbols.git_tree_entry_filemode(this._ptr) as GitFileMode;
  }

  /**
   * Check if this entry is a tree (directory)
   */
  get isTree(): boolean {
    return this.type === GitObjectType.TREE;
  }

  /**
   * Check if this entry is a blob (file)
   */
  get isBlob(): boolean {
    return this.type === GitObjectType.BLOB;
  }

  /**
   * Check if this entry is a submodule
   */
  get isSubmodule(): boolean {
    return this.type === GitObjectType.COMMIT;
  }

  /**
   * Get entry information as a plain object
   */
  toInfo(): TreeEntryInfo {
    return {
      name: this.name,
      oid: this.oid,
      type: this.type,
      filemode: this.filemode,
    };
  }

  /**
   * Free the tree entry if owned
   */
  free(): void {
    if (this._owned && this._ptr !== null) {
      this._lib.symbols.git_tree_entry_free(this._ptr);
      this._ptr = null;
    }
  }

  [Symbol.dispose](): void {
    this.free();
  }
}

/**
 * Represents a Git tree (directory listing)
 */
export class Tree {
  private _ptr: Pointer;
  private _lib: LibGit2;
  private _closed = false;

  /**
   * Create a Tree instance from a pointer
   * @internal
   */
  constructor(ptr: Pointer) {
    if (ptr === null) {
      throw new GitError("Invalid tree pointer", GitErrorCode.EINVALID);
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
   * Check if the tree is closed
   */
  get isClosed(): boolean {
    return this._closed;
  }

  /**
   * Ensure the tree is open
   */
  private ensureOpen(): void {
    if (this._closed) {
      throw new GitError("Tree is closed", GitErrorCode.EINVALID);
    }
  }

  /**
   * Lookup a tree by OID
   * @param repo - The repository
   * @param oid - The tree OID (hex string)
   */
  static lookup(repo: Repository, oid: string): Tree {
    const lib = getLibrary();
    const outPtr = createOutPointer();
    const oidBuf = new Uint8Array(20);
    const oidStr = toCString(oid);

    const parseResult = lib.symbols.git_oid_fromstr(
      ptrOf(oidBuf),
      ptrOf(oidStr),
    );
    checkError(lib, parseResult, `Invalid OID: ${oid}`);

    const result = lib.symbols.git_tree_lookup(
      ptrOf(outPtr),
      repo.pointer,
      ptrOf(oidBuf),
    );
    checkError(lib, result, `Failed to lookup tree ${oid}`);

    return new Tree(readPointer(outPtr));
  }

  /**
   * Close the tree and free resources
   */
  close(): void {
    if (!this._closed && this._ptr !== null) {
      this._lib.symbols.git_tree_free(this._ptr);
      this._ptr = null;
      this._closed = true;
    }
  }

  [Symbol.dispose](): void {
    this.close();
  }

  /**
   * Get the tree OID
   */
  get oid(): string {
    this.ensureOpen();
    const oidPtr = this._lib.symbols.git_tree_id(this._ptr);
    return readOidHex(oidPtr) ?? "";
  }

  /**
   * Get the number of entries in the tree
   */
  get entryCount(): number {
    this.ensureOpen();
    return Number(this._lib.symbols.git_tree_entrycount(this._ptr));
  }

  /**
   * Get an entry by index
   * @param index - The entry index
   */
  getByIndex(index: number): TreeEntry | null {
    this.ensureOpen();
    const entryPtr = this._lib.symbols.git_tree_entry_byindex(
      this._ptr,
      BigInt(index),
    );
    if (entryPtr === null) {
      return null;
    }
    // Entry is owned by the tree, not the caller
    return new TreeEntry(entryPtr, false);
  }

  /**
   * Get an entry by name (only looks at immediate children)
   * @param name - The entry name
   */
  getByName(name: string): TreeEntry | null {
    this.ensureOpen();
    const nameBuf = toCString(name);
    const entryPtr = this._lib.symbols.git_tree_entry_byname(
      this._ptr,
      ptrOf(nameBuf),
    );
    if (entryPtr === null) {
      return null;
    }
    // Entry is owned by the tree, not the caller
    return new TreeEntry(entryPtr, false);
  }

  /**
   * Get an entry by path (can traverse subdirectories)
   * @param path - The path to the entry (e.g., "src/lib/file.ts")
   */
  getByPath(path: string): TreeEntry | null {
    this.ensureOpen();
    const outPtr = createOutPointer();
    const pathBuf = toCString(path);

    const result = this._lib.symbols.git_tree_entry_bypath(
      ptrOf(outPtr),
      this._ptr,
      ptrOf(pathBuf),
    );

    if (result < 0) {
      return null;
    }

    // Entry from bypath is owned by the caller
    return new TreeEntry(readPointer(outPtr), true);
  }

  /**
   * Check if a path exists in this tree
   * @param path - The path to check
   */
  hasPath(path: string): boolean {
    const entry = this.getByPath(path);
    if (entry !== null) {
      entry.free();
      return true;
    }
    return false;
  }

  /**
   * Get all entries in the tree
   */
  entries(): TreeEntryInfo[] {
    this.ensureOpen();
    const count = this.entryCount;
    const entries: TreeEntryInfo[] = [];

    for (let i = 0; i < count; i++) {
      const entry = this.getByIndex(i);
      if (entry !== null) {
        entries.push(entry.toInfo());
      }
    }

    return entries;
  }

  /**
   * Iterate over all entries
   */
  *[Symbol.iterator](): Generator<TreeEntryInfo> {
    const count = this.entryCount;
    for (let i = 0; i < count; i++) {
      const entry = this.getByIndex(i);
      if (entry !== null) {
        yield entry.toInfo();
      }
    }
  }

  /**
   * Use the tree with automatic cleanup
   */
  static use<T>(repo: Repository, oid: string, fn: (tree: Tree) => T): T {
    using tree = Tree.lookup(repo, oid);
    return fn(tree);
  }
}

/**
 * Get a tree entry by path from a commit's tree
 * @param repo - The repository
 * @param treeOid - The tree OID
 * @param path - The path to the entry
 */
export function getTreeEntryByPath(
  repo: Repository,
  treeOid: string,
  path: string,
): TreeEntryInfo | null {
  return Tree.use(repo, treeOid, (tree) => {
    const entry = tree.getByPath(path);
    if (entry === null) {
      return null;
    }
    const info = entry.toInfo();
    entry.free();
    return info;
  });
}

/**
 * Check if a path exists in a tree
 * @param repo - The repository
 * @param treeOid - The tree OID
 * @param path - The path to check
 */
export function treeHasPath(
  repo: Repository,
  treeOid: string,
  path: string,
): boolean {
  return Tree.use(repo, treeOid, (tree) => tree.hasPath(path));
}
