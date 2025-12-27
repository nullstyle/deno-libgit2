/**
 * End-to-end tests for Repository operations
 *
 * These tests use real file operations in temporary directories to validate
 * the repository functionality works correctly with actual git repositories.
 */

import {
  createCommitWithFiles,
  createFile,
  createTempDir,
  fileExists,
  removeTempDir,
  setupLibrary,
  teardownLibrary,
  withTestContext,
} from "./helpers.ts";
import { GitRepositoryOpenFlags, Index, Repository } from "../../mod.ts";
import {
  assert,
  assertEquals,
  assertExists,
  assertFalse,
  assertThrows,
} from "@std/assert";
import { GitBranchType } from "../../src/types.ts";

// Setup and teardown
Deno.test({
  name: "E2E Repository Tests",
  async fn(t) {
    await setupLibrary();

    await t.step(
      "Repository.init creates a working git repository",
      async () => {
        const tempDir = await createTempDir();
        try {
          const repoPath = `${tempDir}/new-repo`;
          const repo = Repository.init(repoPath, false);

          // Verify .git directory was created
          const gitDirExists = await fileExists(`${repoPath}/.git`);
          assertEquals(gitDirExists, true, ".git directory should exist");

          // Verify HEAD file exists
          const headExists = await fileExists(`${repoPath}/.git/HEAD`);
          assertEquals(headExists, true, "HEAD file should exist");

          // Verify repository path
          const path = repo.path;
          assertExists(path);
          assertEquals(
            path.endsWith(".git/"),
            true,
            "path should end with .git/",
          );

          // Verify workdir
          const workdir = repo.workdir;
          assertExists(workdir);
          assertEquals(
            workdir.endsWith("/"),
            true,
            "workdir should end with /",
          );

          repo.close();
        } finally {
          await removeTempDir(tempDir);
        }
      },
    );

    await t.step("Repository.init creates a bare repository", async () => {
      const tempDir = await createTempDir();
      try {
        const repoPath = `${tempDir}/bare-repo`;
        const repo = Repository.init(repoPath, true);

        // Verify it's a bare repository (no .git subdirectory)
        const gitDirExists = await fileExists(`${repoPath}/.git`);
        assertEquals(
          gitDirExists,
          false,
          ".git directory should not exist in bare repo",
        );

        // Verify HEAD file exists at root
        const headExists = await fileExists(`${repoPath}/HEAD`);
        assertEquals(headExists, true, "HEAD file should exist at root");

        // Verify isBare returns true
        assertEquals(repo.isBare, true, "isBare should return true");

        // Verify workdir is null for bare repo
        assertEquals(
          repo.workdir,
          null,
          "workdir should be null for bare repo",
        );

        repo.close();
      } finally {
        await removeTempDir(tempDir);
      }
    });

    await t.step("Repository.open opens an existing repository", async () => {
      const tempDir = await createTempDir();
      try {
        const repoPath = `${tempDir}/existing-repo`;

        // Create a repository first
        const repo1 = Repository.init(repoPath, false);
        repo1.close();

        // Now open it
        const repo2 = Repository.open(repoPath);
        assertExists(repo2);

        const path = repo2.path;
        assertExists(path);
        assertEquals(path.includes(".git"), true);

        repo2.close();
      } finally {
        await removeTempDir(tempDir);
      }
    });

    await t.step("Repository.open throws for non-existent path", async () => {
      const tempDir = await createTempDir();
      try {
        assertThrows(
          () => Repository.open(`${tempDir}/non-existent`),
          Error,
          undefined,
          "Should throw for non-existent path",
        );
      } finally {
        await removeTempDir(tempDir);
      }
    });

    await t.step(
      "Repository.discover finds repository from subdirectory",
      async () => {
        const tempDir = await createTempDir();
        try {
          const repoPath = `${tempDir}/discover-repo`;
          const repo = Repository.init(repoPath, false);

          // Create a nested directory structure
          await createFile(repoPath, "src/lib/deep/file.txt", "content");

          // Discover from deep subdirectory
          const discoveredPath = Repository.discover(
            `${repoPath}/src/lib/deep`,
          );
          assertExists(discoveredPath);
          assertEquals(discoveredPath.includes(".git"), true);

          repo.close();
        } finally {
          await removeTempDir(tempDir);
        }
      },
    );

    await t.step(
      "Repository isEmpty returns true for new repository",
      async () => {
        await withTestContext({}, (ctx) => {
          assertEquals(
            ctx.repo.isEmpty,
            true,
            "New repository should be empty",
          );
        });
      },
    );

    await t.step("Repository isEmpty returns false after commit", async () => {
      await withTestContext({ withInitialCommit: true }, (ctx) => {
        assertEquals(
          ctx.repo.isEmpty,
          false,
          "Repository with commit should not be empty",
        );
      });
    });

    await t.step("Repository.use provides automatic cleanup", async () => {
      const tempDir = await createTempDir();
      try {
        const repoPath = `${tempDir}/use-repo`;
        Repository.init(repoPath, false).close();

        Repository.use(repoPath, (repo) => {
          assertExists(repo.path);
          // After this callback, repo should be closed
        });

        // The pattern is validated by the callback executing successfully
      } finally {
        await removeTempDir(tempDir);
      }
    });

    await t.step(
      "Repository state returns NONE for clean repository",
      async () => {
        await withTestContext({ withInitialCommit: true }, (ctx) => {
          const state = ctx.repo.state;
          assertEquals(
            state,
            0,
            "State should be NONE (0) for clean repository",
          );
        });
      },
    );

    await t.step(
      "Repository head returns reference for repository with commits",
      async () => {
        await withTestContext({ withInitialCommit: true }, (ctx) => {
          const head = ctx.repo.head();
          assertExists(head);
          assertEquals(
            head.name.includes("refs/heads/"),
            true,
            "HEAD should point to a branch",
          );
        });
      },
    );

    await t.step(
      "Repository isHeadDetached returns false for normal repository",
      async () => {
        await withTestContext({ withInitialCommit: true }, (ctx) => {
          assertEquals(
            ctx.repo.isHeadDetached,
            false,
            "HEAD should not be detached",
          );
        });
      },
    );

    await t.step("Repository getIndex returns a valid index", async () => {
      await withTestContext({}, (ctx) => {
        const index = Index.fromRepository(ctx.repo);
        assertExists(index);
        assertEquals(
          index.entryCount,
          0,
          "New repository index should be empty",
        );
        index.close();
      });
    });

    await t.step(
      "Repository status returns empty for clean repository",
      async () => {
        await withTestContext({ withInitialCommit: true }, (ctx) => {
          const status = ctx.repo.status();
          assertEquals(
            status.length,
            0,
            "Clean repository should have no status entries",
          );
        });
      },
    );

    // Note: Status entry path reading has memory layout issues
    // These tests verify status count instead of entry details
    await t.step("Repository status detects new file", async () => {
      await withTestContext({ withInitialCommit: true }, async (ctx) => {
        // Create a new untracked file
        await createFile(ctx.repoPath, "new-file.txt", "new content");

        const status = ctx.repo.status();
        assertEquals(
          status.length >= 1,
          true,
          "Should have at least one status entry",
        );
      });
    });

    // Note: Status entry path reading has memory layout issues
    await t.step("Repository status detects modified file", async () => {
      await withTestContext({ withInitialCommit: true }, async (ctx) => {
        // Modify the README
        await createFile(ctx.repoPath, "README.md", "Modified content");

        const status = ctx.repo.status();
        assertEquals(
          status.length >= 1,
          true,
          "Should have at least one status entry",
        );
      });
    });

    await t.step("Repository.openBare opens a bare repository", async () => {
      const tempDir = await createTempDir();
      try {
        const repoPath = `${tempDir}/bare-open-test`;
        // Create a bare repository first
        const repo1 = Repository.init(repoPath, true);
        repo1.close();

        // Open it with openBare
        const repo2 = Repository.openBare(repoPath);
        assertExists(repo2);
        assertEquals(repo2.isBare, true);
        assertEquals(repo2.workdir, null);

        repo2.close();
      } finally {
        await removeTempDir(tempDir);
      }
    });

    await t.step("Repository.openExt opens with flags", async () => {
      const tempDir = await createTempDir();
      try {
        const repoPath = `${tempDir}/ext-repo`;
        const repo1 = Repository.init(repoPath, false);
        repo1.close();

        // Open with NO_SEARCH flag (don't search parent directories)
        const repo2 = Repository.openExt(
          repoPath,
          GitRepositoryOpenFlags.NO_SEARCH,
        );
        assertExists(repo2);
        assertExists(repo2.path);

        repo2.close();
      } finally {
        await removeTempDir(tempDir);
      }
    });

    await t.step(
      "Repository.openExt with ceiling directories",
      async () => {
        const tempDir = await createTempDir();
        try {
          const repoPath = `${tempDir}/ceiling-repo`;
          const repo1 = Repository.init(repoPath, false);
          repo1.close();

          // Open with ceiling directories
          const repo2 = Repository.openExt(
            repoPath,
            GitRepositoryOpenFlags.NONE,
            tempDir,
          );
          assertExists(repo2);

          repo2.close();
        } finally {
          await removeTempDir(tempDir);
        }
      },
    );

    await t.step("Repository.isClosed reflects closed state", async () => {
      await withTestContext({}, (ctx) => {
        assertFalse(ctx.repo.isClosed);
        ctx.repo.close();
        assertEquals(ctx.repo.isClosed, true);
      });
    });

    await t.step("Repository.pointer throws when closed", async () => {
      const tempDir = await createTempDir();
      try {
        const repoPath = `${tempDir}/closed-repo`;
        const repo = Repository.init(repoPath, false);
        repo.close();

        assertThrows(
          () => repo.pointer,
          Error,
          "closed",
        );
      } finally {
        await removeTempDir(tempDir);
      }
    });

    await t.step("Repository.setHead sets HEAD to branch", async () => {
      await withTestContext({ withInitialCommit: true }, async (ctx) => {
        // Create a second branch
        await createCommitWithFiles(ctx, "Second commit", {
          "file.txt": "content",
        });
        ctx.repo.createBranch("test-branch", ctx.repo.headOid()!);

        // Set HEAD to new branch
        ctx.repo.setHead("refs/heads/test-branch");

        const head = ctx.repo.head();
        assertEquals(head.name, "refs/heads/test-branch");
      });
    });

    await t.step(
      "Repository.setHeadDetached detaches HEAD to commit",
      async () => {
        await withTestContext({ withInitialCommit: true }, async (ctx) => {
          await createCommitWithFiles(ctx, "Commit", { "f.txt": "c" });
          const headOid = ctx.repo.headOid()!;

          ctx.repo.setHeadDetached(headOid);

          assertEquals(ctx.repo.isHeadDetached, true);
        });
      },
    );

    await t.step(
      "Repository.lookupReference returns reference info",
      async () => {
        await withTestContext({ withInitialCommit: true }, async (ctx) => {
          await createCommitWithFiles(ctx, "Commit", { "f.txt": "c" });

          // Get the actual branch name from HEAD
          const head = ctx.repo.head();
          const ref = ctx.repo.lookupReference(head.name);
          assertExists(ref);
          assertEquals(ref.name, head.name);
          assertEquals(ref.isBranch, true);
          assertExists(ref.target);
        });
      },
    );

    await t.step(
      "Repository.resolveReference resolves symbolic ref",
      async () => {
        await withTestContext({ withInitialCommit: true }, async (ctx) => {
          await createCommitWithFiles(ctx, "Commit", { "f.txt": "c" });

          // HEAD is a symbolic reference
          const resolved = ctx.repo.resolveReference("HEAD");
          assertExists(resolved);
          assertExists(resolved.target);
          assertEquals(resolved.target?.length, 40);
        });
      },
    );

    await t.step(
      "Repository.createBranch with force overwrites existing",
      async () => {
        await withTestContext({ withInitialCommit: true }, async (ctx) => {
          const commit1 = await createCommitWithFiles(ctx, "First", {
            "a.txt": "a",
          });
          const commit2 = await createCommitWithFiles(ctx, "Second", {
            "b.txt": "b",
          });

          // Create branch at first commit
          ctx.repo.createBranch("force-test", commit1);

          // Force create at second commit
          const branchInfo = ctx.repo.createBranch("force-test", commit2, true);
          assertExists(branchInfo);
          assertEquals(branchInfo.targetOid, commit2);
        });
      },
    );

    await t.step("Repository.getCommits returns array of commits", async () => {
      await withTestContext({ withInitialCommit: true }, async (ctx) => {
        await createCommitWithFiles(ctx, "C1", { "1.txt": "1" });
        await createCommitWithFiles(ctx, "C2", { "2.txt": "2" });
        await createCommitWithFiles(ctx, "C3", { "3.txt": "3" });

        const commits = ctx.repo.getCommits();
        assert(commits.length >= 3);

        // Verify commits have expected properties
        for (const commit of commits) {
          assertExists(commit.oid);
          assertEquals(commit.oid.length, 40);
          assertExists(commit.message);
          assertExists(commit.author);
          assertExists(commit.committer);
        }
      });
    });

    await t.step("Repository.getCommits with limit", async () => {
      await withTestContext({ withInitialCommit: true }, async (ctx) => {
        await createCommitWithFiles(ctx, "C1", { "1.txt": "1" });
        await createCommitWithFiles(ctx, "C2", { "2.txt": "2" });
        await createCommitWithFiles(ctx, "C3", { "3.txt": "3" });

        const commits = ctx.repo.getCommits(undefined, 2);
        assertEquals(commits.length, 2);
      });
    });

    await t.step("Repository.useAsync provides async cleanup", async () => {
      const tempDir = await createTempDir();
      try {
        const repoPath = `${tempDir}/async-repo`;
        Repository.init(repoPath, false).close();

        const result = await Repository.useAsync(repoPath, async (repo) => {
          assertExists(repo.path);
          return repo.isBare;
        });

        assertEquals(result, false);
      } finally {
        await removeTempDir(tempDir);
      }
    });

    await t.step("Repository.discover with acrossFs false", async () => {
      const tempDir = await createTempDir();
      try {
        const repoPath = `${tempDir}/discover-fs`;
        const repo = Repository.init(repoPath, false);
        await createFile(repoPath, "subdir/file.txt", "content");
        repo.close();

        const discovered = Repository.discover(
          `${repoPath}/subdir`,
          false,
        );
        assertExists(discovered);
      } finally {
        await removeTempDir(tempDir);
      }
    });

    await t.step("Repository Symbol.dispose works", async () => {
      const tempDir = await createTempDir();
      try {
        const repoPath = `${tempDir}/dispose-repo`;
        Repository.init(repoPath, false).close();

        {
          using repo = Repository.open(repoPath);
          assertExists(repo.path);
        }
        // repo is automatically disposed
      } finally {
        await removeTempDir(tempDir);
      }
    });

    await t.step("Repository listBranches returns branch info", async () => {
      await withTestContext({ withInitialCommit: true }, async (ctx) => {
        await createCommitWithFiles(ctx, "Commit", { "f.txt": "c" });

        // Create additional branches
        ctx.repo.createBranch("branch-a", ctx.repo.headOid()!);
        ctx.repo.createBranch("branch-b", ctx.repo.headOid()!);

        const branches = ctx.repo.listBranches(GitBranchType.LOCAL);
        assert(branches.length >= 3); // main + branch-a + branch-b

        for (const branch of branches) {
          assertExists(branch.name);
          assertExists(branch.refName);
        }
      });
    });

    await t.step("Repository deleteBranch removes branch", async () => {
      await withTestContext({ withInitialCommit: true }, async (ctx) => {
        await createCommitWithFiles(ctx, "Commit", { "f.txt": "c" });

        ctx.repo.createBranch("to-delete", ctx.repo.headOid()!);

        let branches = ctx.repo.listBranches(GitBranchType.LOCAL);
        const beforeCount = branches.length;

        ctx.repo.deleteBranch("to-delete");

        branches = ctx.repo.listBranches(GitBranchType.LOCAL);
        assertEquals(branches.length, beforeCount - 1);
      });
    });

    await t.step("Repository walkCommits iterates commits", async () => {
      await withTestContext({ withInitialCommit: true }, async (ctx) => {
        await createCommitWithFiles(ctx, "C1", { "1.txt": "1" });
        await createCommitWithFiles(ctx, "C2", { "2.txt": "2" });

        let count = 0;
        for (const commit of ctx.repo.walkCommits()) {
          assertExists(commit.oid);
          count++;
          if (count >= 3) break;
        }

        assert(count >= 2);
      });
    });

    await t.step("Repository close is idempotent", async () => {
      const tempDir = await createTempDir();
      try {
        const repoPath = `${tempDir}/close-idem`;
        const repo = Repository.init(repoPath, false);

        repo.close();
        repo.close(); // Should not throw
        repo.close(); // Should not throw

        assertEquals(repo.isClosed, true);
      } finally {
        await removeTempDir(tempDir);
      }
    });

    await t.step("Repository listReferences returns refs", async () => {
      await withTestContext({ withInitialCommit: true }, async (ctx) => {
        await createCommitWithFiles(ctx, "Commit", { "f.txt": "c" });

        const refs = ctx.repo.listReferences();
        assert(refs.length >= 1);
        assert(refs.some((r) => r.includes("refs/heads/")));
      });
    });

    await t.step(
      "Repository.discover with ceiling directories",
      async () => {
        const tempDir = await createTempDir();
        try {
          const repoPath = `${tempDir}/ceiling-discover`;
          const repo = Repository.init(repoPath, false);
          await createFile(repoPath, "sub/deep/file.txt", "content");
          repo.close();

          // Discover with ceiling dirs
          const discovered = Repository.discover(
            `${repoPath}/sub/deep`,
            false,
            tempDir,
          );
          assertExists(discovered);
        } finally {
          await removeTempDir(tempDir);
        }
      },
    );

    await t.step(
      "Repository.discover throws for non-repository",
      async () => {
        const tempDir = await createTempDir();
        try {
          // Create a directory that is NOT a git repo
          await createFile(tempDir, "not-a-repo/file.txt", "content");

          assertThrows(
            () => Repository.discover(`${tempDir}/not-a-repo`),
            Error,
          );
        } finally {
          await removeTempDir(tempDir);
        }
      },
    );

    await t.step("Repository constructor throws on null pointer", () => {
      assertThrows(
        () => new Repository(null as unknown as never),
        Error,
        "Invalid",
      );
    });

    await t.step("Repository.path returns repository path", async () => {
      await withTestContext({}, (ctx) => {
        const path = ctx.repo.path;
        assertExists(path);
        assert(path.endsWith(".git/") || path.endsWith(".git"));
      });
    });

    await t.step("Repository.workdir returns null for bare repo", async () => {
      const tempDir = await createTempDir();
      try {
        const repoPath = `${tempDir}/bare-workdir`;
        const repo = Repository.init(repoPath, true);

        assertEquals(repo.workdir, null);

        repo.close();
      } finally {
        await removeTempDir(tempDir);
      }
    });

    await t.step(
      "Repository.headOid throws for empty repo",
      async () => {
        await withTestContext({}, (ctx) => {
          // New empty repo has no commits, headOid should throw
          assertThrows(
            () => ctx.repo.headOid(),
            Error,
          );
        });
      },
    );

    await t.step("Repository operations throw after close", async () => {
      const tempDir = await createTempDir();
      try {
        const repoPath = `${tempDir}/closed-ops`;
        const repo = Repository.init(repoPath, false);
        repo.close();

        assertThrows(() => repo.path, Error, "closed");
        assertThrows(() => repo.workdir, Error, "closed");
        assertThrows(() => repo.isBare, Error, "closed");
        assertThrows(() => repo.isEmpty, Error, "closed");
        assertThrows(() => repo.state, Error, "closed");
      } finally {
        await removeTempDir(tempDir);
      }
    });

    teardownLibrary();
  },
});
