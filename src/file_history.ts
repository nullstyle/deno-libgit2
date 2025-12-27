/**
 * @module file_history
 * Functions for tracking file history and finding deleted files
 */

import { Repository } from "./repository.ts";
import { Tree, treeHasPath } from "./tree.ts";
import { getFileContent, getFileRawContent } from "./blob.ts";
import type { CommitInfo } from "./types.ts";

/**
 * Information about a file at a specific commit
 */
export interface FileCommitInfo {
  /** Commit OID */
  commitOid: string;
  /** Commit message (first line) */
  message: string;
  /** Author name */
  author: string;
  /** Author email */
  email: string;
  /** Commit date */
  date: Date;
}

/**
 * Result of finding when a file was deleted
 */
export interface FileDeletionInfo {
  /** The commit where the file was deleted */
  deletedInCommit: FileCommitInfo;
  /** The last commit where the file existed */
  lastExistedInCommit: FileCommitInfo;
  /** Content of the file at the time of deletion */
  lastContent: string | null;
  /** Raw content of the file at the time of deletion */
  lastRawContent: Uint8Array | null;
}

/**
 * Result of file history search
 */
export interface FileHistoryResult {
  /** All commits where the file existed */
  commits: FileCommitInfo[];
  /** Content of the file at the most recent commit where it existed */
  lastContent: string | null;
  /** The most recent commit where the file existed */
  lastCommitWithFile: string | null;
  /** Whether the file currently exists (in HEAD) */
  currentlyExists: boolean;
}

/**
 * Convert a CommitInfo to FileCommitInfo
 */
function toFileCommitInfo(commit: CommitInfo): FileCommitInfo {
  return {
    commitOid: commit.oid,
    message: commit.message.split("\n")[0],
    author: commit.author.name,
    email: commit.author.email,
    date: new Date(Number(commit.author.when.time) * 1000),
  };
}

/**
 * Find all commits where a file existed
 * @param repo - The repository
 * @param filePath - Path to the file
 * @param options - Search options
 */
export function findFileHistory(
  repo: Repository,
  filePath: string,
  options: {
    /** Maximum number of commits to search */
    maxCommits?: number;
    /** Starting commit OID (defaults to HEAD) */
    startOid?: string;
    /** Whether to include file content from the most recent commit */
    includeContent?: boolean;
  } = {}
): FileHistoryResult {
  const { maxCommits, startOid, includeContent = true } = options;

  const commits: FileCommitInfo[] = [];
  let lastContent: string | null = null;
  let lastCommitWithFile: string | null = null;
  let currentlyExists = false;
  let isFirstCommit = true;

  for (const commit of repo.walkCommits(startOid, maxCommits)) {
    const exists = treeHasPath(repo, commit.treeOid, filePath);

    if (exists) {
      commits.push(toFileCommitInfo(commit));

      // Track the most recent commit where the file existed
      if (lastCommitWithFile === null) {
        lastCommitWithFile = commit.oid;

        // Get content if requested
        if (includeContent) {
          lastContent = getFileContent(repo, commit.treeOid, filePath);
        }
      }

      // Check if file exists in HEAD (first commit we see)
      if (isFirstCommit) {
        currentlyExists = true;
      }
    }

    isFirstCommit = false;
  }

  return {
    commits,
    lastContent,
    lastCommitWithFile,
    currentlyExists,
  };
}

/**
 * Find the commit where a file was deleted
 * @param repo - The repository
 * @param filePath - Path to the deleted file
 * @param options - Search options
 */
export function findFileDeletion(
  repo: Repository,
  filePath: string,
  options: {
    /** Maximum number of commits to search */
    maxCommits?: number;
    /** Starting commit OID (defaults to HEAD) */
    startOid?: string;
    /** Whether to include file content */
    includeContent?: boolean;
  } = {}
): FileDeletionInfo | null {
  const { maxCommits, startOid, includeContent = true } = options;

  let previousCommit: CommitInfo | null = null;
  let fileExistedInPrevious = false;

  for (const commit of repo.walkCommits(startOid, maxCommits)) {
    const existsInCurrent = treeHasPath(repo, commit.treeOid, filePath);

    // If file exists in current commit but not in the previous (more recent) one,
    // we found the deletion point
    if (existsInCurrent && previousCommit !== null && !fileExistedInPrevious) {
      let lastContent: string | null = null;
      let lastRawContent: Uint8Array | null = null;

      if (includeContent) {
        lastContent = getFileContent(repo, commit.treeOid, filePath);
        lastRawContent = getFileRawContent(repo, commit.treeOid, filePath);
      }

      return {
        deletedInCommit: toFileCommitInfo(previousCommit),
        lastExistedInCommit: toFileCommitInfo(commit),
        lastContent,
        lastRawContent,
      };
    }

    fileExistedInPrevious = existsInCurrent;
    previousCommit = commit;
  }

  return null;
}

/**
 * Get all commits that modified a specific file
 * This checks if the file's blob OID changed between commits
 * @param repo - The repository
 * @param filePath - Path to the file
 * @param options - Search options
 */
export function findFileModifications(
  repo: Repository,
  filePath: string,
  options: {
    /** Maximum number of commits to search */
    maxCommits?: number;
    /** Starting commit OID (defaults to HEAD) */
    startOid?: string;
  } = {}
): FileCommitInfo[] {
  const { maxCommits, startOid } = options;

  const modifications: FileCommitInfo[] = [];
  let previousBlobOid: string | null = null;

  for (const commit of repo.walkCommits(startOid, maxCommits)) {
    const entry = Tree.use(repo, commit.treeOid, (tree) => {
      const e = tree.getByPath(filePath);
      if (e === null) return null;
      const info = e.toInfo();
      e.free();
      return info;
    });

    if (entry !== null) {
      // File exists in this commit
      if (previousBlobOid === null || entry.oid !== previousBlobOid) {
        // First time seeing the file, or blob changed
        modifications.push(toFileCommitInfo(commit));
      }
      previousBlobOid = entry.oid;
    } else {
      // File doesn't exist in this commit
      previousBlobOid = null;
    }
  }

  return modifications;
}

/**
 * Get the content of a file at different points in history
 * @param repo - The repository
 * @param filePath - Path to the file
 * @param commitOids - List of commit OIDs to check
 */
export function getFileAtCommits(
  repo: Repository,
  filePath: string,
  commitOids: string[]
): Map<string, string | null> {
  const results = new Map<string, string | null>();

  for (const oid of commitOids) {
    try {
      const commit = repo.lookupCommit(oid);
      const content = getFileContent(repo, commit.treeOid, filePath);
      results.set(oid, content);
    } catch {
      results.set(oid, null);
    }
  }

  return results;
}

/**
 * Find when a file was first added to the repository
 * @param repo - The repository
 * @param filePath - Path to the file
 * @param options - Search options
 */
export function findFileCreation(
  repo: Repository,
  filePath: string,
  options: {
    /** Maximum number of commits to search */
    maxCommits?: number;
    /** Starting commit OID (defaults to HEAD) */
    startOid?: string;
  } = {}
): FileCommitInfo | null {
  const { maxCommits, startOid } = options;

  let lastCommitWithFile: CommitInfo | null = null;

  for (const commit of repo.walkCommits(startOid, maxCommits)) {
    const exists = treeHasPath(repo, commit.treeOid, filePath);

    if (exists) {
      lastCommitWithFile = commit;
    } else if (lastCommitWithFile !== null) {
      // File doesn't exist in this commit but existed in the next (more recent) one
      // So the next commit is where it was created
      return toFileCommitInfo(lastCommitWithFile);
    }
  }

  // If we got here and lastCommitWithFile is set, the file was in the first commit
  if (lastCommitWithFile !== null) {
    return toFileCommitInfo(lastCommitWithFile);
  }

  return null;
}

/**
 * Check if a file exists at HEAD
 * @param repo - The repository
 * @param filePath - Path to the file
 */
export function fileExistsAtHead(repo: Repository, filePath: string): boolean {
  try {
    const headOid = repo.headOid();
    const commit = repo.lookupCommit(headOid);
    return treeHasPath(repo, commit.treeOid, filePath);
  } catch {
    return false;
  }
}

/**
 * Get the current content of a file (at HEAD)
 * @param repo - The repository
 * @param filePath - Path to the file
 */
export function getFileAtHead(repo: Repository, filePath: string): string | null {
  try {
    const headOid = repo.headOid();
    const commit = repo.lookupCommit(headOid);
    return getFileContent(repo, commit.treeOid, filePath);
  } catch {
    return null;
  }
}
