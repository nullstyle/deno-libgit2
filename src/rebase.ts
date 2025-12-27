/**
 * @module rebase
 * Git rebase operations for libgit2
 */

import { getLibrary, type LibGit2 } from "./library.ts";
import { checkError, GitError } from "./error.ts";
import { GitErrorCode, type Pointer } from "./types.ts";
import {
  createOutPointer,
  fromCString,
  POINTER_SIZE,
  ptrOf,
  readOidHex,
  readPointer,
  readPointerValueFromPtrView,
  toCString,
} from "./utils.ts";
import type { AnnotatedCommit } from "./merge.ts";
import { Signature, type SignatureInfo } from "./signature.ts";

/**
 * Rebase operation types
 */
export enum GitRebaseOperationType {
  /** Cherry-pick the commit */
  PICK = 0,
  /** Cherry-pick with updated message */
  REWORD = 1,
  /** Cherry-pick, stop for editing */
  EDIT = 2,
  /** Squash into previous commit */
  SQUASH = 3,
  /** Squash, discard message */
  FIXUP = 4,
  /** Run command */
  EXEC = 5,
}

function alignOffset(value: number, alignment: number): number {
  return Math.ceil(value / alignment) * alignment;
}

/**
 * Rebase options
 */
export interface RebaseOptions {
  /** Quiet rebase experience */
  quiet?: boolean;
  /** In-memory rebase (no working dir changes) */
  inmemory?: boolean;
  /** Notes reference for rewriting */
  rewriteNotesRef?: string;
}

/**
 * Rebase operation information
 */
export interface RebaseOperation {
  /** Operation type */
  type: GitRebaseOperationType;
  /** Commit OID being operated on */
  id: string;
  /** Command to run (for EXEC type) */
  exec: string | null;
}

/**
 * Options for committing a rebase operation
 */
export interface RebaseCommitOptions {
  /** Author signature (optional, uses original if not provided) */
  author?: SignatureInfo;
  /** Committer signature (required) */
  committer: SignatureInfo;
  /** Commit message (optional, uses original if not provided) */
  message?: string;
  /** Message encoding (optional, defaults to UTF-8) */
  messageEncoding?: string;
}

/**
 * Represents a git rebase operation
 */
export class Rebase {
  private _ptr: Pointer;
  private _lib: LibGit2;
  private _repoPtr: Pointer;
  private _closed = false;

  constructor(ptr: Pointer, repoPtr: Pointer) {
    if (ptr === null) {
      throw new GitError("Invalid rebase pointer", GitErrorCode.EINVALID);
    }
    this._ptr = ptr;
    this._repoPtr = repoPtr;
    this._lib = getLibrary();
  }

  /**
   * Get the raw pointer
   */
  get pointer(): Pointer {
    return this._ptr;
  }

  /**
   * Get the number of rebase operations
   */
  get operationCount(): number {
    this.ensureOpen();
    return Number(this._lib.symbols.git_rebase_operation_entrycount(this._ptr));
  }

  /**
   * Get the current operation index
   * Returns SIZE_MAX if no operation is in progress
   */
  get currentOperation(): number {
    this.ensureOpen();
    return Number(this._lib.symbols.git_rebase_operation_current(this._ptr));
  }

  /**
   * Get a rebase operation by index
   */
  getOperation(index: number): RebaseOperation | null {
    this.ensureOpen();
    const opPtr = this._lib.symbols.git_rebase_operation_byindex(
      this._ptr,
      BigInt(index),
    );
    if (opPtr === null) {
      return null;
    }
    return this.readOperation(opPtr);
  }

  /**
   * Perform the next rebase operation
   * Returns null when there are no more operations
   */
  next(): RebaseOperation | null {
    this.ensureOpen();
    const outPtr = createOutPointer();

    const result = this._lib.symbols.git_rebase_next(ptrOf(outPtr), this._ptr);

    // GIT_ITEROVER (-31) means no more operations
    if (result === -31) {
      return null;
    }

    checkError(this._lib, result, "Failed to perform next rebase operation");

    const opPtr = readPointer(outPtr);
    if (opPtr === null) {
      return null;
    }

    return this.readOperation(opPtr);
  }

  /**
   * Commit the current rebase operation
   * @param options - Commit options including author, committer, and message
   * @returns The new commit OID
   */
  commit(options: RebaseCommitOptions): string {
    this.ensureOpen();

    const oidBuf = new Uint8Array(20);

    // Create author signature if provided
    let authorSig: Signature | null = null;
    if (options.author) {
      authorSig = Signature.fromInfo(options.author, this._lib);
    }

    // Create committer signature (required)
    const committerSig = Signature.fromInfo(options.committer, this._lib);

    // Prepare message
    const messageBuf = options.message ? toCString(options.message) : null;
    const encodingBuf = options.messageEncoding
      ? toCString(options.messageEncoding)
      : null;

    try {
      const result = this._lib.symbols.git_rebase_commit(
        ptrOf(oidBuf),
        this._ptr,
        authorSig?.ptr ?? null,
        committerSig.ptr,
        encodingBuf ? ptrOf(encodingBuf) : null,
        messageBuf ? ptrOf(messageBuf) : null,
      );

      checkError(this._lib, result, "Failed to commit rebase operation");

      const oid = readOidHex(ptrOf(oidBuf));
      if (!oid) {
        throw new GitError(
          "Failed to read rebase commit OID",
          GitErrorCode.ERROR,
        );
      }
      return oid;
    } finally {
      // Clean up signatures
      if (authorSig) {
        authorSig.free();
      }
      committerSig.free();
    }
  }

  /**
   * Abort the rebase operation
   */
  abort(): void {
    this.ensureOpen();
    const result = this._lib.symbols.git_rebase_abort(this._ptr);
    checkError(this._lib, result, "Failed to abort rebase");
  }

  /**
   * Finish the rebase operation
   * @param signature - Signature for reflog (optional)
   */
  finish(signature?: SignatureInfo): void {
    this.ensureOpen();

    let sig: Signature | null = null;
    if (signature) {
      sig = Signature.fromInfo(signature, this._lib);
    }

    try {
      const result = this._lib.symbols.git_rebase_finish(
        this._ptr,
        sig?.ptr ?? null,
      );
      checkError(this._lib, result, "Failed to finish rebase");
    } finally {
      if (sig) {
        sig.free();
      }
    }
  }

  /**
   * Free the rebase object
   */
  free(): void {
    if (!this._closed && this._ptr !== null) {
      this._lib.symbols.git_rebase_free(this._ptr);
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
      throw new GitError("Rebase has been freed", GitErrorCode.EINVALID);
    }
  }

  /**
   * Read a rebase operation from a pointer
   */
  private readOperation(ptr: Pointer): RebaseOperation {
    if (!ptr) {
      throw new GitError(
        "Invalid rebase operation pointer",
        GitErrorCode.EINVALID,
      );
    }
    const view = new Deno.UnsafePointerView(ptr);

    // git_rebase_operation struct:
    // - git_rebase_operation_t type (4 bytes, enum/int)
    // - git_oid id (20 bytes)
    // - const char *exec (8 bytes pointer)

    const type = view.getInt32(0) as GitRebaseOperationType;

    // Read OID bytes (20 bytes starting at offset 4)
    const oidBytes = new Uint8Array(20);
    for (let i = 0; i < 20; i++) {
      oidBytes[i] = view.getUint8(4 + i);
    }
    const id = Array.from(oidBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Read exec pointer (at offset 24, after 4 bytes type + 20 bytes oid)
    const execOffset = alignOffset(4 + 20, POINTER_SIZE);
    const execPtrValue = readPointerValueFromPtrView(view, execOffset);
    const execPtr = execPtrValue === 0n
      ? null
      : Deno.UnsafePointer.create(execPtrValue);
    const exec = fromCString(execPtr);

    return { type, id, exec };
  }
}

/**
 * Initialize a new rebase operation
 */
export function initRebase(
  lib: LibGit2,
  repoPtr: Pointer,
  branch: AnnotatedCommit,
  upstream: AnnotatedCommit,
  onto?: AnnotatedCommit,
  _options?: RebaseOptions,
): Rebase {
  const outPtr = createOutPointer();

  // For now, we pass null for options (use defaults)
  // Full options support would require creating the options struct
  const result = lib.symbols.git_rebase_init(
    ptrOf(outPtr),
    repoPtr,
    branch.ptr,
    upstream.ptr,
    onto?.ptr ?? null,
    null, // options
  );

  checkError(lib, result, "Failed to initialize rebase");

  return new Rebase(readPointer(outPtr), repoPtr);
}

/**
 * Open an existing rebase operation
 */
export function openRebase(
  lib: LibGit2,
  repoPtr: Pointer,
  _options?: RebaseOptions,
): Rebase {
  const outPtr = createOutPointer();

  const result = lib.symbols.git_rebase_open(
    ptrOf(outPtr),
    repoPtr,
    null, // options
  );

  checkError(lib, result, "Failed to open rebase");

  return new Rebase(readPointer(outPtr), repoPtr);
}
