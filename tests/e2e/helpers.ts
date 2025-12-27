/**
 * End-to-end test helpers for deno-libgit2
 *
 * Provides utilities for creating temporary directories, managing test fixtures,
 * and performing real file operations for integration testing.
 */

import { createCommit, type GitLibrary, Index, initGit, Repository } from "../../mod.ts";

/** Options for creating a test context */
export interface TestContextOptions {
  /** Whether to create a bare repository (default: false) */
  bare?: boolean;
  /** Whether to create an initial commit (default: false) */
  withInitialCommit?: boolean;
}

/** Test context containing a temporary directory and initialized repository */
export class TestContext {
  /** Path to the temporary directory */
  readonly tempDir: string;
  /** Path to the repository within the temp directory */
  readonly repoPath: string;
  /** The opened repository instance (can be reassigned for tests that reopen repos) */
  repo: Repository;

  constructor(tempDir: string, repoPath: string, repo: Repository) {
    this.tempDir = tempDir;
    this.repoPath = repoPath;
    this.repo = repo;
  }

  /**
   * Clean up the test context (close repo and remove temp directory)
   */
  async cleanup(): Promise<void> {
    try {
      this.repo.close();
    } catch {
      // Ignore errors during cleanup
    }
    await removeTempDir(this.tempDir);
  }

  /**
   * Support for `await using` syntax
   */
  async [Symbol.asyncDispose](): Promise<void> {
    await this.cleanup();
  }
}

/**
 * Creates a unique temporary directory for a test
 */
export async function createTempDir(prefix = "libgit2_e2e_"): Promise<string> {
  const tempBase = await Deno.makeTempDir({ prefix });
  return tempBase;
}

/**
 * Removes a temporary directory and all its contents
 */
export async function removeTempDir(path: string): Promise<void> {
  try {
    await Deno.remove(path, { recursive: true });
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      console.warn(`Warning: Failed to remove temp dir ${path}:`, error);
    }
  }
}

/**
 * Creates a file with the given content in the specified directory
 */
export async function createFile(
  dir: string,
  relativePath: string,
  content: string,
): Promise<string> {
  const fullPath = `${dir}/${relativePath}`;
  const parentDir = fullPath.substring(0, fullPath.lastIndexOf("/"));

  // Ensure parent directory exists
  await Deno.mkdir(parentDir, { recursive: true });
  await Deno.writeTextFile(fullPath, content);

  return fullPath;
}

/**
 * Reads a file's content
 */
export async function readFile(path: string): Promise<string> {
  return await Deno.readTextFile(path);
}

/**
 * Checks if a file exists
 */
export async function fileExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Deletes a file
 */
export async function deleteFile(path: string): Promise<void> {
  await Deno.remove(path);
}

/**
 * Creates a test context with a temporary directory and initialized repository.
 * Supports `await using` for automatic cleanup.
 *
 * @example
 * ```ts
 * await using ctx = await createTestContext({ withInitialCommit: true });
 * // Use ctx.repo, ctx.repoPath, etc.
 * // Automatically cleaned up when scope exits
 * ```
 */
export async function createTestContext(
  options: TestContextOptions = {},
): Promise<TestContext> {
  const { bare = false, withInitialCommit = false } = options;

  const tempDir = await createTempDir();
  const repoPath = `${tempDir}/repo`;

  // Initialize the repository
  const repo = Repository.init(repoPath, bare);

  if (withInitialCommit && !bare) {
    // Create an initial commit with a README
    await createFile(
      repoPath,
      "README.md",
      "# Test Repository\n\nThis is a test repository.\n",
    );

    using index = Index.fromRepository(repo);
    index.add("README.md");
    index.write();
    const treeOid = index.writeTree();

    createCommit(repo, {
      message: "Initial commit",
      author: { name: "Test Author", email: "test@example.com" },
      treeOid,
      parents: [],
    });
  }

  return new TestContext(tempDir, repoPath, repo);
}

/**
 * Cleans up a test context by closing the repository and removing the temp directory
 * @deprecated Use `await using ctx = await createTestContext()` instead
 */
export async function cleanupTestContext(ctx: TestContext): Promise<void> {
  await ctx.cleanup();
}

/**
 * Runs a test with automatic setup and cleanup
 * @deprecated Use `await using ctx = await createTestContext()` instead
 */
export async function withTestContext(
  options: TestContextOptions,
  fn: (ctx: TestContext) => Promise<void> | void,
): Promise<void> {
  await using ctx = await createTestContext(options);
  await fn(ctx);
}

/**
 * Creates a commit with the given files
 */
export async function createCommitWithFiles(
  ctx: TestContext,
  message: string,
  files: Record<string, string>,
  author = "Test Author",
  email = "test@example.com",
): Promise<string> {
  // Write files to disk
  for (const [path, content] of Object.entries(files)) {
    await createFile(ctx.repoPath, path, content);
  }

  // Stage files
  using index = Index.fromRepository(ctx.repo);
  for (const path of Object.keys(files)) {
    index.add(path);
  }
  index.write();
  const treeOid = index.writeTree();

  // Get parent commits
  const parents: string[] = [];
  try {
    const headOid = ctx.repo.headOid();
    if (headOid) {
      parents.push(headOid);
    }
  } catch {
    // No HEAD yet, this is the first commit
  }

  // Create commit
  const commitOid = createCommit(ctx.repo, {
    message,
    author: { name: author, email },
    treeOid,
    parents,
  });

  return commitOid;
}

/**
 * Deletes files and creates a commit
 */
export async function createCommitWithDeletions(
  ctx: TestContext,
  message: string,
  filesToDelete: string[],
  author = "Test Author",
  email = "test@example.com",
): Promise<string> {
  // Delete files from disk
  for (const path of filesToDelete) {
    await deleteFile(`${ctx.repoPath}/${path}`);
  }

  // Remove from index
  using index = Index.fromRepository(ctx.repo);
  for (const path of filesToDelete) {
    index.remove(path);
  }
  index.write();
  const treeOid = index.writeTree();

  // Get parent commits
  const parents: string[] = [];
  try {
    const headOid = ctx.repo.headOid();
    if (headOid) {
      parents.push(headOid);
    }
  } catch {
    // No HEAD yet
  }

  // Create commit
  const commitOid = createCommit(ctx.repo, {
    message,
    author: { name: author, email },
    treeOid,
    parents,
  });

  return commitOid;
}

/**
 * Sets up the libgit2 library for tests.
 * Returns a GitLibrary handle that should be used with `using` for automatic cleanup.
 * Note: Tests should be run with DENO_LIBGIT2_USE_SYSTEM=1 to use system-installed libgit2
 *
 * @example
 * ```ts
 * using git = await setupLibrary();
 * // Library is automatically shut down when scope exits
 * ```
 */
export async function setupLibrary(): Promise<GitLibrary> {
  return await initGit();
}
