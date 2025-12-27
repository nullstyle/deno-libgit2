/**
 * @module deno-libgit2
 *
 * A Deno FFI binding for libgit2, providing Git repository operations
 * through the native libgit2 library.
 *
 * @example Basic usage
 * ```typescript
 * import { init, shutdown, Repository } from "jsr:@manus/libgit2";
 *
 * // Initialize the library (uses @denosaurs/plug for cross-platform resolution)
 * await init();
 *
 * try {
 *   // Open a repository
 *   using repo = Repository.open("/path/to/repo");
 *
 *   // Get repository info
 *   console.log("Path:", repo.path);
 *   console.log("Is bare:", repo.isBare);
 *
 *   // Get HEAD
 *   const head = repo.head();
 *   console.log("HEAD:", head.name);
 *
 *   // List branches
 *   const branches = repo.listBranches();
 *   for (const branch of branches) {
 *     console.log("Branch:", branch.name);
 *   }
 *
 *   // Get commit history
 *   const commits = repo.getCommits(undefined, 10);
 *   for (const commit of commits) {
 *     console.log(commit.oid.slice(0, 7), commit.message.split("\n")[0]);
 *   }
 *
 * } finally {
 *   shutdown();
 * }
 * ```
 *
 * @example Finding deleted file history
 * ```typescript
 * import { init, shutdown, Repository, findFileDeletion, findFileHistory } from "jsr:@manus/libgit2";
 *
 * await init();
 *
 * try {
 *   using repo = Repository.open("/path/to/repo");
 *
 *   // Find when a file was deleted and get its last content
 *   const deletion = findFileDeletion(repo, ".dork/blocks/some-uuid.md");
 *   if (deletion) {
 *     console.log("Deleted in:", deletion.deletedInCommit.commitOid);
 *     console.log("Last existed in:", deletion.lastExistedInCommit.commitOid);
 *     console.log("Content:", deletion.lastContent);
 *   }
 *
 *   // Find all commits where a file existed
 *   const history = findFileHistory(repo, "path/to/file.md");
 *   console.log(`File appeared in ${history.commits.length} commits`);
 *
 * } finally {
 *   shutdown();
 * }
 * ```
 */

// Library management
export {
  getLibrary,
  init,
  type InitOptions,
  isLibraryLoaded,
  LIBGIT2_VERSION,
  loadLibrary,
  shutdown,
  version,
  versionString,
  withLibrary,
} from "./src/library.ts";

// Types and enums
export {
  type AnnotatedCommitInfo,
  type BlameHunk,
  type BlameOptions,
  type BranchInfo,
  type CloneOptions,
  type CommitInfo,
  type ConflictEntry,
  type DiffOptions,
  type FetchOptions,
  GIT_OID_HEXSIZE,
  GIT_OID_SHA1_HEXSIZE,
  GIT_OID_SHA1_SIZE,
  GIT_OID_SHA256_HEXSIZE,
  GIT_OID_SHA256_SIZE,
  // Constants
  GIT_OID_SIZE,
  // Blame types
  GitBlameFlags,
  GitBranchType,
  GitCheckoutStrategy,
  type GitDiffDelta,
  GitDiffFlags,
  GitErrorClass,
  GitErrorCode,
  // Merge enums
  GitMergeAnalysis,
  GitMergeFileFavor,
  GitMergeFlag,
  GitMergePreference,
  // Enums
  GitObjectType,
  type GitOid,
  GitReferenceType,
  GitRepositoryInitFlags,
  GitRepositoryOpenFlags,
  GitRepositoryState,
  GitResetType,
  type GitSignature,
  type GitStatusEntry,
  GitStatusFlags,
  // Merge types
  type MergeAnalysisResult,
  type MergeOptions,
  // Types
  type Pointer,
  type PushOptions,
  type ReferenceInfo,
  type RemoteInfo,
  type StatusOptions,
  type TagInfo,
} from "./src/types.ts";

// Error handling
export {
  checkError,
  getErrorMessage,
  getLastError,
  GitError,
} from "./src/error.ts";

// Repository
export { Repository } from "./src/repository.ts";

// Index
export { Index, type IndexEntry } from "./src/index.ts";

// Commit operations
export {
  amendCommit,
  createCommit,
  type CreateCommitOptions,
  createSignature,
  getCommit,
  getDefaultSignature,
  type SignatureInput,
} from "./src/commit.ts";

// Tree operations
export {
  getTreeEntryByPath,
  GitFileMode,
  Tree,
  TreeEntry,
  type TreeEntryInfo,
  treeHasPath,
} from "./src/tree.ts";

// Blob operations
export {
  Blob,
  fileExistsAtCommit,
  getBlobContent,
  getBlobRawContent,
  getFileAtCommit,
  getFileContent,
  getFileRawAtCommit,
  getFileRawContent,
} from "./src/blob.ts";

// File history operations
export {
  type FileCommitInfo,
  type FileDeletionInfo,
  fileExistsAtHead,
  type FileHistoryResult,
  findFileCreation,
  findFileDeletion,
  findFileHistory,
  findFileModifications,
  getFileAtCommits,
  getFileAtHead,
} from "./src/file_history.ts";

// Utilities
export {
  bytesToHex,
  formatGitTime,
  fromCString,
  hexToBytes,
  toCString,
} from "./src/utils.ts";

// Merge operations
export {
  AnnotatedCommit,
  getConflicts,
  merge,
  mergeAnalysis,
  mergeBase,
  mergeCommits,
  stateCleanup,
} from "./src/merge.ts";

// Blame operations
export { Blame, blameFile } from "./src/blame.ts";

// Reflog operations
export {
  deleteReflog,
  readReflog,
  Reflog,
  type ReflogEntry,
  renameReflog,
} from "./src/reflog.ts";

// Submodule operations
export {
  GitSubmoduleIgnore,
  GitSubmoduleStatus,
  GitSubmoduleUpdate,
  listSubmodules,
  lookupSubmodule,
  setSubmoduleBranch,
  setSubmoduleUrl,
  Submodule,
  type SubmoduleInfo,
  submoduleStatus,
} from "./src/submodule.ts";

// Cherry-pick operations
export {
  cherrypick,
  cherrypickCommit,
  type CherrypickOptions,
} from "./src/cherrypick.ts";

// Revert operations
export { revert, revertCommit, type RevertOptions } from "./src/revert.ts";

// Diff operations
export {
  Diff,
  type DiffDelta,
  DiffDeltaType,
  type DiffFile,
  DiffFileFlags,
  diffIndexToWorkdir,
  diffTreeToIndex,
  diffTreeToTree,
  diffTreeToWorkdir,
} from "./src/diff.ts";

// Patch operations
export { Patch, patchFromDiff, type PatchLineStats } from "./src/patch.ts";

// Apply operations
export { apply, ApplyLocation, applyToTree } from "./src/apply.ts";

// Graph operations
export {
  aheadBehind,
  type AheadBehindResult,
  isDescendantOf,
} from "./src/graph.ts";

// Stash operations
export {
  listStashes,
  stashApply,
  StashApplyFlags,
  type StashApplyOptions,
  stashDrop,
  type StashEntry,
  StashFlags,
  stashPop,
  stashSave,
  type StashSaveOptions,
} from "./src/stash.ts";

// Describe operations
export {
  describeCommit,
  type DescribeFormatOptions,
  type DescribeOptions,
  DescribeStrategy,
  describeWorkdir,
} from "./src/describe.ts";

// Notes operations
export {
  createNote,
  defaultNotesRef,
  listNotes,
  Note,
  type NoteCreateOptions,
  type NoteEntry,
  type NoteReadOptions,
  readNote,
  removeNote,
} from "./src/notes.ts";

// Worktree operations
export {
  addWorktree,
  listWorktrees,
  lookupWorktree,
  openWorktreeFromRepository,
  Worktree,
  type WorktreeAddOptions,
  type WorktreeLockInfo,
  WorktreePruneFlags,
  type WorktreePruneOptions,
} from "./src/worktree.ts";

// Signature operations
export {
  createSignatureNow,
  freeSignature,
  Signature,
  type SignatureInfo,
} from "./src/signature.ts";

// Rebase operations
export {
  GitRebaseOperationType,
  initRebase,
  openRebase,
  Rebase,
  type RebaseCommitOptions,
  type RebaseOperation,
  type RebaseOptions,
} from "./src/rebase.ts";

// Config operations
export {
  Config,
  type ConfigEntry,
  type ConfigForeachCallback,
  getRepositoryConfig,
  GitConfigLevel,
} from "./src/config.ts";

// Tag operations
export {
  createLightweightTag,
  type CreateLightweightTagOptions,
  createTag,
  type CreateTagOptions,
  deleteTag,
  foreachTag,
  GitObjectType as TagObjectType,
  listTags,
  lookupTag,
  Tag,
  type TagForeachInfo,
} from "./src/tag.ts";

// Attr operations
export {
  type AttrForeachCallback,
  type AttrResult,
  GitAttrCheckFlags,
  GitAttrValue,
} from "./src/attr.ts";

// Pathspec operations
export {
  createPathspec,
  GitPathspecFlags,
  Pathspec,
  PathspecMatchList,
} from "./src/pathspec.ts";

// Ignore operations
export {
  addIgnoreRule,
  clearIgnoreRules,
  pathIsIgnored,
} from "./src/ignore.ts";

// Mailmap operations
export { Mailmap, type ResolvedIdentity } from "./src/mailmap.ts";

// Message operations
export {
  type MessageTrailer,
  parseTrailers,
  prettifyMessage,
} from "./src/message.ts";

// Remote operations
export { Remote } from "./src/remote.ts";

// ODB operations
export { Odb, OdbObject, type OdbObjectHeader } from "./src/odb.ts";

// FFI symbols (for advanced usage)
export { symbols } from "./src/ffi.ts";
