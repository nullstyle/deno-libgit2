/**
 * @module submodule
 * Git submodule operations for libgit2
 */

import { getLibrary, type LibGit2 } from "./library.ts";
import { checkError, GitError } from "./error.ts";
import { GitErrorCode, type Pointer } from "./types.ts";
import {
  createOutPointer,
  fromCString,
  ptrOf,
  readOidHex,
  readPointer,
  toCString,
} from "./utils.ts";

/**
 * Submodule ignore values
 */
export enum GitSubmoduleIgnore {
  /** Use the submodule's configuration */
  UNSPECIFIED = -1,
  /** Don't ignore any changes */
  NONE = 1,
  /** Ignore untracked files in the submodule */
  UNTRACKED = 2,
  /** Ignore changes to the working directory */
  DIRTY = 3,
  /** Ignore all changes */
  ALL = 4,
}

/**
 * Submodule update values
 */
export enum GitSubmoduleUpdate {
  /** Use the submodule's configuration */
  DEFAULT = 0,
  /** Checkout the commit */
  CHECKOUT = 1,
  /** Rebase onto the commit */
  REBASE = 2,
  /** Merge the commit */
  MERGE = 3,
  /** Don't update */
  NONE = 4,
}

/**
 * Submodule status flags
 */
export enum GitSubmoduleStatus {
  IN_HEAD = 1 << 0,
  IN_INDEX = 1 << 1,
  IN_CONFIG = 1 << 2,
  IN_WD = 1 << 3,
  INDEX_ADDED = 1 << 4,
  INDEX_DELETED = 1 << 5,
  INDEX_MODIFIED = 1 << 6,
  WD_UNINITIALIZED = 1 << 7,
  WD_ADDED = 1 << 8,
  WD_DELETED = 1 << 9,
  WD_MODIFIED = 1 << 10,
  WD_INDEX_MODIFIED = 1 << 11,
  WD_WD_MODIFIED = 1 << 12,
  WD_UNTRACKED = 1 << 13,
}

/**
 * Submodule information
 */
export interface SubmoduleInfo {
  /** Submodule name */
  name: string;
  /** Submodule path relative to repository root */
  path: string;
  /** Submodule URL */
  url: string | null;
  /** Submodule branch */
  branch: string | null;
  /** HEAD commit OID */
  headId: string | null;
  /** Index commit OID */
  indexId: string | null;
  /** Working directory commit OID */
  wdId: string | null;
}

/**
 * Represents a git submodule
 */
export class Submodule {
  private _ptr: Pointer;
  private _lib: LibGit2;
  private _closed = false;

  constructor(ptr: Pointer) {
    if (ptr === null) {
      throw new GitError("Invalid submodule pointer", GitErrorCode.EINVALID);
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
   * Get the submodule name
   */
  get name(): string {
    this.ensureOpen();
    const namePtr = this._lib.symbols.git_submodule_name(this._ptr);
    return fromCString(namePtr) ?? "";
  }

  /**
   * Get the submodule path relative to the repository root
   */
  get path(): string {
    this.ensureOpen();
    const pathPtr = this._lib.symbols.git_submodule_path(this._ptr);
    return fromCString(pathPtr) ?? "";
  }

  /**
   * Get the submodule URL
   */
  get url(): string | null {
    this.ensureOpen();
    const urlPtr = this._lib.symbols.git_submodule_url(this._ptr);
    return fromCString(urlPtr);
  }

  /**
   * Get the submodule branch
   */
  get branch(): string | null {
    this.ensureOpen();
    const branchPtr = this._lib.symbols.git_submodule_branch(this._ptr);
    return fromCString(branchPtr);
  }

  /**
   * Get the HEAD commit OID
   */
  get headId(): string | null {
    this.ensureOpen();
    const oidPtr = this._lib.symbols.git_submodule_head_id(this._ptr);
    if (oidPtr === null) return null;
    return readOidHex(oidPtr);
  }

  /**
   * Get the index commit OID
   */
  get indexId(): string | null {
    this.ensureOpen();
    const oidPtr = this._lib.symbols.git_submodule_index_id(this._ptr);
    if (oidPtr === null) return null;
    return readOidHex(oidPtr);
  }

  /**
   * Get the working directory commit OID
   */
  get wdId(): string | null {
    this.ensureOpen();
    const oidPtr = this._lib.symbols.git_submodule_wd_id(this._ptr);
    if (oidPtr === null) return null;
    return readOidHex(oidPtr);
  }

  /**
   * Get the ignore setting
   */
  get ignore(): GitSubmoduleIgnore {
    this.ensureOpen();
    return this._lib.symbols.git_submodule_ignore(
      this._ptr,
    ) as GitSubmoduleIgnore;
  }

  /**
   * Get the update strategy
   */
  get updateStrategy(): GitSubmoduleUpdate {
    this.ensureOpen();
    return this._lib.symbols.git_submodule_update_strategy(
      this._ptr,
    ) as GitSubmoduleUpdate;
  }

  /**
   * Get submodule info as a plain object
   */
  toInfo(): SubmoduleInfo {
    return {
      name: this.name,
      path: this.path,
      url: this.url,
      branch: this.branch,
      headId: this.headId,
      indexId: this.indexId,
      wdId: this.wdId,
    };
  }

  /**
   * Initialize the submodule
   * @param overwrite - Overwrite existing entries
   */
  init(overwrite = false): void {
    this.ensureOpen();
    const result = this._lib.symbols.git_submodule_init(
      this._ptr,
      overwrite ? 1 : 0,
    );
    checkError(this._lib, result, "Failed to initialize submodule");
  }

  /**
   * Sync the submodule
   */
  sync(): void {
    this.ensureOpen();
    const result = this._lib.symbols.git_submodule_sync(this._ptr);
    checkError(this._lib, result, "Failed to sync submodule");
  }

  /**
   * Reload the submodule info
   * @param force - Force reload even if unchanged
   */
  reload(force = false): void {
    this.ensureOpen();
    const result = this._lib.symbols.git_submodule_reload(
      this._ptr,
      force ? 1 : 0,
    );
    checkError(this._lib, result, "Failed to reload submodule");
  }

  /**
   * Get the location status
   */
  location(): number {
    this.ensureOpen();
    const statusBuf = new Uint32Array(1);
    const result = this._lib.symbols.git_submodule_location(
      ptrOf(statusBuf),
      this._ptr,
    );
    checkError(this._lib, result, "Failed to get submodule location");
    return statusBuf[0];
  }

  /**
   * Free the submodule object
   */
  free(): void {
    if (!this._closed && this._ptr !== null) {
      this._lib.symbols.git_submodule_free(this._ptr);
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
      throw new GitError("Submodule has been freed", GitErrorCode.EINVALID);
    }
  }
}

/**
 * Lookup a submodule by name or path
 */
export function lookupSubmodule(
  lib: LibGit2,
  repoPtr: Pointer,
  name: string,
): Submodule {
  const outPtr = createOutPointer();
  const nameBuf = toCString(name);

  const result = lib.symbols.git_submodule_lookup(
    ptrOf(outPtr),
    repoPtr,
    ptrOf(nameBuf),
  );
  checkError(lib, result, `Failed to lookup submodule: ${name}`);

  return new Submodule(readPointer(outPtr));
}

/**
 * Get the status of a submodule
 */
export function submoduleStatus(
  lib: LibGit2,
  repoPtr: Pointer,
  name: string,
  ignore: GitSubmoduleIgnore = GitSubmoduleIgnore.UNSPECIFIED,
): number {
  const statusBuf = new Uint32Array(1);
  const nameBuf = toCString(name);

  const result = lib.symbols.git_submodule_status(
    ptrOf(statusBuf),
    repoPtr,
    ptrOf(nameBuf),
    ignore,
  );
  checkError(lib, result, `Failed to get submodule status: ${name}`);

  return statusBuf[0];
}

/**
 * List all submodule names in a repository
 * Note: This uses a workaround since git_submodule_foreach requires callbacks
 */
export function listSubmodules(
  lib: LibGit2,
  repoPtr: Pointer,
): string[] {
  // We'll read .gitmodules file to get submodule names
  // This is a workaround since FFI callbacks are complex
  const names: string[] = [];

  // Try to read .gitmodules from the index
  try {
    // Get repository workdir
    const workdirPtr = lib.symbols.git_repository_workdir(repoPtr);
    if (workdirPtr === null) {
      return names;
    }
    const workdir = fromCString(workdirPtr);
    if (!workdir) {
      return names;
    }

    // Read .gitmodules file
    const gitmodulesPath = `${workdir}.gitmodules`;
    try {
      const content = Deno.readTextFileSync(gitmodulesPath);
      // Parse submodule names from [submodule "name"] sections
      const regex = /\[submodule\s+"([^"]+)"\]/g;
      let match;
      while ((match = regex.exec(content)) !== null) {
        names.push(match[1]);
      }
    } catch {
      // .gitmodules doesn't exist or can't be read
    }
  } catch {
    // Workdir not available (bare repo)
  }

  return names;
}

/**
 * Set the URL for a submodule
 */
export function setSubmoduleUrl(
  lib: LibGit2,
  repoPtr: Pointer,
  name: string,
  url: string,
): void {
  const nameBuf = toCString(name);
  const urlBuf = toCString(url);

  const result = lib.symbols.git_submodule_set_url(
    repoPtr,
    ptrOf(nameBuf),
    ptrOf(urlBuf),
  );
  checkError(lib, result, `Failed to set submodule URL: ${name}`);
}

/**
 * Set the branch for a submodule
 */
export function setSubmoduleBranch(
  lib: LibGit2,
  repoPtr: Pointer,
  name: string,
  branch: string,
): void {
  const nameBuf = toCString(name);
  const branchBuf = toCString(branch);

  const result = lib.symbols.git_submodule_set_branch(
    repoPtr,
    ptrOf(nameBuf),
    ptrOf(branchBuf),
  );
  checkError(lib, result, `Failed to set submodule branch: ${name}`);
}
