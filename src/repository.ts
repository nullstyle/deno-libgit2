/**
 * @module repository
 * High-level Repository API for Git operations
 */

import { getLibrary, type LibGit2 } from "./library.ts";
import { checkError, GitError } from "./error.ts";
import {
  type BlameOptions,
  type BranchInfo,
  type CommitInfo,
  type ConflictEntry,
  GitBranchType,
  GitErrorCode,
  GitReferenceType,
  GitRepositoryOpenFlags,
  GitRepositoryState,
  type GitStatusEntry,
  GitStatusFlags,
  type MergeAnalysisResult,
  type MergeOptions,
  type Pointer,
  type ReferenceInfo,
} from "./types.ts";
import { Blame, blameFile as blameFileFn } from "./blame.ts";
import { deleteReflog, readReflog, Reflog, renameReflog } from "./reflog.ts";
import {
  GitSubmoduleIgnore,
  listSubmodules,
  lookupSubmodule,
  Submodule,
  submoduleStatus,
} from "./submodule.ts";
import {
  initRebase,
  openRebase,
  Rebase,
  type RebaseOptions,
} from "./rebase.ts";
import {
  AnnotatedCommit,
  getConflicts,
  merge as mergeFn,
  mergeAnalysis as mergeAnalysisFn,
  mergeBase as mergeBaseFn,
  mergeCommits as mergeCommitsFn,
  stateCleanup,
} from "./merge.ts";
import {
  cherrypick as cherrypickFn,
  cherrypickCommit as cherrypickCommitFn,
  type CherrypickOptions,
} from "./cherrypick.ts";
import {
  revert as revertFn,
  revertCommit as revertCommitFn,
  type RevertOptions,
} from "./revert.ts";
import {
  Diff,
  diffIndexToWorkdir,
  diffTreeToIndex,
  diffTreeToTree,
  diffTreeToWorkdir,
} from "./diff.ts";
import { Patch, patchFromDiff } from "./patch.ts";
import {
  apply as applyFn,
  ApplyLocation,
  applyToTree as applyToTreeFn,
} from "./apply.ts";
import {
  addWorktree,
  listWorktrees,
  lookupWorktree,
  openWorktreeFromRepository,
  Worktree,
  type WorktreeAddOptions,
} from "./worktree.ts";
import {
  createNote as createNoteFn,
  defaultNotesRef as defaultNotesRefFn,
  listNotes as listNotesFn,
  Note,
  type NoteCreateOptions,
  type NoteReadOptions,
  readNote as readNoteFn,
  removeNote as removeNoteFn,
} from "./notes.ts";
import {
  describeCommit as describeCommitFn,
  type DescribeOptions,
  DescribeStrategy,
  describeWorkdir as describeWorkdirFn,
} from "./describe.ts";
import {
  aheadBehind as aheadBehindFn,
  type AheadBehindResult,
  isDescendantOf as isDescendantOfFn,
} from "./graph.ts";
import {
  listStashes,
  stashApply,
  StashApplyOptions,
  stashDrop,
  StashEntry,
  stashPop,
  stashSave,
  StashSaveOptions,
} from "./stash.ts";
import {
  createLightweightTag,
  CreateLightweightTagOptions,
  createTag,
  CreateTagOptions,
  deleteTag,
  foreachTag,
  listTags,
  lookupTag,
  Tag,
  TagForeachInfo,
} from "./tag.ts";
import { Config, getRepositoryConfig } from "./config.ts";
import type { Index } from "./index.ts";
import type { SignatureInfo } from "./signature.ts";
import {
  addAttrMacro,
  attrCacheFlush,
  type AttrForeachCallback,
  type AttrResult,
  foreachAttr,
  getAttr,
  getAttrMany,
  GitAttrCheckFlags,
} from "./attr.ts";
import {
  addIgnoreRule as addIgnoreRuleFn,
  clearIgnoreRules as clearIgnoreRulesFn,
  pathIsIgnored as pathIsIgnoredFn,
} from "./ignore.ts";
import { createPathspec, GitPathspecFlags, Pathspec } from "./pathspec.ts";
import { Mailmap } from "./mailmap.ts";
import {
  createRemote,
  deleteRemote,
  listRemotes,
  lookupRemote,
  Remote,
  renameRemote,
  setRemotePushUrl,
  setRemoteUrl,
} from "./remote.ts";
import { getRepositoryOdb, Odb } from "./odb.ts";
import {
  createGitBuf,
  createOutPointer,
  Defer,
  fromCString,
  ptrOf,
  readGitBuf,
  readOidHex,
  readPointer,
  readSignature,
  toCString,
} from "./utils.ts";

/**
 * Represents a Git repository
 */
export class Repository {
  private _ptr: Pointer;
  private _lib: LibGit2;
  private _closed = false;

  /**
   * Create a Repository instance from a pointer
   * @internal
   */
  constructor(ptr: Pointer) {
    if (ptr === null) {
      throw new GitError("Invalid repository pointer", GitErrorCode.EINVALID);
    }
    this._ptr = ptr;
    this._lib = getLibrary();
  }

  /**
   * Get the raw pointer (for advanced usage)
   */
  get pointer(): Pointer {
    this.ensureOpen();
    return this._ptr;
  }

  /**
   * Check if the repository is closed
   */
  get isClosed(): boolean {
    return this._closed;
  }

  /**
   * Ensure the repository is open
   */
  private ensureOpen(): void {
    if (this._closed) {
      throw new GitError("Repository is closed", GitErrorCode.EINVALID);
    }
  }

  /**
   * Open an existing Git repository
   * @param path - Path to the repository (can be the .git directory or working directory)
   */
  static open(path: string): Repository {
    const lib = getLibrary();
    const outPtr = createOutPointer();
    const pathBuf = toCString(path);

    const result = lib.symbols.git_repository_open(
      ptrOf(outPtr),
      ptrOf(pathBuf),
    );

    checkError(lib, result, `Failed to open repository at ${path}`);
    return new Repository(readPointer(outPtr));
  }

  /**
   * Open a repository with extended options
   * @param path - Path to the repository
   * @param flags - Open flags
   * @param ceilingDirs - Optional ceiling directories to stop searching at
   */
  static openExt(
    path: string,
    flags: GitRepositoryOpenFlags = GitRepositoryOpenFlags.NONE,
    ceilingDirs?: string,
  ): Repository {
    const lib = getLibrary();
    const outPtr = createOutPointer();
    const pathBuf = toCString(path);
    const ceilingBuf = ceilingDirs ? toCString(ceilingDirs) : null;

    const result = lib.symbols.git_repository_open_ext(
      ptrOf(outPtr),
      ptrOf(pathBuf),
      flags,
      ceilingBuf ? ptrOf(ceilingBuf) : null,
    );

    checkError(lib, result, `Failed to open repository at ${path}`);
    return new Repository(readPointer(outPtr));
  }

  /**
   * Open a bare repository
   * @param path - Path to the bare repository
   */
  static openBare(path: string): Repository {
    const lib = getLibrary();
    const outPtr = createOutPointer();
    const pathBuf = toCString(path);

    const result = lib.symbols.git_repository_open_bare(
      ptrOf(outPtr),
      ptrOf(pathBuf),
    );

    checkError(lib, result, `Failed to open bare repository at ${path}`);
    return new Repository(readPointer(outPtr));
  }

  /**
   * Initialize a new Git repository
   * @param path - Path where the repository should be created
   * @param bare - Whether to create a bare repository
   */
  static init(path: string, bare = false): Repository {
    const lib = getLibrary();
    const outPtr = createOutPointer();
    const pathBuf = toCString(path);

    const result = lib.symbols.git_repository_init(
      ptrOf(outPtr),
      ptrOf(pathBuf),
      bare ? 1 : 0,
    );

    checkError(lib, result, `Failed to initialize repository at ${path}`);
    return new Repository(readPointer(outPtr));
  }

  /**
   * Discover a Git repository by walking up the directory tree
   * @param startPath - Path to start searching from
   * @param acrossFs - Whether to cross filesystem boundaries
   * @param ceilingDirs - Optional ceiling directories to stop searching at
   * @returns Path to the discovered repository
   */
  static discover(
    startPath: string,
    acrossFs = false,
    ceilingDirs?: string,
  ): string {
    const lib = getLibrary();
    const buf = createGitBuf();
    const pathBuf = toCString(startPath);
    const ceilingBuf = ceilingDirs ? toCString(ceilingDirs) : null;

    const result = lib.symbols.git_repository_discover(
      ptrOf(buf),
      ptrOf(pathBuf),
      acrossFs ? 1 : 0,
      ceilingBuf ? ptrOf(ceilingBuf) : null,
    );

    checkError(lib, result, `Failed to discover repository from ${startPath}`);

    const path = readGitBuf(buf);
    lib.symbols.git_buf_dispose(ptrOf(buf));

    if (path === null) {
      throw new GitError("Repository not found", GitErrorCode.ENOTFOUND);
    }

    return path;
  }

  /**
   * Close the repository and free resources
   */
  close(): void {
    if (!this._closed && this._ptr !== null) {
      this._lib.symbols.git_repository_free(this._ptr);
      this._ptr = null;
      this._closed = true;
    }
  }

  [Symbol.dispose](): void {
    this.close();
  }

  /**
   * Get the path to the .git directory
   */
  get path(): string {
    this.ensureOpen();
    const pathPtr = this._lib.symbols.git_repository_path(this._ptr);
    return fromCString(pathPtr) ?? "";
  }

  /**
   * Get the path to the working directory
   * Returns null for bare repositories
   */
  get workdir(): string | null {
    this.ensureOpen();
    const pathPtr = this._lib.symbols.git_repository_workdir(this._ptr);
    return fromCString(pathPtr);
  }

  /**
   * Check if this is a bare repository
   */
  get isBare(): boolean {
    this.ensureOpen();
    return this._lib.symbols.git_repository_is_bare(this._ptr) !== 0;
  }

  /**
   * Check if the repository is empty (no commits)
   */
  get isEmpty(): boolean {
    this.ensureOpen();
    const result = this._lib.symbols.git_repository_is_empty(this._ptr);
    if (result < 0) {
      checkError(this._lib, result, "Failed to check if repository is empty");
    }
    return result === 1;
  }

  /**
   * Check if HEAD is detached
   */
  get isHeadDetached(): boolean {
    this.ensureOpen();
    return this._lib.symbols.git_repository_head_detached(this._ptr) === 1;
  }

  /**
   * Get the current repository state
   */
  get state(): GitRepositoryState {
    this.ensureOpen();
    return this._lib.symbols.git_repository_state(
      this._ptr,
    ) as GitRepositoryState;
  }

  /**
   * Get the HEAD reference
   */
  head(): ReferenceInfo {
    this.ensureOpen();
    const outPtr = createOutPointer();
    const defer = new Defer();

    try {
      const result = this._lib.symbols.git_repository_head(
        ptrOf(outPtr),
        this._ptr,
      );
      checkError(this._lib, result, "Failed to get HEAD reference");

      const refPtr = readPointer(outPtr);
      defer.add(() => this._lib.symbols.git_reference_free(refPtr));

      return this.readReferenceInfo(refPtr);
    } finally {
      defer.run();
    }
  }

  /**
   * Get the OID that HEAD points to
   */
  headOid(): string {
    this.ensureOpen();
    const outPtr = createOutPointer();
    const defer = new Defer();

    try {
      const result = this._lib.symbols.git_repository_head(
        ptrOf(outPtr),
        this._ptr,
      );
      checkError(this._lib, result, "Failed to get HEAD reference");

      const refPtr = readPointer(outPtr);
      defer.add(() => this._lib.symbols.git_reference_free(refPtr));

      // Resolve to direct reference if symbolic
      const resolvedPtr = createOutPointer();
      const resolveResult = this._lib.symbols.git_reference_resolve(
        ptrOf(resolvedPtr),
        refPtr,
      );
      checkError(this._lib, resolveResult, "Failed to resolve HEAD");

      const resolved = readPointer(resolvedPtr);
      defer.add(() => this._lib.symbols.git_reference_free(resolved));

      const targetPtr = this._lib.symbols.git_reference_target(resolved);
      const oid = readOidHex(targetPtr);

      if (oid === null) {
        throw new GitError("HEAD has no target", GitErrorCode.ENOTFOUND);
      }

      return oid;
    } finally {
      defer.run();
    }
  }

  /**
   * Set HEAD to point to a reference
   * @param refname - The reference name (e.g., "refs/heads/main")
   */
  setHead(refname: string): void {
    this.ensureOpen();
    const refBuf = toCString(refname);
    const result = this._lib.symbols.git_repository_set_head(
      this._ptr,
      ptrOf(refBuf),
    );
    checkError(this._lib, result, `Failed to set HEAD to ${refname}`);
  }

  /**
   * Detach HEAD and point it to a specific commit
   * @param oid - The commit OID to point to
   */
  setHeadDetached(oid: string): void {
    this.ensureOpen();
    const oidBuf = new Uint8Array(20);
    const oidStr = toCString(oid);

    const parseResult = this._lib.symbols.git_oid_fromstr(
      ptrOf(oidBuf),
      ptrOf(oidStr),
    );
    checkError(this._lib, parseResult, `Invalid OID: ${oid}`);

    const result = this._lib.symbols.git_repository_set_head_detached(
      this._ptr,
      ptrOf(oidBuf),
    );
    checkError(this._lib, result, `Failed to detach HEAD to ${oid}`);
  }

  /**
   * Look up a commit by OID
   * @param oid - The commit OID (hex string)
   */
  lookupCommit(oid: string): CommitInfo {
    this.ensureOpen();
    const outPtr = createOutPointer();
    const oidBuf = new Uint8Array(20);
    const oidStr = toCString(oid);
    const defer = new Defer();

    try {
      const parseResult = this._lib.symbols.git_oid_fromstr(
        ptrOf(oidBuf),
        ptrOf(oidStr),
      );
      checkError(this._lib, parseResult, `Invalid OID: ${oid}`);

      const result = this._lib.symbols.git_commit_lookup(
        ptrOf(outPtr),
        this._ptr,
        ptrOf(oidBuf),
      );
      checkError(this._lib, result, `Failed to lookup commit ${oid}`);

      const commitPtr = readPointer(outPtr);
      defer.add(() => this._lib.symbols.git_commit_free(commitPtr));

      return this.readCommitInfo(commitPtr);
    } finally {
      defer.run();
    }
  }

  /**
   * Look up a reference by name
   * @param name - The reference name (e.g., "refs/heads/main")
   */
  lookupReference(name: string): ReferenceInfo {
    this.ensureOpen();
    const outPtr = createOutPointer();
    const nameBuf = toCString(name);
    const defer = new Defer();

    try {
      const result = this._lib.symbols.git_reference_lookup(
        ptrOf(outPtr),
        this._ptr,
        ptrOf(nameBuf),
      );
      checkError(this._lib, result, `Failed to lookup reference ${name}`);

      const refPtr = readPointer(outPtr);
      defer.add(() => this._lib.symbols.git_reference_free(refPtr));

      return this.readReferenceInfo(refPtr);
    } finally {
      defer.run();
    }
  }

  /**
   * Resolve a short reference name to a full reference
   * @param shorthand - The short reference name (e.g., "main")
   */
  resolveReference(shorthand: string): ReferenceInfo {
    this.ensureOpen();
    const outPtr = createOutPointer();
    const nameBuf = toCString(shorthand);
    const defer = new Defer();

    try {
      const result = this._lib.symbols.git_reference_dwim(
        ptrOf(outPtr),
        this._ptr,
        ptrOf(nameBuf),
      );
      checkError(this._lib, result, `Failed to resolve reference ${shorthand}`);

      const refPtr = readPointer(outPtr);
      defer.add(() => this._lib.symbols.git_reference_free(refPtr));

      return this.readReferenceInfo(refPtr);
    } finally {
      defer.run();
    }
  }

  /**
   * List all references in the repository
   */
  listReferences(): string[] {
    this.ensureOpen();
    const iterPtr = createOutPointer();
    const defer = new Defer();
    const refs: string[] = [];

    try {
      const result = this._lib.symbols.git_reference_iterator_new(
        ptrOf(iterPtr),
        this._ptr,
      );
      checkError(this._lib, result, "Failed to create reference iterator");

      const iter = readPointer(iterPtr);
      defer.add(() => this._lib.symbols.git_reference_iterator_free(iter));

      const namePtr = createOutPointer();
      while (true) {
        const nextResult = this._lib.symbols.git_reference_next_name(
          ptrOf(namePtr),
          iter,
        );

        if (nextResult === GitErrorCode.ITEROVER) {
          break;
        }
        checkError(this._lib, nextResult, "Failed to iterate references");

        const name = fromCString(readPointer(namePtr));
        if (name !== null) {
          refs.push(name);
        }
      }

      return refs;
    } finally {
      defer.run();
    }
  }

  /**
   * List all branches in the repository
   * @param type - Type of branches to list (local, remote, or all)
   */
  listBranches(type: GitBranchType = GitBranchType.ALL): BranchInfo[] {
    this.ensureOpen();
    const iterPtr = createOutPointer();
    const defer = new Defer();
    const branches: BranchInfo[] = [];

    try {
      const result = this._lib.symbols.git_branch_iterator_new(
        ptrOf(iterPtr),
        this._ptr,
        type,
      );
      checkError(this._lib, result, "Failed to create branch iterator");

      const iter = readPointer(iterPtr);
      defer.add(() => this._lib.symbols.git_branch_iterator_free(iter));

      const refPtr = createOutPointer();
      const typePtr = new Uint8Array(4);

      while (true) {
        const nextResult = this._lib.symbols.git_branch_next(
          ptrOf(refPtr),
          ptrOf(typePtr),
          iter,
        );

        if (nextResult === GitErrorCode.ITEROVER) {
          break;
        }
        checkError(this._lib, nextResult, "Failed to iterate branches");

        const ref = readPointer(refPtr);
        const branchType = new DataView(typePtr.buffer).getInt32(
          0,
          true,
        ) as GitBranchType;

        try {
          const info = this.readBranchInfo(ref, branchType);
          branches.push(info);
        } finally {
          this._lib.symbols.git_reference_free(ref);
        }
      }

      return branches;
    } finally {
      defer.run();
    }
  }

  /**
   * Create a new branch
   * @param name - Branch name
   * @param targetOid - OID of the commit to point to
   * @param force - Whether to overwrite existing branch
   */
  createBranch(name: string, targetOid: string, force = false): BranchInfo {
    this.ensureOpen();
    const outPtr = createOutPointer();
    const nameBuf = toCString(name);
    const commitPtr = createOutPointer();
    const oidBuf = new Uint8Array(20);
    const oidStr = toCString(targetOid);
    const defer = new Defer();

    try {
      // Parse OID
      const parseResult = this._lib.symbols.git_oid_fromstr(
        ptrOf(oidBuf),
        ptrOf(oidStr),
      );
      checkError(this._lib, parseResult, `Invalid OID: ${targetOid}`);

      // Lookup commit
      const lookupResult = this._lib.symbols.git_commit_lookup(
        ptrOf(commitPtr),
        this._ptr,
        ptrOf(oidBuf),
      );
      checkError(
        this._lib,
        lookupResult,
        `Failed to lookup commit ${targetOid}`,
      );

      const commit = readPointer(commitPtr);
      defer.add(() => this._lib.symbols.git_commit_free(commit));

      // Create branch
      const result = this._lib.symbols.git_branch_create(
        ptrOf(outPtr),
        this._ptr,
        ptrOf(nameBuf),
        commit,
        force ? 1 : 0,
      );
      checkError(this._lib, result, `Failed to create branch ${name}`);

      const refPtr = readPointer(outPtr);
      defer.add(() => this._lib.symbols.git_reference_free(refPtr));

      return this.readBranchInfo(refPtr, GitBranchType.LOCAL);
    } finally {
      defer.run();
    }
  }

  /**
   * Delete a branch
   * @param name - Branch name
   * @param type - Branch type (local or remote)
   */
  deleteBranch(name: string, type: GitBranchType = GitBranchType.LOCAL): void {
    this.ensureOpen();
    const outPtr = createOutPointer();
    const nameBuf = toCString(name);
    const defer = new Defer();

    try {
      const lookupResult = this._lib.symbols.git_branch_lookup(
        ptrOf(outPtr),
        this._ptr,
        ptrOf(nameBuf),
        type,
      );
      checkError(this._lib, lookupResult, `Failed to find branch ${name}`);

      const refPtr = readPointer(outPtr);
      defer.add(() => this._lib.symbols.git_reference_free(refPtr));

      const result = this._lib.symbols.git_branch_delete(refPtr);
      checkError(this._lib, result, `Failed to delete branch ${name}`);
    } finally {
      defer.run();
    }
  }

  /**
   * Get the status of files in the working directory
   */
  status(): GitStatusEntry[] {
    this.ensureOpen();
    const listPtr = createOutPointer();
    const defer = new Defer();
    const entries: GitStatusEntry[] = [];

    try {
      const result = this._lib.symbols.git_status_list_new(
        ptrOf(listPtr),
        this._ptr,
        null, // Use default options
      );
      checkError(this._lib, result, "Failed to get status");

      const list = readPointer(listPtr);
      defer.add(() => this._lib.symbols.git_status_list_free(list));

      const count = this._lib.symbols.git_status_list_entrycount(list);

      for (let i = 0n; i < count; i++) {
        const entryPtr = this._lib.symbols.git_status_byindex(list, i);
        if (entryPtr !== null) {
          const entry = this.readStatusEntry(entryPtr);
          entries.push(entry);
        }
      }

      return entries;
    } finally {
      defer.run();
    }
  }

  /**
   * Walk the commit history
   * @param startOid - OID to start from (defaults to HEAD)
   * @param limit - Maximum number of commits to return
   */
  *walkCommits(startOid?: string, limit?: number): Generator<CommitInfo> {
    this.ensureOpen();
    const walkerPtr = createOutPointer();
    const defer = new Defer();

    try {
      const result = this._lib.symbols.git_revwalk_new(
        ptrOf(walkerPtr),
        this._ptr,
      );
      checkError(this._lib, result, "Failed to create revision walker");

      const walker = readPointer(walkerPtr);
      defer.add(() => this._lib.symbols.git_revwalk_free(walker));

      // Push starting point
      if (startOid) {
        const oidBuf = new Uint8Array(20);
        const oidStr = toCString(startOid);
        const parseResult = this._lib.symbols.git_oid_fromstr(
          ptrOf(oidBuf),
          ptrOf(oidStr),
        );
        checkError(this._lib, parseResult, `Invalid OID: ${startOid}`);

        const pushResult = this._lib.symbols.git_revwalk_push(
          walker,
          ptrOf(oidBuf),
        );
        checkError(this._lib, pushResult, "Failed to push starting OID");
      } else {
        const pushResult = this._lib.symbols.git_revwalk_push_head(walker);
        checkError(this._lib, pushResult, "Failed to push HEAD");
      }

      // Walk commits
      const oidBuf = new Uint8Array(20);
      let count = 0;

      while (limit === undefined || count < limit) {
        const nextResult = this._lib.symbols.git_revwalk_next(
          ptrOf(oidBuf),
          walker,
        );

        if (nextResult === GitErrorCode.ITEROVER) {
          break;
        }
        checkError(this._lib, nextResult, "Failed to get next commit");

        const commitPtr = createOutPointer();
        const lookupResult = this._lib.symbols.git_commit_lookup(
          ptrOf(commitPtr),
          this._ptr,
          ptrOf(oidBuf),
        );
        checkError(this._lib, lookupResult, "Failed to lookup commit");

        const commit = readPointer(commitPtr);
        try {
          yield this.readCommitInfo(commit);
          count++;
        } finally {
          this._lib.symbols.git_commit_free(commit);
        }
      }
    } finally {
      defer.run();
    }
  }

  /**
   * Get a list of commits (non-generator version of walkCommits)
   * @param startOid - OID to start from (defaults to HEAD)
   * @param limit - Maximum number of commits to return
   */
  getCommits(startOid?: string, limit = 100): CommitInfo[] {
    return [...this.walkCommits(startOid, limit)];
  }

  /**
   * Read commit information from a commit pointer
   */
  private readCommitInfo(commitPtr: Pointer): CommitInfo {
    const idPtr = this._lib.symbols.git_commit_id(commitPtr);
    const oid = readOidHex(idPtr) ?? "";

    const messagePtr = this._lib.symbols.git_commit_message(commitPtr);
    const message = fromCString(messagePtr) ?? "";

    const authorPtr = this._lib.symbols.git_commit_author(commitPtr);
    const author = readSignature(authorPtr) ?? {
      name: "",
      email: "",
      when: { time: 0n, offset: 0, sign: "+" },
    };

    const committerPtr = this._lib.symbols.git_commit_committer(commitPtr);
    const committer = readSignature(committerPtr) ?? {
      name: "",
      email: "",
      when: { time: 0n, offset: 0, sign: "+" },
    };

    const treeIdPtr = this._lib.symbols.git_commit_tree_id(commitPtr);
    const treeOid = readOidHex(treeIdPtr) ?? "";

    const parentCount = this._lib.symbols.git_commit_parentcount(commitPtr);
    const parents: string[] = [];
    for (let i = 0; i < parentCount; i++) {
      const parentIdPtr = this._lib.symbols.git_commit_parent_id(commitPtr, i);
      const parentOid = readOidHex(parentIdPtr);
      if (parentOid !== null) {
        parents.push(parentOid);
      }
    }

    return { oid, message, author, committer, parents, treeOid };
  }

  /**
   * Read reference information from a reference pointer
   */
  private readReferenceInfo(refPtr: Pointer): ReferenceInfo {
    const namePtr = this._lib.symbols.git_reference_name(refPtr);
    const name = fromCString(namePtr) ?? "";

    const type = this._lib.symbols.git_reference_type(
      refPtr,
    ) as GitReferenceType;

    let target: string | undefined;
    let symbolicTarget: string | undefined;

    if (type === GitReferenceType.DIRECT) {
      const targetPtr = this._lib.symbols.git_reference_target(refPtr);
      target = readOidHex(targetPtr) ?? undefined;
    } else if (type === GitReferenceType.SYMBOLIC) {
      const symTargetPtr = this._lib.symbols.git_reference_symbolic_target(
        refPtr,
      );
      symbolicTarget = fromCString(symTargetPtr) ?? undefined;
    }

    const isBranch = this._lib.symbols.git_reference_is_branch(refPtr) === 1;
    const isTag = this._lib.symbols.git_reference_is_tag(refPtr) === 1;
    const isRemote = this._lib.symbols.git_reference_is_remote(refPtr) === 1;

    return { name, type, target, symbolicTarget, isBranch, isTag, isRemote };
  }

  /**
   * Read branch information from a reference pointer
   */
  private readBranchInfo(refPtr: Pointer, type: GitBranchType): BranchInfo {
    const namePtr = createOutPointer();
    const nameResult = this._lib.symbols.git_branch_name(
      ptrOf(namePtr),
      refPtr,
    );

    let name = "";
    if (nameResult >= 0) {
      name = fromCString(readPointer(namePtr)) ?? "";
    }

    const refNamePtr = this._lib.symbols.git_reference_name(refPtr);
    const refName = fromCString(refNamePtr) ?? "";

    const isHead = this._lib.symbols.git_branch_is_head(refPtr) === 1;

    // Get target OID
    let targetOid: string | undefined;
    const targetPtr = this._lib.symbols.git_reference_target(refPtr);
    if (targetPtr !== null) {
      targetOid = readOidHex(targetPtr) ?? undefined;
    }

    // Get upstream if local branch
    let upstream: string | undefined;
    if (type === GitBranchType.LOCAL) {
      const upstreamPtr = createOutPointer();
      const upstreamResult = this._lib.symbols.git_branch_upstream(
        ptrOf(upstreamPtr),
        refPtr,
      );
      if (upstreamResult >= 0) {
        const upstreamRef = readPointer(upstreamPtr);
        if (upstreamRef !== null) {
          const upstreamNamePtr = this._lib.symbols.git_reference_name(
            upstreamRef,
          );
          upstream = fromCString(upstreamNamePtr) ?? undefined;
          this._lib.symbols.git_reference_free(upstreamRef);
        }
      }
    }

    return { name, refName, type, isHead, targetOid, upstream };
  }

  /**
   * Read status entry from a pointer
   * Note: Path reading is disabled due to complex struct layout issues
   * Only status flags are reliably read
   */
  private readStatusEntry(entryPtr: Pointer): GitStatusEntry {
    const view = new Deno.UnsafePointerView(entryPtr!);

    // git_status_entry: { git_status_t status; git_diff_delta *head_to_index; git_diff_delta *index_to_workdir; }
    const status = view.getUint32(0) as GitStatusFlags;

    // Note: Reading paths from diff deltas is disabled due to complex struct layout
    // The git_diff_delta struct has platform-dependent alignment and padding
    // that makes reliable path extraction difficult without proper struct definitions

    return { status, indexPath: undefined, workdirPath: undefined };
  }

  // ==================== Merge Operations ====================

  /**
   * Find the merge base between two commits
   * @param one - First commit OID
   * @param two - Second commit OID
   * @returns The OID of the merge base commit
   */
  mergeBase(one: string, two: string): string {
    this.ensureOpen();
    return mergeBaseFn(this._lib, this._ptr, one, two);
  }

  /**
   * Analyze merge possibilities for a commit
   * @param commitOid - The commit OID to analyze merging into HEAD
   * @returns Analysis result with merge possibilities
   */
  mergeAnalysis(commitOid: string): MergeAnalysisResult {
    this.ensureOpen();
    const annotated = AnnotatedCommit.lookup(this._lib, this._ptr, commitOid);
    try {
      return mergeAnalysisFn(this._lib, this._ptr, [annotated]);
    } finally {
      annotated.free();
    }
  }

  /**
   * Merge two commits into an index (does not modify working directory)
   * @param ourCommitOid - "Our" commit OID
   * @param theirCommitOid - "Their" commit OID
   * @param options - Merge options
   * @returns An Index containing the merge result
   */
  mergeCommits(
    ourCommitOid: string,
    theirCommitOid: string,
    options?: MergeOptions,
  ): import("./index.ts").Index {
    this.ensureOpen();
    return mergeCommitsFn(
      this._lib,
      this._ptr,
      ourCommitOid,
      theirCommitOid,
      options,
    );
  }

  /**
   * Perform a merge operation (modifies working directory)
   * @param commitOid - The commit OID to merge into HEAD
   * @param options - Merge options
   */
  merge(commitOid: string, options?: MergeOptions): void {
    this.ensureOpen();
    const annotated = AnnotatedCommit.lookup(this._lib, this._ptr, commitOid);
    try {
      mergeFn(this._lib, this._ptr, [annotated], options);
    } finally {
      annotated.free();
    }
  }

  /**
   * Create an annotated commit from a reference
   * @param refName - Reference name (e.g., "refs/heads/main")
   * @returns AnnotatedCommit object (must be freed by caller)
   */
  annotatedCommitFromRef(refName: string): AnnotatedCommit {
    this.ensureOpen();
    const refPtr = createOutPointer();
    const refNameBuf = toCString(refName);

    const result = this._lib.symbols.git_reference_lookup(
      ptrOf(refPtr),
      this._ptr,
      ptrOf(refNameBuf),
    );
    checkError(this._lib, result, `Failed to lookup reference ${refName}`);

    const ref = readPointer(refPtr);
    try {
      return AnnotatedCommit.fromRef(this._lib, this._ptr, ref);
    } finally {
      this._lib.symbols.git_reference_free(ref);
    }
  }

  /**
   * Create an annotated commit from a revspec string
   * @param revspec - Revision specification (e.g., "HEAD", "main", "HEAD~2")
   * @returns AnnotatedCommit object (must be freed by caller)
   */
  annotatedCommitFromRevspec(revspec: string): AnnotatedCommit {
    this.ensureOpen();
    return AnnotatedCommit.fromRevspec(this._lib, this._ptr, revspec);
  }

  /**
   * Create an annotated commit from an OID
   * @param oid - Commit OID as hex string
   * @returns AnnotatedCommit object (must be freed by caller)
   */
  annotatedCommitLookup(oid: string): AnnotatedCommit {
    this.ensureOpen();
    return AnnotatedCommit.lookup(this._lib, this._ptr, oid);
  }

  /**
   * Clean up repository state after merge/rebase/etc
   */
  stateCleanup(): void {
    this.ensureOpen();
    stateCleanup(this._lib, this._ptr);
  }

  /**
   * Get conflicts from the repository's index
   * @returns Array of conflict entries
   */
  getConflicts(): ConflictEntry[] {
    this.ensureOpen();
    const indexPtr = createOutPointer();
    const result = this._lib.symbols.git_repository_index(
      ptrOf(indexPtr),
      this._ptr,
    );
    checkError(this._lib, result, "Failed to get repository index");

    const index = readPointer(indexPtr);
    try {
      return getConflicts(this._lib, index);
    } finally {
      this._lib.symbols.git_index_free(index);
    }
  }

  // ==================== Cherry-pick Operations ====================

  /**
   * Cherry-pick a commit against another commit, producing an index
   * @param cherrypickCommitOid - OID of commit to cherry-pick
   * @param ourCommitOid - OID of commit to cherry-pick against (e.g., HEAD)
   * @param options - Cherry-pick options
   * @returns Index containing the cherry-pick result (must be freed by caller)
   */
  cherrypickCommit(
    cherrypickCommitOid: string,
    ourCommitOid: string,
    options?: CherrypickOptions,
  ): Index {
    this.ensureOpen();

    // Lookup the commits
    const cherrypickCommit = this.lookupCommitPtr(cherrypickCommitOid);
    const ourCommit = this.lookupCommitPtr(ourCommitOid);

    try {
      return cherrypickCommitFn(
        this._lib,
        this._ptr,
        cherrypickCommit,
        ourCommit,
        options?.mainline ?? 0,
      );
    } finally {
      this._lib.symbols.git_commit_free(cherrypickCommit);
      this._lib.symbols.git_commit_free(ourCommit);
    }
  }

  /**
   * Cherry-pick a commit, modifying the index and working directory
   * @param commitOid - OID of commit to cherry-pick
   */
  cherrypick(commitOid: string): void {
    this.ensureOpen();

    const commit = this.lookupCommitPtr(commitOid);
    try {
      cherrypickFn(this._lib, this._ptr, commit);
    } finally {
      this._lib.symbols.git_commit_free(commit);
    }
  }

  /**
   * Helper to lookup a commit and return its pointer
   */
  private lookupCommitPtr(oid: string): Pointer {
    const oidBuf = new Uint8Array(20);
    for (let i = 0; i < 20; i++) {
      oidBuf[i] = parseInt(oid.slice(i * 2, i * 2 + 2), 16);
    }

    const commitPtr = createOutPointer();
    const result = this._lib.symbols.git_commit_lookup(
      ptrOf(commitPtr),
      this._ptr,
      ptrOf(oidBuf),
    );
    checkError(this._lib, result, `Failed to lookup commit ${oid}`);

    return readPointer(commitPtr);
  }

  // ==================== Diff Operations ====================

  /**
   * Create a diff between two commits
   * @param oldCommitOid - OID of old commit (can be null for empty tree)
   * @param newCommitOid - OID of new commit (can be null for empty tree)
   * @returns Diff object (must be freed by caller)
   */
  diffTreeToTree(
    oldCommitOid: string | null,
    newCommitOid: string | null,
  ): Diff {
    this.ensureOpen();

    let oldTreePtr: Pointer | null = null;
    let newTreePtr: Pointer | null = null;
    let oldCommitPtr: Pointer | null = null;
    let newCommitPtr: Pointer | null = null;

    try {
      if (oldCommitOid) {
        oldCommitPtr = this.lookupCommitPtr(oldCommitOid);
        const treeOidPtr = this._lib.symbols.git_commit_tree_id(oldCommitPtr);
        const treeOutPtr = createOutPointer();
        const result = this._lib.symbols.git_tree_lookup(
          ptrOf(treeOutPtr),
          this._ptr,
          treeOidPtr,
        );
        checkError(this._lib, result, "Failed to lookup old tree");
        oldTreePtr = readPointer(treeOutPtr);
      }

      if (newCommitOid) {
        newCommitPtr = this.lookupCommitPtr(newCommitOid);
        const treeOidPtr = this._lib.symbols.git_commit_tree_id(newCommitPtr);
        const treeOutPtr = createOutPointer();
        const result = this._lib.symbols.git_tree_lookup(
          ptrOf(treeOutPtr),
          this._ptr,
          treeOidPtr,
        );
        checkError(this._lib, result, "Failed to lookup new tree");
        newTreePtr = readPointer(treeOutPtr);
      }

      return diffTreeToTree(this._lib, this._ptr, oldTreePtr, newTreePtr);
    } finally {
      if (oldTreePtr) this._lib.symbols.git_tree_free(oldTreePtr);
      if (newTreePtr) this._lib.symbols.git_tree_free(newTreePtr);
      if (oldCommitPtr) this._lib.symbols.git_commit_free(oldCommitPtr);
      if (newCommitPtr) this._lib.symbols.git_commit_free(newCommitPtr);
    }
  }

  /**
   * Create a diff between a commit and the working directory
   * @param commitOid - OID of commit to diff against
   * @returns Diff object (must be freed by caller)
   */
  diffTreeToWorkdir(commitOid: string): Diff {
    this.ensureOpen();

    const commitPtr = this.lookupCommitPtr(commitOid);
    let treePtr: Pointer | null = null;

    try {
      const treeOidPtr = this._lib.symbols.git_commit_tree_id(commitPtr);
      const treeOutPtr = createOutPointer();
      const result = this._lib.symbols.git_tree_lookup(
        ptrOf(treeOutPtr),
        this._ptr,
        treeOidPtr,
      );
      checkError(this._lib, result, "Failed to lookup tree");
      treePtr = readPointer(treeOutPtr);

      return diffTreeToWorkdir(this._lib, this._ptr, treePtr);
    } finally {
      if (treePtr) this._lib.symbols.git_tree_free(treePtr);
      this._lib.symbols.git_commit_free(commitPtr);
    }
  }

  /**
   * Create a diff between the index and the working directory
   * @returns Diff object (must be freed by caller)
   */
  diffIndexToWorkdir(): Diff {
    this.ensureOpen();
    return diffIndexToWorkdir(this._lib, this._ptr, null);
  }

  /**
   * Create a patch from a diff entry
   * @param diff - Diff object
   * @param index - Index of the delta in the diff (0-based)
   * @returns Patch object or null if the delta is binary/unchanged
   */
  patchFromDiff(diff: Diff, index: number): Patch | null {
    this.ensureOpen();
    return patchFromDiff(this._lib, diff, index);
  }

  // ==================== Graph Operations ====================

  /**
   * Count the number of unique commits between two commit objects.
   *
   * This is useful for determining how many commits a branch is ahead/behind another.
   *
   * @param localOid - The commit OID for local (hex string)
   * @param upstreamOid - The commit OID for upstream (hex string)
   * @returns Object with ahead and behind counts
   */
  aheadBehind(localOid: string, upstreamOid: string): AheadBehindResult {
    this.ensureOpen();
    return aheadBehindFn(this._lib, this._ptr, localOid, upstreamOid);
  }

  /**
   * Determine if a commit is the descendant of another commit.
   *
   * Note that a commit is NOT considered a descendant of itself.
   *
   * @param commitOid - The commit OID to check (hex string)
   * @param ancestorOid - The potential ancestor commit OID (hex string)
   * @returns true if commit is a descendant of ancestor, false otherwise
   */
  isDescendantOf(commitOid: string, ancestorOid: string): boolean {
    this.ensureOpen();
    return isDescendantOfFn(this._lib, this._ptr, commitOid, ancestorOid);
  }

  // ==================== Describe Operations ====================

  /**
   * Describe a commit
   * @param oid - Commit OID (hex string)
   * @param options - Describe options
   * @returns Description string (e.g., "v1.0.0-5-g1234567")
   */
  describeCommit(oid: string, options?: DescribeOptions): string {
    this.ensureOpen();
    return describeCommitFn(this._lib, this._ptr, oid, options);
  }

  /**
   * Describe the workdir (includes dirty status)
   * @param options - Describe options
   * @returns Description string
   */
  describeWorkdir(options?: DescribeOptions): string {
    this.ensureOpen();
    return describeWorkdirFn(this._lib, this._ptr, options);
  }

  // ==================== Notes Operations ====================

  /**
   * Create a note on an object
   * @param oid - OID of the object to annotate (hex string)
   * @param message - Note message
   * @param signature - Author/committer signature
   * @param options - Create options
   * @returns OID of the created note
   */
  createNote(
    oid: string,
    message: string,
    signature: SignatureInfo,
    options?: NoteCreateOptions,
  ): string {
    this.ensureOpen();
    return createNoteFn(this._lib, this._ptr, oid, message, signature, options);
  }

  /**
   * Read a note from an object
   * @param oid - OID of the annotated object (hex string)
   * @param options - Read options
   * @returns Note object or null if not found (must be freed by caller)
   */
  readNote(oid: string, options?: NoteReadOptions): Note | null {
    this.ensureOpen();
    return readNoteFn(this._lib, this._ptr, oid, options);
  }

  /**
   * Remove a note from an object
   * @param oid - OID of the annotated object (hex string)
   * @param signature - Author/committer signature
   * @param options - Options including notes reference
   */
  removeNote(
    oid: string,
    signature: SignatureInfo,
    options?: NoteReadOptions,
  ): void {
    this.ensureOpen();
    removeNoteFn(this._lib, this._ptr, oid, signature, options);
  }

  /**
   * List all notes in the repository
   * @param options - Options including notes reference
   * @returns Array of note entries
   */
  listNotes(
    options?: NoteReadOptions,
  ): Array<{ noteOid: string; annotatedOid: string }> {
    this.ensureOpen();
    return listNotesFn(this._lib, this._ptr, options);
  }

  /**
   * Get the default notes reference for this repository
   * @returns Default notes reference (e.g., "refs/notes/commits")
   */
  defaultNotesRef(): string {
    this.ensureOpen();
    return defaultNotesRefFn(this._lib, this._ptr);
  }

  // ==================== Worktree Operations ====================

  /**
   * List all worktrees for this repository
   * @returns Array of worktree names
   */
  listWorktrees(): string[] {
    this.ensureOpen();
    return listWorktrees(this._lib, this._ptr);
  }

  /**
   * Lookup a worktree by name
   * @param name - Worktree name
   * @returns Worktree object or null if not found
   */
  lookupWorktree(name: string): Worktree | null {
    this.ensureOpen();
    return lookupWorktree(this._lib, this._ptr, name);
  }

  /**
   * Add a new worktree
   * @param name - Worktree name
   * @param path - Path to create worktree at
   * @param options - Add options
   * @returns New Worktree object (must be freed by caller)
   */
  addWorktree(
    name: string,
    path: string,
    options?: WorktreeAddOptions,
  ): Worktree {
    this.ensureOpen();
    return addWorktree(this._lib, this._ptr, name, path, options);
  }

  /**
   * Open worktree from this repository (if it is a worktree)
   * @returns Worktree object or null if not a worktree
   */
  openWorktree(): Worktree | null {
    this.ensureOpen();
    return openWorktreeFromRepository(this._lib, this._ptr);
  }

  // ==================== Apply Operations ====================

  /**
   * Apply a diff to the repository
   * @param diff - Diff to apply
   * @param location - Where to apply the diff (WORKDIR, INDEX, or BOTH)
   */
  apply(diff: Diff, location: ApplyLocation): void {
    this.ensureOpen();
    applyFn(this._lib, this._ptr, diff, location);
  }

  /**
   * Apply a diff to a tree, producing an index
   * @param commitOid - OID of commit whose tree to apply diff to
   * @param diff - Diff to apply
   * @returns Index with the applied changes (must be freed by caller)
   */
  applyToTree(commitOid: string, diff: Diff): Index {
    this.ensureOpen();

    const commitPtr = this.lookupCommitPtr(commitOid);
    let treePtr: Pointer | null = null;

    try {
      const treeOidPtr = this._lib.symbols.git_commit_tree_id(commitPtr);
      const treeOutPtr = createOutPointer();
      const result = this._lib.symbols.git_tree_lookup(
        ptrOf(treeOutPtr),
        this._ptr,
        treeOidPtr,
      );
      checkError(this._lib, result, "Failed to lookup tree");
      treePtr = readPointer(treeOutPtr);

      return applyToTreeFn(this._lib, this._ptr, treePtr, diff);
    } finally {
      if (treePtr) this._lib.symbols.git_tree_free(treePtr);
      this._lib.symbols.git_commit_free(commitPtr);
    }
  }

  // ==================== Revert Operations ====================

  /**
   * Revert a commit against another commit, producing an index
   * @param revertCommitOid - OID of commit to revert
   * @param ourCommitOid - OID of commit to revert against (e.g., HEAD)
   * @param options - Revert options
   * @returns Index containing the revert result (must be freed by caller)
   */
  revertCommit(
    revertCommitOid: string,
    ourCommitOid: string,
    options?: RevertOptions,
  ): Index {
    this.ensureOpen();

    const revertCommit = this.lookupCommitPtr(revertCommitOid);
    const ourCommit = this.lookupCommitPtr(ourCommitOid);

    try {
      return revertCommitFn(
        this._lib,
        this._ptr,
        revertCommit,
        ourCommit,
        options?.mainline ?? 0,
      );
    } finally {
      this._lib.symbols.git_commit_free(revertCommit);
      this._lib.symbols.git_commit_free(ourCommit);
    }
  }

  /**
   * Revert a commit, modifying the index and working directory
   * @param commitOid - OID of commit to revert
   */
  revert(commitOid: string): void {
    this.ensureOpen();

    const commit = this.lookupCommitPtr(commitOid);
    try {
      revertFn(this._lib, this._ptr, commit);
    } finally {
      this._lib.symbols.git_commit_free(commit);
    }
  }

  // ==================== Blame Operations ====================

  /**
   * Get blame information for a file
   * @param path - Path to the file relative to repository root
   * @param options - Blame options
   * @returns Blame object (must be freed by caller)
   */
  blameFile(path: string, options?: BlameOptions): Blame {
    this.ensureOpen();
    return blameFileFn(this._lib, this._ptr, path, options);
  }

  // ==================== Reflog Operations ====================

  /**
   * Read the reflog for a reference
   * @param name - Reference name (e.g., "HEAD", "refs/heads/main")
   * @returns Reflog object (must be freed by caller)
   */
  readReflog(name: string): Reflog {
    this.ensureOpen();
    return readReflog(this._lib, this._ptr, name);
  }

  /**
   * Delete the reflog for a reference
   * @param name - Reference name
   */
  deleteReflog(name: string): void {
    this.ensureOpen();
    deleteReflog(this._lib, this._ptr, name);
  }

  /**
   * Rename a reflog
   * @param oldName - Old reference name
   * @param newName - New reference name
   */
  renameReflog(oldName: string, newName: string): void {
    this.ensureOpen();
    renameReflog(this._lib, this._ptr, oldName, newName);
  }

  // ==================== Submodule Operations ====================

  /**
   * List all submodule names in the repository
   * @returns Array of submodule names
   */
  listSubmodules(): string[] {
    this.ensureOpen();
    return listSubmodules(this._lib, this._ptr);
  }

  /**
   * Lookup a submodule by name or path
   * @param name - Submodule name or path
   * @returns Submodule object (must be freed by caller)
   */
  lookupSubmodule(name: string): Submodule {
    this.ensureOpen();
    return lookupSubmodule(this._lib, this._ptr, name);
  }

  /**
   * Get the status of a submodule
   * @param name - Submodule name
   * @param ignore - Ignore setting (optional)
   * @returns Status flags
   */
  submoduleStatus(name: string, ignore?: GitSubmoduleIgnore): number {
    this.ensureOpen();
    return submoduleStatus(this._lib, this._ptr, name, ignore);
  }

  // ==================== Stash Operations ====================

  /**
   * Save the local modifications to a new stash
   * @param options - Stash save options
   * @returns OID of the stash commit, or null if nothing to stash
   */
  stashSave(options: StashSaveOptions): string | null {
    this.ensureOpen();
    return stashSave(this._ptr, options);
  }

  /**
   * Apply a stashed state from the stash list
   * @param index - Position in the stash list (0 = most recent)
   * @param options - Apply options
   */
  stashApply(index: number, options?: StashApplyOptions): void {
    this.ensureOpen();
    stashApply(this._ptr, index, options);
  }

  /**
   * Apply a stashed state and remove it from the stash list
   * @param index - Position in the stash list (0 = most recent)
   * @param options - Apply options
   */
  stashPop(index: number, options?: StashApplyOptions): void {
    this.ensureOpen();
    stashPop(this._ptr, index, options);
  }

  /**
   * Remove a stashed state from the stash list
   * @param index - Position in the stash list (0 = most recent)
   */
  stashDrop(index: number): void {
    this.ensureOpen();
    stashDrop(this._ptr, index);
  }

  /**
   * List all stashed states
   * @returns Array of stash entries
   */
  listStashes(): StashEntry[] {
    this.ensureOpen();
    return listStashes(this._ptr);
  }

  // ==================== Tag Operations ====================

  /**
   * Create an annotated tag
   * @param options - Tag creation options
   * @returns OID of the created tag
   */
  createTag(options: CreateTagOptions): string {
    this.ensureOpen();
    return createTag(this._ptr, options);
  }

  /**
   * Create a lightweight tag
   * @param options - Tag creation options
   * @returns OID of the target object
   */
  createLightweightTag(options: CreateLightweightTagOptions): string {
    this.ensureOpen();
    return createLightweightTag(this._ptr, options);
  }

  /**
   * List all tags in the repository
   * @param pattern - Optional fnmatch pattern to filter tags
   * @returns Array of tag names
   */
  listTags(pattern?: string): string[] {
    this.ensureOpen();
    return listTags(this._ptr, pattern);
  }

  /**
   * Lookup a tag by OID
   * @param oid - Tag OID
   * @returns Tag object (must be freed by caller)
   */
  lookupTag(oid: string): Tag {
    this.ensureOpen();
    return lookupTag(this._ptr, oid);
  }

  /**
   * Delete a tag by name
   * @param name - Tag name
   */
  deleteTag(name: string): void {
    this.ensureOpen();
    deleteTag(this._ptr, name);
  }

  /**
   * Iterate over all tags in the repository
   * @returns Array of tag info objects
   */
  foreachTag(): TagForeachInfo[] {
    this.ensureOpen();
    return foreachTag(this._ptr);
  }

  // ==================== Config Operations ====================

  /**
   * Get the repository configuration
   * @returns Config object (must be freed by caller)
   */
  config(): Config {
    this.ensureOpen();
    return getRepositoryConfig(this._ptr);
  }

  // ==================== Pathspec Operations ====================

  /**
   * Create a compiled pathspec from an array of patterns
   * @param patterns - Array of pathspec patterns (e.g., ["*.txt", "src/*"])
   * @returns A compiled Pathspec object
   */
  createPathspec(patterns: string[]): Pathspec {
    this.ensureOpen();
    return createPathspec(this._lib, patterns);
  }

  // ==================== Ignore Operations ====================

  /**
   * Add ignore rules for the repository.
   * Rules added via this function are in-memory only and will not persist.
   * @param rules - Text of rules, a la .gitignore file contents.
   *                Multiple rules should be separated by newlines.
   */
  addIgnoreRule(rules: string): void {
    this.ensureOpen();
    addIgnoreRuleFn(this._lib, this._ptr, rules);
  }

  /**
   * Clear ignore rules that were explicitly added via addIgnoreRule.
   * Resets to the default internal ignore rules (".", "..", ".git").
   * This does NOT affect rules in actual .gitignore files.
   */
  clearIgnoreRules(): void {
    this.ensureOpen();
    clearIgnoreRulesFn(this._lib, this._ptr);
  }

  /**
   * Test if the ignore rules apply to a given path.
   * Equivalent to `git check-ignore --no-index`.
   * @param path - File path to check, relative to the repo's workdir
   * @returns true if the path is ignored, false otherwise
   */
  pathIsIgnored(path: string): boolean {
    this.ensureOpen();
    return pathIsIgnoredFn(this._lib, this._ptr, path);
  }

  // ==================== Mailmap Operations ====================

  /**
   * Get the mailmap for this repository
   * @returns A Mailmap instance loaded from the repository's configuration
   */
  getMailmap(): Mailmap {
    this.ensureOpen();
    return Mailmap.fromRepository(this._ptr);
  }

  // ==================== Remote Operations ====================

  /**
   * Create a new remote
   * @param name - Remote name
   * @param url - Remote URL
   * @returns The created remote
   */
  createRemote(name: string, url: string): Remote {
    this.ensureOpen();
    const remote = createRemote(this._ptr, name, url);
    remote.free(); // Free immediately since we just need to create it
    return this.lookupRemote(name)!;
  }

  /**
   * Look up a remote by name
   * @param name - Remote name
   * @returns The remote or null if not found
   */
  lookupRemote(name: string): Remote | null {
    this.ensureOpen();
    return lookupRemote(this._ptr, name);
  }

  /**
   * List all remotes in the repository
   * @returns Array of remote names
   */
  listRemotes(): string[] {
    this.ensureOpen();
    return listRemotes(this._ptr);
  }

  /**
   * Set the URL for a remote
   * @param name - Remote name
   * @param url - New URL
   */
  setRemoteUrl(name: string, url: string): void {
    this.ensureOpen();
    setRemoteUrl(this._ptr, name, url);
  }

  /**
   * Set the push URL for a remote
   * @param name - Remote name
   * @param url - New push URL
   */
  setRemotePushUrl(name: string, url: string): void {
    this.ensureOpen();
    setRemotePushUrl(this._ptr, name, url);
  }

  /**
   * Delete a remote
   * @param name - Remote name
   */
  deleteRemote(name: string): void {
    this.ensureOpen();
    deleteRemote(this._ptr, name);
  }

  /**
   * Rename a remote
   * @param oldName - Current remote name
   * @param newName - New remote name
   * @returns Array of problems encountered (empty if successful)
   */
  renameRemote(oldName: string, newName: string): string[] {
    this.ensureOpen();
    return renameRemote(this._ptr, oldName, newName);
  }

  // ==================== ODB Operations ====================

  /**
   * Get the object database for this repository
   * @returns The ODB
   */
  odb(): Odb {
    this.ensureOpen();
    return getRepositoryOdb(this._ptr);
  }

  // ==================== Attribute Operations ====================

  /**
   * Get a single attribute for a path
   * @param path - Path to check attributes for
   * @param name - Attribute name to look up
   * @param flags - Optional check flags
   * @returns Attribute result with type and optional value
   */
  getAttr(
    path: string,
    name: string,
    flags: number = GitAttrCheckFlags.FILE_THEN_INDEX,
  ): AttrResult {
    this.ensureOpen();
    return getAttr(this._lib, this._ptr, path, name, flags);
  }

  /**
   * Get multiple attributes for a path at once
   * @param path - Path to check attributes for
   * @param names - Array of attribute names to look up
   * @param flags - Optional check flags
   * @returns Array of attribute results
   */
  getAttrMany(
    path: string,
    names: string[],
    flags: number = GitAttrCheckFlags.FILE_THEN_INDEX,
  ): AttrResult[] {
    this.ensureOpen();
    return getAttrMany(this._lib, this._ptr, path, names, flags);
  }

  /**
   * Iterate over all attributes for a path
   * @param path - Path to check attributes for
   * @param callback - Callback function for each attribute
   * @param flags - Optional check flags
   */
  foreachAttr(
    path: string,
    callback: AttrForeachCallback,
    flags: number = GitAttrCheckFlags.FILE_THEN_INDEX,
  ): void {
    this.ensureOpen();
    foreachAttr(this._lib, this._ptr, path, callback, flags);
  }

  /**
   * Flush the gitattributes cache
   */
  attrCacheFlush(): void {
    this.ensureOpen();
    attrCacheFlush(this._lib, this._ptr);
  }

  /**
   * Add a macro definition
   * @param name - Macro name
   * @param values - Space-separated list of attribute values
   */
  addAttrMacro(name: string, values: string): void {
    this.ensureOpen();
    addAttrMacro(this._lib, this._ptr, name, values);
  }

  // ==================== Rebase Operations ====================

  /**
   * Initialize a new rebase operation
   * @param branchRef - Branch to rebase (ref name like "feature" or "refs/heads/feature")
   * @param upstreamRef - Upstream branch (ref name like "main" or "refs/heads/main")
   * @param options - Rebase options
   * @returns Rebase object (must be freed by caller)
   */
  initRebase(
    branchRef: string,
    upstreamRef: string,
    options?: RebaseOptions,
  ): Rebase {
    this.ensureOpen();

    // Create annotated commits from revspecs (branch names work as revspecs)
    const branch = AnnotatedCommit.fromRevspec(this._lib, this._ptr, branchRef);
    const upstream = AnnotatedCommit.fromRevspec(
      this._lib,
      this._ptr,
      upstreamRef,
    );

    try {
      return initRebase(
        this._lib,
        this._ptr,
        branch,
        upstream,
        undefined,
        options,
      );
    } finally {
      // Note: We don't free the annotated commits here because
      // the rebase operation may still need them
    }
  }

  /**
   * Open an existing rebase operation
   * @param options - Rebase options
   * @returns Rebase object (must be freed by caller)
   */
  openRebase(options?: RebaseOptions): Rebase {
    this.ensureOpen();
    return openRebase(this._lib, this._ptr, options);
  }

  // ==================== Static Helpers ====================

  /**
   * Use the repository with automatic cleanup
   */
  static use<T>(path: string, fn: (repo: Repository) => T): T {
    using repo = Repository.open(path);
    return fn(repo);
  }

  /**
   * Use the repository with automatic cleanup (async version)
   */
  static async useAsync<T>(
    path: string,
    fn: (repo: Repository) => Promise<T>,
  ): Promise<T> {
    using repo = Repository.open(path);
    return await fn(repo);
  }
}
