/**
 * @module commit
 * Git commit operations
 */

import { getLibrary } from "./library.ts";
import { checkError } from "./error.ts";
import type { GitSignature, Pointer } from "./types.ts";
import {
  createOutPointer,
  createPointerArray,
  Defer,
  fromCString,
  ptrOf,
  readOidHex,
  readPointer,
  readSignature,
  toCString,
  writePointerArrayValue,
} from "./utils.ts";
import type { Repository } from "./repository.ts";
import { Index } from "./index.ts";

/**
 * Options for creating a commit
 */
export interface CreateCommitOptions {
  /** Commit message */
  message: string;
  /** Author signature (defaults to repository default) */
  author?: SignatureInput;
  /** Committer signature (defaults to author) */
  committer?: SignatureInput;
  /** Reference to update (defaults to "HEAD") */
  updateRef?: string;
  /** Parent commit OIDs (defaults to current HEAD) */
  parents?: string[];
  /** Tree OID (if not provided, uses current index) */
  treeOid?: string;
}

/**
 * Input for creating a signature
 */
export interface SignatureInput {
  /** Name */
  name: string;
  /** Email */
  email: string;
  /** Time in seconds since epoch (defaults to now) */
  time?: number;
  /** Timezone offset in minutes (defaults to local) */
  offset?: number;
}

/**
 * Create a signature from input
 */
export function createSignature(
  input: SignatureInput,
): { ptr: Pointer; cleanup: () => void } {
  const lib = getLibrary();
  const outPtr = createOutPointer();
  const nameBuf = toCString(input.name);
  const emailBuf = toCString(input.email);

  let result: number;
  if (input.time !== undefined) {
    result = lib.symbols.git_signature_new(
      ptrOf(outPtr),
      ptrOf(nameBuf),
      ptrOf(emailBuf),
      BigInt(input.time),
      input.offset ?? 0,
    );
  } else {
    result = lib.symbols.git_signature_now(
      ptrOf(outPtr),
      ptrOf(nameBuf),
      ptrOf(emailBuf),
    );
  }

  checkError(lib, result, "Failed to create signature");

  const ptr = readPointer(outPtr);
  return {
    ptr,
    cleanup: () => lib.symbols.git_signature_free(ptr),
  };
}

/**
 * Get the default signature for a repository
 */
export function getDefaultSignature(
  repo: Repository,
): { ptr: Pointer; cleanup: () => void } {
  const lib = getLibrary();
  const outPtr = createOutPointer();

  const result = lib.symbols.git_signature_default(
    ptrOf(outPtr),
    repo.pointer,
  );
  checkError(lib, result, "Failed to get default signature");

  const ptr = readPointer(outPtr);
  return {
    ptr,
    cleanup: () => lib.symbols.git_signature_free(ptr),
  };
}

/**
 * Create a new commit in the repository
 */
export function createCommit(
  repo: Repository,
  options: CreateCommitOptions,
): string {
  const lib = getLibrary();
  const defer = new Defer();

  try {
    // Create author signature
    let authorSig: { ptr: Pointer; cleanup: () => void };
    if (options.author) {
      authorSig = createSignature(options.author);
    } else {
      authorSig = getDefaultSignature(repo);
    }
    defer.add(authorSig.cleanup);

    // Create committer signature
    let committerSig: { ptr: Pointer; cleanup: () => void };
    if (options.committer) {
      committerSig = createSignature(options.committer);
      defer.add(committerSig.cleanup);
    } else {
      committerSig = authorSig;
    }

    // Get tree OID
    let treeOid: string;
    if (options.treeOid) {
      treeOid = options.treeOid;
    } else {
      // Write current index as tree
      const index = Index.fromRepository(repo);
      defer.add(() => index.close());
      treeOid = index.writeTree();
    }

    // Parse tree OID
    const treeOidBuf = new Uint8Array(20);
    const treeOidStr = toCString(treeOid);
    const parseTreeResult = lib.symbols.git_oid_fromstr(
      ptrOf(treeOidBuf),
      ptrOf(treeOidStr),
    );
    checkError(lib, parseTreeResult, `Invalid tree OID: ${treeOid}`);

    // Lookup tree
    const treePtr = createOutPointer();
    const treeLookupResult = lib.symbols.git_tree_lookup(
      ptrOf(treePtr),
      repo.pointer,
      ptrOf(treeOidBuf),
    );
    checkError(lib, treeLookupResult, `Failed to lookup tree ${treeOid}`);
    const tree = readPointer(treePtr);
    defer.add(() => lib.symbols.git_tree_free(tree));

    // Get parent commits
    let parentOids: string[];
    if (options.parents !== undefined) {
      parentOids = options.parents;
    } else {
      // Use HEAD as parent if it exists
      try {
        const headOid = repo.headOid();
        parentOids = [headOid];
      } catch {
        // No HEAD, this is the first commit
        parentOids = [];
      }
    }

    // Lookup parent commits
    const parentPtrs: Pointer[] = [];
    for (const parentOid of parentOids) {
      const oidBuf = new Uint8Array(20);
      const oidStr = toCString(parentOid);
      const parseResult = lib.symbols.git_oid_fromstr(
        ptrOf(oidBuf),
        ptrOf(oidStr),
      );
      checkError(lib, parseResult, `Invalid parent OID: ${parentOid}`);

      const commitPtr = createOutPointer();
      const lookupResult = lib.symbols.git_commit_lookup(
        ptrOf(commitPtr),
        repo.pointer,
        ptrOf(oidBuf),
      );
      checkError(
        lib,
        lookupResult,
        `Failed to lookup parent commit ${parentOid}`,
      );

      const commit = readPointer(commitPtr);
      parentPtrs.push(commit);
      defer.add(() => lib.symbols.git_commit_free(commit));
    }

    // Create array of parent pointers
    const parentsArray = createPointerArray(parentPtrs.length);
    for (let i = 0; i < parentPtrs.length; i++) {
      writePointerArrayValue(
        parentsArray,
        i,
        Deno.UnsafePointer.value(parentPtrs[i]!),
      );
    }

    // Create commit
    const newOidBuf = new Uint8Array(20);
    const messageBuf = toCString(options.message);
    const updateRefBuf = options.updateRef
      ? toCString(options.updateRef)
      : toCString("HEAD");

    const parentsPtr = parentPtrs.length > 0 ? ptrOf(parentsArray) : null;

    const result = lib.symbols.git_commit_create(
      ptrOf(newOidBuf),
      repo.pointer,
      ptrOf(updateRefBuf),
      authorSig.ptr,
      committerSig.ptr,
      null, // message encoding (UTF-8)
      ptrOf(messageBuf),
      tree,
      BigInt(parentPtrs.length),
      parentsPtr,
    );

    checkError(lib, result, "Failed to create commit");

    return readOidHex(ptrOf(newOidBuf)) ?? "";
  } finally {
    defer.run();
  }
}

/**
 * Amend the last commit
 */
export function amendCommit(
  repo: Repository,
  options: Partial<CreateCommitOptions>,
): string {
  const defer = new Defer();

  try {
    // Get HEAD commit
    const headOid = repo.headOid();
    const headCommit = repo.lookupCommit(headOid);

    // Use existing values if not provided
    const message = options.message ?? headCommit.message;
    const author = options.author ?? {
      name: headCommit.author.name,
      email: headCommit.author.email,
      time: Number(headCommit.author.when.time),
      offset: headCommit.author.when.offset,
    };

    // Create new commit with same parents
    return createCommit(repo, {
      message,
      author,
      committer: options.committer,
      updateRef: options.updateRef ?? "HEAD",
      parents: headCommit.parents,
      treeOid: options.treeOid,
    });
  } finally {
    defer.run();
  }
}

/**
 * Get commit information by OID
 */
export function getCommit(repo: Repository, oid: string): {
  oid: string;
  message: string;
  summary: string;
  body: string | null;
  author: GitSignature;
  committer: GitSignature;
  time: Date;
  parents: string[];
  treeOid: string;
} {
  const lib = getLibrary();
  const defer = new Defer();

  try {
    const oidBuf = new Uint8Array(20);
    const oidStr = toCString(oid);
    const parseResult = lib.symbols.git_oid_fromstr(
      ptrOf(oidBuf),
      ptrOf(oidStr),
    );
    checkError(lib, parseResult, `Invalid OID: ${oid}`);

    const commitPtr = createOutPointer();
    const lookupResult = lib.symbols.git_commit_lookup(
      ptrOf(commitPtr),
      repo.pointer,
      ptrOf(oidBuf),
    );
    checkError(lib, lookupResult, `Failed to lookup commit ${oid}`);

    const commit = readPointer(commitPtr);
    defer.add(() => lib.symbols.git_commit_free(commit));

    // Get commit ID
    const idPtr = lib.symbols.git_commit_id(commit);
    const commitOid = readOidHex(idPtr) ?? oid;

    // Get message
    const messagePtr = lib.symbols.git_commit_message(commit);
    const message = fromCString(messagePtr) ?? "";

    // Get summary
    const summaryPtr = lib.symbols.git_commit_summary(commit);
    const summary = fromCString(summaryPtr) ?? "";

    // Get body
    const bodyPtr = lib.symbols.git_commit_body(commit);
    const body = fromCString(bodyPtr);

    // Get author
    const authorPtr = lib.symbols.git_commit_author(commit);
    const author = readSignature(authorPtr) ?? {
      name: "",
      email: "",
      when: { time: 0n, offset: 0, sign: "+" },
    };

    // Get committer
    const committerPtr = lib.symbols.git_commit_committer(commit);
    const committer = readSignature(committerPtr) ?? {
      name: "",
      email: "",
      when: { time: 0n, offset: 0, sign: "+" },
    };

    // Get time
    const timeSeconds = lib.symbols.git_commit_time(commit);
    const time = new Date(Number(timeSeconds) * 1000);

    // Get tree OID
    const treeIdPtr = lib.symbols.git_commit_tree_id(commit);
    const treeOid = readOidHex(treeIdPtr) ?? "";

    // Get parents
    const parentCount = lib.symbols.git_commit_parentcount(commit);
    const parents: string[] = [];
    for (let i = 0; i < parentCount; i++) {
      const parentIdPtr = lib.symbols.git_commit_parent_id(commit, i);
      const parentOid = readOidHex(parentIdPtr);
      if (parentOid !== null) {
        parents.push(parentOid);
      }
    }

    return {
      oid: commitOid,
      message,
      summary,
      body,
      author,
      committer,
      time,
      parents,
      treeOid,
    };
  } finally {
    defer.run();
  }
}
