/**
 * @module types
 * Core types and constants for libgit2 FFI bindings
 */

/** Size of SHA-1 OID in bytes */
export const GIT_OID_SHA1_SIZE = 20;

/** Size of SHA-1 OID as hex string (including null terminator) */
export const GIT_OID_SHA1_HEXSIZE = 41;

/** Size of SHA-256 OID in bytes */
export const GIT_OID_SHA256_SIZE = 32;

/** Size of SHA-256 OID as hex string (including null terminator) */
export const GIT_OID_SHA256_HEXSIZE = 65;

/** Default OID size (SHA-1) */
export const GIT_OID_SIZE = GIT_OID_SHA1_SIZE;

/** Default OID hex size */
export const GIT_OID_HEXSIZE = GIT_OID_SHA1_HEXSIZE;

/**
 * Git object types
 */
export enum GitObjectType {
  /** Object can be any of the following */
  ANY = -2,
  /** Object is invalid */
  INVALID = -1,
  /** A commit object */
  COMMIT = 1,
  /** A tree (directory listing) object */
  TREE = 2,
  /** A file revision object */
  BLOB = 3,
  /** An annotated tag object */
  TAG = 4,
  /** A delta, base is given by an offset */
  OFS_DELTA = 6,
  /** A delta, base is given by object id */
  REF_DELTA = 7,
}

/**
 * Git reference types
 */
export enum GitReferenceType {
  /** Invalid reference */
  INVALID = 0,
  /** A reference that points at an object id */
  DIRECT = 1,
  /** A reference that points at another reference */
  SYMBOLIC = 2,
  /** All reference types */
  ALL = DIRECT | SYMBOLIC,
}

/**
 * Git branch types
 */
export enum GitBranchType {
  /** Local branch */
  LOCAL = 1,
  /** Remote branch */
  REMOTE = 2,
  /** All branches */
  ALL = LOCAL | REMOTE,
}

/**
 * Status flags for a single file
 */
export enum GitStatusFlags {
  CURRENT = 0,
  INDEX_NEW = 1 << 0,
  INDEX_MODIFIED = 1 << 1,
  INDEX_DELETED = 1 << 2,
  INDEX_RENAMED = 1 << 3,
  INDEX_TYPECHANGE = 1 << 4,
  WT_NEW = 1 << 7,
  WT_MODIFIED = 1 << 8,
  WT_DELETED = 1 << 9,
  WT_TYPECHANGE = 1 << 10,
  WT_RENAMED = 1 << 11,
  WT_UNREADABLE = 1 << 12,
  IGNORED = 1 << 14,
  CONFLICTED = 1 << 15,
}

/**
 * Repository open flags
 */
export enum GitRepositoryOpenFlags {
  /** No flags */
  NONE = 0,
  /** Only open the repository if it can be immediately found */
  NO_SEARCH = 1 << 0,
  /** Open repository in cross-filesystem mode */
  CROSS_FS = 1 << 1,
  /** Open repository as a bare repo regardless of core.bare config */
  BARE = 1 << 2,
  /** Do not check for a repository by appending /.git to the path */
  NO_DOTGIT = 1 << 3,
  /** Find and open a git repository, respecting the environment variables */
  FROM_ENV = 1 << 4,
}

/**
 * Repository init flags
 */
export enum GitRepositoryInitFlags {
  /** Create a bare repository with no working directory */
  BARE = 1 << 0,
  /** Return an error if the path appears to already be a git repository */
  NO_REINIT = 1 << 1,
  /** Normally a "/.git/" will be appended to the repo path */
  NO_DOTGIT_DIR = 1 << 2,
  /** Make the repo_path (and workdir_path) as needed */
  MKDIR = 1 << 3,
  /** Recursively make all components of the repo and workdir paths as needed */
  MKPATH = 1 << 4,
  /** libgit2 normally uses internal templates to initialize a new repo */
  EXTERNAL_TEMPLATE = 1 << 5,
  /** If an alternate workdir is specified, use relative paths for the gitdir and core.worktree */
  RELATIVE_GITLINK = 1 << 6,
}

/**
 * Repository state
 */
export enum GitRepositoryState {
  NONE = 0,
  MERGE = 1,
  REVERT = 2,
  REVERT_SEQUENCE = 3,
  CHERRYPICK = 4,
  CHERRYPICK_SEQUENCE = 5,
  BISECT = 6,
  REBASE = 7,
  REBASE_INTERACTIVE = 8,
  REBASE_MERGE = 9,
  APPLY_MAILBOX = 10,
  APPLY_MAILBOX_OR_REBASE = 11,
}

/**
 * Checkout strategy flags
 */
export enum GitCheckoutStrategy {
  /** Default is a dry run, no actual updates */
  NONE = 0,
  /** Allow safe updates that cannot overwrite uncommitted data */
  SAFE = 1 << 0,
  /** Allow all updates to force working directory to look like index */
  FORCE = 1 << 1,
  /** Allow checkout to recreate missing files */
  RECREATE_MISSING = 1 << 2,
  /** Allow checkout to make safe updates even if conflicts are found */
  ALLOW_CONFLICTS = 1 << 4,
  /** Remove untracked files not in index (that are not ignored) */
  REMOVE_UNTRACKED = 1 << 5,
  /** Remove ignored files not in index */
  REMOVE_IGNORED = 1 << 6,
  /** Only update existing files, don't create new ones */
  UPDATE_ONLY = 1 << 7,
  /** Normally checkout updates index entries as it goes; this stops that */
  DONT_UPDATE_INDEX = 1 << 8,
  /** Don't refresh index/config/etc before doing checkout */
  NO_REFRESH = 1 << 9,
  /** Allow checkout to skip unmerged files */
  SKIP_UNMERGED = 1 << 10,
  /** For unmerged files, checkout stage 2 from index */
  USE_OURS = 1 << 11,
  /** For unmerged files, checkout stage 3 from index */
  USE_THEIRS = 1 << 12,
  /** Treat pathspec as simple list of exact match file paths */
  DISABLE_PATHSPEC_MATCH = 1 << 13,
  /** Ignore directories in use, they will be left empty */
  SKIP_LOCKED_DIRECTORIES = 1 << 18,
  /** Don't overwrite ignored files that exist in the checkout target */
  DONT_OVERWRITE_IGNORED = 1 << 19,
  /** Write normal merge files for conflicts */
  CONFLICT_STYLE_MERGE = 1 << 20,
  /** Include common ancestor data in diff3 format files for conflicts */
  CONFLICT_STYLE_DIFF3 = 1 << 21,
  /** Don't overwrite existing files or folders */
  DONT_REMOVE_EXISTING = 1 << 22,
  /** Normally checkout writes the index upon completion; this prevents that */
  DONT_WRITE_INDEX = 1 << 23,
}

/**
 * Reset types
 */
export enum GitResetType {
  /** Move the head to the given commit */
  SOFT = 1,
  /** SOFT plus reset index to the commit */
  MIXED = 2,
  /** MIXED plus changes in working tree discarded */
  HARD = 3,
}

/**
 * Diff flags
 */
export enum GitDiffFlags {
  /** Normal diff, the default */
  NORMAL = 0,
  /** Reverse the sides of the diff */
  REVERSE = 1 << 0,
  /** Include ignored files in the diff */
  INCLUDE_IGNORED = 1 << 1,
  /** Even with GIT_DIFF_INCLUDE_IGNORED, an entire ignored directory will be marked with only a single entry in the diff */
  RECURSE_IGNORED_DIRS = 1 << 2,
  /** Include untracked files in the diff */
  INCLUDE_UNTRACKED = 1 << 3,
  /** Even with GIT_DIFF_INCLUDE_UNTRACKED, an entire untracked directory will be marked with only a single entry in the diff */
  RECURSE_UNTRACKED_DIRS = 1 << 4,
  /** Include unmodified files in the diff */
  INCLUDE_UNMODIFIED = 1 << 5,
  /** Normally, a type change between files will be converted into a DELETED record for the old and an ADDED record for the new */
  INCLUDE_TYPECHANGE = 1 << 6,
  /** Even with GIT_DIFF_INCLUDE_TYPECHANGE, blob->tree changes still generally show as a DELETED blob */
  INCLUDE_TYPECHANGE_TREES = 1 << 7,
  /** Ignore file mode changes */
  IGNORE_FILEMODE = 1 << 8,
  /** Treat all submodules as unmodified */
  IGNORE_SUBMODULES = 1 << 9,
  /** Use case insensitive filename comparisons */
  IGNORE_CASE = 1 << 10,
  /** May be combined with GIT_DIFF_IGNORE_CASE to specify that a file that has changed case will be returned as an add/delete pair */
  INCLUDE_CASECHANGE = 1 << 11,
  /** If the pathspec is set in the diff options, this flags indicates that the paths will be treated as literal paths instead of fnmatch patterns */
  DISABLE_PATHSPEC_MATCH = 1 << 12,
  /** Disable updating of the binary flag in delta records */
  SKIP_BINARY_CHECK = 1 << 13,
  /** When generating patch text, include the content of untracked files */
  SHOW_UNTRACKED_CONTENT = 1 << 14,
  /** When generating output, include the names of unmodified files if they are included in the git_diff */
  SHOW_UNMODIFIED = 1 << 15,
  /** Use the "patience diff" algorithm */
  PATIENCE = 1 << 16,
  /** Take extra time to find minimal diff */
  MINIMAL = 1 << 17,
  /** Include the necessary deflate / delta information so that git_patch_to_buf can generate binary patch output */
  SHOW_BINARY = 1 << 18,
  /** Use a heuristic that takes indentation and whitespace into account which generally can produce better diffs when dealing with ambiguous diff hunks */
  INDENT_HEURISTIC = 1 << 19,
}

/**
 * Error codes returned by libgit2 functions
 */
export enum GitErrorCode {
  /** No error */
  OK = 0,
  /** Generic error */
  ERROR = -1,
  /** Requested object could not be found */
  ENOTFOUND = -3,
  /** Object exists preventing operation */
  EEXISTS = -4,
  /** More than one object matches */
  EAMBIGUOUS = -5,
  /** Output buffer too short to hold data */
  EBUFS = -6,
  /** GIT_EUSER is a special error that is never generated by libgit2 code */
  EUSER = -7,
  /** Operation not allowed on bare repository */
  EBAREREPO = -8,
  /** HEAD refers to branch with no commits */
  EUNBORNBRANCH = -9,
  /** Merge in progress prevented operation */
  EUNMERGED = -10,
  /** Reference was not fast-forwardable */
  ENONFASTFORWARD = -11,
  /** Name/ref spec was not in a valid format */
  EINVALIDSPEC = -12,
  /** Checkout conflicts prevented operation */
  ECONFLICT = -13,
  /** Lock file prevented operation */
  ELOCKED = -14,
  /** Reference value does not match expected */
  EMODIFIED = -15,
  /** Authentication error */
  EAUTH = -16,
  /** Server certificate is invalid */
  ECERTIFICATE = -17,
  /** Patch/merge has already been applied */
  EAPPLIED = -18,
  /** The requested peel operation is not possible */
  EPEEL = -19,
  /** Unexpected EOF */
  EEOF = -20,
  /** Invalid operation or input */
  EINVALID = -21,
  /** Uncommitted changes in index prevented operation */
  EUNCOMMITTED = -22,
  /** The operation is not valid for a directory */
  EDIRECTORY = -23,
  /** A merge conflict exists and cannot continue */
  EMERGECONFLICT = -24,
  /** A user-configured callback refused to act */
  PASSTHROUGH = -30,
  /** Signals end of iteration with iterator */
  ITEROVER = -31,
  /** Internal only */
  RETRY = -32,
  /** Hashsum mismatch in object */
  EMISMATCH = -33,
  /** Unsaved changes in the index would be overwritten */
  EINDEXDIRTY = -34,
  /** Patch application failed */
  EAPPLYFAIL = -35,
  /** The object is not owned by the current user */
  EOWNER = -36,
  /** The operation timed out */
  TIMEOUT = -37,
}

/**
 * Error classes
 */
export enum GitErrorClass {
  NONE = 0,
  NOMEMORY = 1,
  OS = 2,
  INVALID = 3,
  REFERENCE = 4,
  ZLIB = 5,
  REPOSITORY = 6,
  CONFIG = 7,
  REGEX = 8,
  ODB = 9,
  INDEX = 10,
  OBJECT = 11,
  NET = 12,
  TAG = 13,
  TREE = 14,
  INDEXER = 15,
  SSL = 16,
  SUBMODULE = 17,
  THREAD = 18,
  STASH = 19,
  CHECKOUT = 20,
  FETCHHEAD = 21,
  MERGE = 22,
  SSH = 23,
  FILTER = 24,
  REVERT = 25,
  CALLBACK = 26,
  CHERRYPICK = 27,
  DESCRIBE = 28,
  REBASE = 29,
  FILESYSTEM = 30,
  PATCH = 31,
  WORKTREE = 32,
  SHA = 33,
  HTTP = 34,
  INTERNAL = 35,
}

/**
 * Opaque pointer type for FFI
 */
export type Pointer = Deno.PointerObject | null;

/**
 * Git signature structure (author/committer info)
 */
export interface GitSignature {
  name: string;
  email: string;
  when: {
    time: bigint;
    offset: number;
    sign: string;
  };
}

/**
 * Git OID (Object ID) representation
 */
export interface GitOid {
  /** Raw bytes of the OID */
  raw: Uint8Array;
  /** Hex string representation */
  hex: string;
}

/**
 * Git status entry
 */
export interface GitStatusEntry {
  /** Status flags */
  status: GitStatusFlags;
  /** Path in the index */
  indexPath?: string;
  /** Path in the working directory */
  workdirPath?: string;
}

/**
 * Git diff delta
 */
export interface GitDiffDelta {
  /** Status of the entry */
  status: string;
  /** Flags for the delta */
  flags: number;
  /** Old file info */
  oldFile: {
    path: string;
    oid: string;
    size: bigint;
    mode: number;
  };
  /** New file info */
  newFile: {
    path: string;
    oid: string;
    size: bigint;
    mode: number;
  };
}

/**
 * Commit information
 */
export interface CommitInfo {
  /** Commit OID */
  oid: string;
  /** Commit message */
  message: string;
  /** Author information */
  author: GitSignature;
  /** Committer information */
  committer: GitSignature;
  /** Parent commit OIDs */
  parents: string[];
  /** Tree OID */
  treeOid: string;
}

/**
 * Reference information
 */
export interface ReferenceInfo {
  /** Reference name */
  name: string;
  /** Reference type */
  type: GitReferenceType;
  /** Target OID (for direct references) */
  target?: string;
  /** Symbolic target (for symbolic references) */
  symbolicTarget?: string;
  /** Whether this is a branch */
  isBranch: boolean;
  /** Whether this is a tag */
  isTag: boolean;
  /** Whether this is a remote reference */
  isRemote: boolean;
}

/**
 * Branch information
 */
export interface BranchInfo {
  /** Branch name */
  name: string;
  /** Full reference name */
  refName: string;
  /** Branch type (local or remote) */
  type: GitBranchType;
  /** Whether this is the current HEAD */
  isHead: boolean;
  /** Target commit OID */
  targetOid?: string;
  /** Upstream branch name (if tracking) */
  upstream?: string;
}

/**
 * Tag information
 */
export interface TagInfo {
  /** Tag name */
  name: string;
  /** Tag OID (for annotated tags) */
  oid?: string;
  /** Target OID */
  targetOid: string;
  /** Target type */
  targetType: GitObjectType;
  /** Tagger information (for annotated tags) */
  tagger?: GitSignature;
  /** Tag message (for annotated tags) */
  message?: string;
}

/**
 * Remote information
 */
export interface RemoteInfo {
  /** Remote name */
  name: string;
  /** Fetch URL */
  url: string;
  /** Push URL (if different from fetch URL) */
  pushUrl?: string;
}

/**
 * Clone options
 */
export interface CloneOptions {
  /** Whether to create a bare repository */
  bare?: boolean;
  /** Branch to checkout */
  checkoutBranch?: string;
  /** Checkout strategy */
  checkoutStrategy?: GitCheckoutStrategy;
}

/**
 * Fetch options
 */
export interface FetchOptions {
  /** Remote name */
  remote?: string;
  /** Refspecs to fetch */
  refspecs?: string[];
  /** Prune remote tracking refs */
  prune?: boolean;
}

/**
 * Push options
 */
export interface PushOptions {
  /** Remote name */
  remote?: string;
  /** Refspecs to push */
  refspecs?: string[];
}

/**
 * Diff options
 */
export interface DiffOptions {
  /** Diff flags */
  flags?: GitDiffFlags;
  /** Number of context lines */
  contextLines?: number;
  /** Number of interhunk lines */
  interhunkLines?: number;
  /** Pathspec patterns */
  pathspec?: string[];
}

/**
 * Status options
 */
export interface StatusOptions {
  /** Show index status */
  showIndex?: boolean;
  /** Show working directory status */
  showWorkdir?: boolean;
  /** Include untracked files */
  includeUntracked?: boolean;
  /** Include ignored files */
  includeIgnored?: boolean;
  /** Pathspec patterns */
  pathspec?: string[];
}

/**
 * Merge analysis results
 */
export enum GitMergeAnalysis {
  /** No merge is possible */
  NONE = 0,
  /** A normal merge is possible */
  NORMAL = 1 << 0,
  /** The repository is already up-to-date */
  UP_TO_DATE = 1 << 1,
  /** A fast-forward merge is possible */
  FASTFORWARD = 1 << 2,
  /** The HEAD is unborn (no commits yet) */
  UNBORN = 1 << 3,
}

/**
 * Merge preference flags
 */
export enum GitMergePreference {
  /** No preference */
  NONE = 0,
  /** Do not allow fast-forward merges */
  NO_FASTFORWARD = 1 << 0,
  /** Only allow fast-forward merges */
  FASTFORWARD_ONLY = 1 << 1,
}

/**
 * Merge flags
 */
export enum GitMergeFlag {
  /** Detect renames */
  FIND_RENAMES = 1 << 0,
  /** Fail on conflict */
  FAIL_ON_CONFLICT = 1 << 1,
  /** Skip REUC entries */
  SKIP_REUC = 1 << 2,
  /** Do not use recursive merge */
  NO_RECURSIVE = 1 << 3,
  /** Treat this merge as a virtual base */
  VIRTUAL_BASE = 1 << 4,
}

/**
 * Merge file favor options
 */
export enum GitMergeFileFavor {
  /** When a region of a file is changed in both branches, a conflict is recorded */
  NORMAL = 0,
  /** When a region of a file is changed in both branches, the file created in the index will contain the "ours" side of any conflicting region */
  OURS = 1,
  /** When a region of a file is changed in both branches, the file created in the index will contain the "theirs" side of any conflicting region */
  THEIRS = 2,
  /** When a region of a file is changed in both branches, the file created in the index will contain each unique line from each side, which has the result of combining both files */
  UNION = 3,
}

/**
 * Merge analysis result
 */
export interface MergeAnalysisResult {
  /** Analysis flags */
  analysis: GitMergeAnalysis;
  /** Preference flags */
  preference: GitMergePreference;
  /** Whether a fast-forward merge is possible */
  canFastForward: boolean;
  /** Whether the repository is already up-to-date */
  isUpToDate: boolean;
  /** Whether a normal merge is required */
  requiresNormalMerge: boolean;
  /** Whether HEAD is unborn */
  isUnborn: boolean;
}

/**
 * Merge options
 */
export interface MergeOptions {
  /** Merge flags */
  flags?: GitMergeFlag;
  /** Rename threshold (0-100) */
  renameThreshold?: number;
  /** Target limit for rename detection */
  targetLimit?: number;
  /** File favor for conflicts */
  fileFavor?: GitMergeFileFavor;
}

/**
 * Annotated commit info
 */
export interface AnnotatedCommitInfo {
  /** Commit OID as hex string */
  id: string;
  /** Reference name (if created from ref) */
  ref?: string;
}

/**
 * Conflict entry in index
 */
export interface ConflictEntry {
  /** Path of the conflicted file */
  path: string;
  /** Ancestor (common base) entry OID */
  ancestorOid?: string;
  /** "Ours" entry OID */
  oursOid?: string;
  /** "Theirs" entry OID */
  theirsOid?: string;
}

/**
 * Blame flags
 */
export enum GitBlameFlags {
  /** Normal blame, the default */
  NORMAL = 0,
  /** Track lines that have moved within a file */
  TRACK_COPIES_SAME_FILE = 1 << 0,
  /** Track lines that have moved across files in the same commit */
  TRACK_COPIES_SAME_COMMIT_MOVES = 1 << 1,
  /** Track lines that have been copied from another file in the same commit */
  TRACK_COPIES_SAME_COMMIT_COPIES = 1 << 2,
  /** Track lines that have been copied from another file in any commit */
  TRACK_COPIES_ANY_COMMIT_COPIES = 1 << 3,
  /** Restrict the search of commits to those reachable following only first parents */
  FIRST_PARENT = 1 << 4,
  /** Use mailmap file to map author and committer names and email addresses */
  USE_MAILMAP = 1 << 5,
  /** Ignore whitespace differences */
  IGNORE_WHITESPACE = 1 << 6,
}

/**
 * Blame options
 */
export interface BlameOptions {
  /** Blame flags */
  flags?: GitBlameFlags;
  /** The minimum line number to blame (1-based, inclusive) */
  minLine?: number;
  /** The maximum line number to blame (1-based, inclusive) */
  maxLine?: number;
  /** The oldest commit to consider (OID as hex string) */
  oldestCommit?: string;
  /** The newest commit to consider (OID as hex string) */
  newestCommit?: string;
}

/**
 * Blame hunk information
 */
export interface BlameHunk {
  /** Number of lines in this hunk */
  linesInHunk: number;
  /** OID of the commit where this line was last changed */
  finalCommitId: string;
  /** 1-based line number where this hunk begins in the final version */
  finalStartLineNumber: number;
  /** Author signature of the final commit */
  finalSignature?: GitSignature;
  /** Committer signature of the final commit */
  finalCommitter?: GitSignature;
  /** OID of the commit where this hunk was found */
  origCommitId: string;
  /** Path to the file in the original commit */
  origPath?: string;
  /** 1-based line number where this hunk begins in the original file */
  origStartLineNumber: number;
  /** Author signature of the original commit */
  origSignature?: GitSignature;
  /** Committer signature of the original commit */
  origCommitter?: GitSignature;
  /** Commit summary/message */
  summary?: string;
  /** Whether this is a boundary commit */
  isBoundary: boolean;
}
