/**
 * @module merge
 * Merge operations for libgit2
 */

import type { LibGit2 } from "./library.ts";
import { Index } from "./index.ts";
import {
  type AnnotatedCommitInfo,
  type ConflictEntry,
  GitMergeAnalysis,
  GitMergePreference,
  type MergeAnalysisResult,
  type MergeOptions,
  type Pointer,
} from "./types.ts";
import {
  createOutPointer,
  Defer,
  fromCString,
  POINTER_SIZE,
  ptrOf,
  readOidHex,
  readPointer,
  readPointerValueFromPtrView,
  toCString,
  writePointerValue,
} from "./utils.ts";
import { checkError } from "./error.ts";

const INDEX_ENTRY_OID_OFFSET = 40;
const INDEX_ENTRY_PATH_OFFSET = 64;

/**
 * Represents an annotated commit for merge operations
 */
export class AnnotatedCommit {
  private _ptr: Pointer;
  private _lib: LibGit2;
  private _closed = false;

  constructor(ptr: Pointer, lib: LibGit2) {
    this._ptr = ptr;
    this._lib = lib;
  }

  /**
   * Get the raw pointer
   */
  get ptr(): Pointer {
    return this._ptr;
  }

  /**
   * Get the commit ID
   */
  get id(): string {
    this.ensureOpen();
    const oidPtr = this._lib.symbols.git_annotated_commit_id(this._ptr);
    return readOidHex(oidPtr) ?? "";
  }

  /**
   * Get the reference name (if created from a reference)
   */
  get ref(): string | null {
    this.ensureOpen();
    const refPtr = this._lib.symbols.git_annotated_commit_ref(this._ptr);
    return fromCString(refPtr);
  }

  /**
   * Get info about this annotated commit
   */
  get info(): AnnotatedCommitInfo {
    return {
      id: this.id,
      ref: this.ref ?? undefined,
    };
  }

  /**
   * Free the annotated commit
   */
  free(): void {
    if (!this._closed && this._ptr !== null) {
      this._lib.symbols.git_annotated_commit_free(this._ptr);
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

  private ensureOpen(): void {
    if (this._closed) {
      throw new Error("AnnotatedCommit has been freed");
    }
  }

  /**
   * Create an annotated commit from a reference
   */
  static fromRef(
    lib: LibGit2,
    repoPtr: Pointer,
    refPtr: Pointer,
  ): AnnotatedCommit {
    const outPtr = createOutPointer();
    const result = lib.symbols.git_annotated_commit_from_ref(
      ptrOf(outPtr),
      repoPtr,
      refPtr,
    );
    checkError(lib, result, "Failed to create annotated commit from reference");
    return new AnnotatedCommit(readPointer(outPtr), lib);
  }

  /**
   * Create an annotated commit from an OID
   */
  static lookup(
    lib: LibGit2,
    repoPtr: Pointer,
    oidHex: string,
  ): AnnotatedCommit {
    const outPtr = createOutPointer();
    const oidBuf = new Uint8Array(20);
    const oidStr = toCString(oidHex);

    const parseResult = lib.symbols.git_oid_fromstr(
      ptrOf(oidBuf),
      ptrOf(oidStr),
    );
    checkError(lib, parseResult, "Failed to parse OID");

    const result = lib.symbols.git_annotated_commit_lookup(
      ptrOf(outPtr),
      repoPtr,
      ptrOf(oidBuf),
    );
    checkError(lib, result, "Failed to lookup annotated commit");
    return new AnnotatedCommit(readPointer(outPtr), lib);
  }

  /**
   * Create an annotated commit from a revspec string
   */
  static fromRevspec(
    lib: LibGit2,
    repoPtr: Pointer,
    revspec: string,
  ): AnnotatedCommit {
    const outPtr = createOutPointer();
    const revspecStr = toCString(revspec);

    const result = lib.symbols.git_annotated_commit_from_revspec(
      ptrOf(outPtr),
      repoPtr,
      ptrOf(revspecStr),
    );
    checkError(lib, result, "Failed to create annotated commit from revspec");
    return new AnnotatedCommit(readPointer(outPtr), lib);
  }
}

/**
 * Find the merge base between two commits
 */
export function mergeBase(
  lib: LibGit2,
  repoPtr: Pointer,
  oneOid: string,
  twoOid: string,
): string {
  const outOid = new Uint8Array(20);
  const oneOidBuf = new Uint8Array(20);
  const twoOidBuf = new Uint8Array(20);

  const oneStr = toCString(oneOid);
  const twoStr = toCString(twoOid);

  let result = lib.symbols.git_oid_fromstr(ptrOf(oneOidBuf), ptrOf(oneStr));
  checkError(lib, result, "Failed to parse first OID");

  result = lib.symbols.git_oid_fromstr(ptrOf(twoOidBuf), ptrOf(twoStr));
  checkError(lib, result, "Failed to parse second OID");

  result = lib.symbols.git_merge_base(
    ptrOf(outOid),
    repoPtr,
    ptrOf(oneOidBuf),
    ptrOf(twoOidBuf),
  );
  checkError(lib, result, "Failed to find merge base");

  return readOidHex(ptrOf(outOid)) ?? "";
}

/**
 * Analyze merge possibilities
 */
export function mergeAnalysis(
  lib: LibGit2,
  repoPtr: Pointer,
  annotatedCommits: AnnotatedCommit[],
): MergeAnalysisResult {
  // Use Uint8Array for the output values (4 bytes each for i32)
  const analysisOut = new Uint8Array(4);
  const preferenceOut = new Uint8Array(4);

  // Create array of annotated commit pointers
  const commitPtrs = new Uint8Array(annotatedCommits.length * POINTER_SIZE);
  const commitPtrsView = new DataView(
    commitPtrs.buffer,
    commitPtrs.byteOffset,
    commitPtrs.byteLength,
  );
  for (let i = 0; i < annotatedCommits.length; i++) {
    const ptrValue = Deno.UnsafePointer.value(annotatedCommits[i].ptr);
    writePointerValue(commitPtrsView, i * POINTER_SIZE, BigInt(ptrValue));
  }

  const result = lib.symbols.git_merge_analysis(
    ptrOf(analysisOut),
    ptrOf(preferenceOut),
    repoPtr,
    ptrOf(commitPtrs),
    BigInt(annotatedCommits.length),
  );
  checkError(lib, result, "Failed to analyze merge");

  const analysisView = new DataView(analysisOut.buffer);
  const preferenceView = new DataView(preferenceOut.buffer);
  const analysis = analysisView.getUint32(0, true) as GitMergeAnalysis;
  const preference = preferenceView.getUint32(0, true) as GitMergePreference;

  return {
    analysis,
    preference,
    canFastForward: (analysis & GitMergeAnalysis.FASTFORWARD) !== 0,
    isUpToDate: (analysis & GitMergeAnalysis.UP_TO_DATE) !== 0,
    requiresNormalMerge: (analysis & GitMergeAnalysis.NORMAL) !== 0,
    isUnborn: (analysis & GitMergeAnalysis.UNBORN) !== 0,
  };
}

/**
 * Merge commits into an index (does not modify working directory)
 */
export function mergeCommits(
  lib: LibGit2,
  repoPtr: Pointer,
  ourCommitOid: string,
  theirCommitOid: string,
  _options?: MergeOptions,
): Index {
  const outPtr = createOutPointer();
  const defer = new Defer();

  // Lookup our commit
  const ourCommitPtr = createOutPointer();
  const ourOidBuf = new Uint8Array(20);
  const ourOidStr = toCString(ourCommitOid);

  let result = lib.symbols.git_oid_fromstr(ptrOf(ourOidBuf), ptrOf(ourOidStr));
  checkError(lib, result, "Failed to parse our OID");

  result = lib.symbols.git_commit_lookup(
    ptrOf(ourCommitPtr),
    repoPtr,
    ptrOf(ourOidBuf),
  );
  checkError(lib, result, "Failed to lookup our commit");
  defer.add(() => lib.symbols.git_commit_free(readPointer(ourCommitPtr)));

  // Lookup their commit
  const theirCommitPtr = createOutPointer();
  const theirOidBuf = new Uint8Array(20);
  const theirOidStr = toCString(theirCommitOid);

  result = lib.symbols.git_oid_fromstr(ptrOf(theirOidBuf), ptrOf(theirOidStr));
  checkError(lib, result, "Failed to parse their OID");

  result = lib.symbols.git_commit_lookup(
    ptrOf(theirCommitPtr),
    repoPtr,
    ptrOf(theirOidBuf),
  );
  checkError(lib, result, "Failed to lookup their commit");
  defer.add(() => lib.symbols.git_commit_free(readPointer(theirCommitPtr)));

  // Merge commits
  result = lib.symbols.git_merge_commits(
    ptrOf(outPtr),
    repoPtr,
    readPointer(ourCommitPtr),
    readPointer(theirCommitPtr),
    null, // Use default options
  );

  defer.run();
  checkError(lib, result, "Failed to merge commits");

  // Index constructor only takes pointer, lib is obtained via getLibrary()
  return new Index(readPointer(outPtr));
}

/**
 * Perform a merge operation (modifies working directory)
 */
export function merge(
  lib: LibGit2,
  repoPtr: Pointer,
  annotatedCommits: AnnotatedCommit[],
  _mergeOptions?: MergeOptions,
): void {
  // Create array of annotated commit pointers
  const commitPtrs = new Uint8Array(annotatedCommits.length * POINTER_SIZE);
  const commitPtrsView = new DataView(
    commitPtrs.buffer,
    commitPtrs.byteOffset,
    commitPtrs.byteLength,
  );
  for (let i = 0; i < annotatedCommits.length; i++) {
    const ptrValue = Deno.UnsafePointer.value(annotatedCommits[i].ptr);
    writePointerValue(commitPtrsView, i * POINTER_SIZE, BigInt(ptrValue));
  }

  const result = lib.symbols.git_merge(
    repoPtr,
    ptrOf(commitPtrs),
    BigInt(annotatedCommits.length),
    null, // merge options
    null, // checkout options
  );
  checkError(lib, result, "Failed to perform merge");
}

/**
 * Clean up repository state after merge
 */
export function stateCleanup(lib: LibGit2, repoPtr: Pointer): void {
  const result = lib.symbols.git_repository_state_cleanup(repoPtr);
  checkError(lib, result, "Failed to cleanup repository state");
}

/**
 * Get conflicts from an index
 */
export function getConflicts(lib: LibGit2, indexPtr: Pointer): ConflictEntry[] {
  const conflicts: ConflictEntry[] = [];
  const iterPtr = createOutPointer();

  const result = lib.symbols.git_index_conflict_iterator_new(
    ptrOf(iterPtr),
    indexPtr,
  );
  if (result !== 0) {
    return conflicts; // No conflicts or error
  }

  const iter = readPointer(iterPtr);
  const defer = new Defer();
  defer.add(() => lib.symbols.git_index_conflict_iterator_free(iter));

  try {
    const ancestorPtr = createOutPointer();
    const oursPtr = createOutPointer();
    const theirsPtr = createOutPointer();

    while (true) {
      const nextResult = lib.symbols.git_index_conflict_next(
        ptrOf(ancestorPtr),
        ptrOf(oursPtr),
        ptrOf(theirsPtr),
        iter,
      );

      if (nextResult !== 0) {
        break; // End of iteration or error
      }

      // Read path from one of the entries (they should all have the same path)
      const entryPtr = readPointer(oursPtr) || readPointer(theirsPtr) ||
        readPointer(ancestorPtr);
      if (entryPtr === null) continue;

      const view = new Deno.UnsafePointerView(entryPtr);
      const pathPtrValue = readPointerValueFromPtrView(
        view,
        INDEX_ENTRY_PATH_OFFSET,
      );
      const pathPtr = pathPtrValue === 0n
        ? null
        : Deno.UnsafePointer.create(pathPtrValue);
      const path = fromCString(pathPtr) ?? "";

      conflicts.push({
        path,
        ancestorOid: readPointer(ancestorPtr)
          ? readOidFromEntry(readPointer(ancestorPtr))
          : undefined,
        oursOid: readPointer(oursPtr)
          ? readOidFromEntry(readPointer(oursPtr))
          : undefined,
        theirsOid: readPointer(theirsPtr)
          ? readOidFromEntry(readPointer(theirsPtr))
          : undefined,
      });
    }
  } finally {
    defer.run();
  }

  return conflicts;
}

/**
 * Read OID from index entry
 */
function readOidFromEntry(entryPtr: Pointer): string | undefined {
  if (entryPtr === null) return undefined;
  // git_index_entry has oid at offset 40 (after ctime, mtime, dev, ino, mode, uid, gid, file_size)
  const view = new Deno.UnsafePointerView(entryPtr!);
  const oidBytes = new Uint8Array(20);
  for (let i = 0; i < 20; i++) {
    oidBytes[i] = view.getUint8(INDEX_ENTRY_OID_OFFSET + i);
  }
  return Array.from(oidBytes).map((b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
}
