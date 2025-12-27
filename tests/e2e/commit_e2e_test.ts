/**
 * End-to-end tests for Commit and History operations
 *
 * These tests validate commit creation, lookup, and history traversal
 * using real git repositories in temporary directories.
 */

import {
  createCommitWithFiles,
  setupLibrary,
  teardownLibrary,
  withTestContext,
} from "./helpers.ts";
import { assertEquals, assertExists } from "@std/assert";

Deno.test({
  name: "E2E Commit Tests",
  async fn(t) {
    setupLibrary();

    await t.step("Create initial commit with files", async () => {
      await withTestContext({}, async (ctx) => {
        // Create files and commit
        const commitOid = await createCommitWithFiles(ctx, "Initial commit", {
          "README.md": "# Hello World\n",
          "src/main.ts": "console.log('Hello');\n",
        });

        assertExists(commitOid);
        assertEquals(
          commitOid.length,
          40,
          "Commit OID should be 40 characters",
        );

        // Verify repository is no longer empty
        assertEquals(ctx.repo.isEmpty, false);
      });
    });

    await t.step("Create multiple commits and walk history", async () => {
      await withTestContext({}, async (ctx) => {
        // Create first commit
        const commit1 = await createCommitWithFiles(ctx, "First commit", {
          "file1.txt": "content 1",
        });

        // Create second commit
        const commit2 = await createCommitWithFiles(ctx, "Second commit", {
          "file2.txt": "content 2",
        });

        // Create third commit
        const commit3 = await createCommitWithFiles(ctx, "Third commit", {
          "file3.txt": "content 3",
        });

        // Walk commits
        const commits = Array.from(ctx.repo.walkCommits());

        assertEquals(commits.length, 3, "Should have 3 commits");
        assertEquals(commits[0].oid, commit3, "First should be most recent");
        assertEquals(commits[1].oid, commit2, "Second should be middle commit");
        assertEquals(commits[2].oid, commit1, "Third should be oldest");
      });
    });

    await t.step("Commit messages are preserved correctly", async () => {
      await withTestContext({}, async (ctx) => {
        const message =
          "This is a detailed commit message\n\nWith a body that spans\nmultiple lines.";

        await createCommitWithFiles(ctx, message, {
          "test.txt": "test content",
        });

        const commits = Array.from(ctx.repo.walkCommits());
        assertEquals(commits.length, 1);

        // Note: libgit2 may add a trailing newline
        assertEquals(commits[0].message.trim(), message.trim());
      });
    });

    await t.step("Commit author information is preserved", async () => {
      await withTestContext({}, async (ctx) => {
        await createCommitWithFiles(
          ctx,
          "Test commit",
          { "test.txt": "content" },
          "John Doe",
          "john@example.com",
        );

        const commits = Array.from(ctx.repo.walkCommits());
        assertEquals(commits.length, 1);
        assertEquals(commits[0].author.name, "John Doe");
        assertEquals(commits[0].author.email, "john@example.com");
      });
    });

    await t.step("Commit timestamp is set correctly", async () => {
      await withTestContext({}, async (ctx) => {
        const beforeCommit = Date.now();

        await createCommitWithFiles(ctx, "Test commit", {
          "test.txt": "content",
        });

        const afterCommit = Date.now();

        const commits = Array.from(ctx.repo.walkCommits());
        assertEquals(commits.length, 1);

        const commitTime = Number(commits[0].author.when.time) * 1000; // Convert to milliseconds
        assertExists(commitTime);

        // Commit time should be between before and after (with some tolerance)
        assertEquals(
          commitTime >= beforeCommit - 1000,
          true,
          "Commit time should be after test start",
        );
        assertEquals(
          commitTime <= afterCommit + 1000,
          true,
          "Commit time should be before test end",
        );
      });
    });

    await t.step("Commit tree OID is valid", async () => {
      await withTestContext({}, async (ctx) => {
        await createCommitWithFiles(ctx, "Test commit", {
          "test.txt": "content",
        });

        const commits = Array.from(ctx.repo.walkCommits());
        assertEquals(commits.length, 1);

        const treeOid = commits[0].treeOid;
        assertExists(treeOid);
        assertEquals(treeOid.length, 40, "Tree OID should be 40 characters");
      });
    });

    await t.step("Lookup commit by OID", async () => {
      await withTestContext({}, async (ctx) => {
        const commitOid = await createCommitWithFiles(ctx, "Lookup test", {
          "test.txt": "content",
        });

        const commit = ctx.repo.lookupCommit(commitOid);
        assertExists(commit);
        assertEquals(commit.oid, commitOid);
        assertEquals(commit.message.includes("Lookup test"), true);
      });
    });

    await t.step("Walk commits with limit", async () => {
      await withTestContext({}, async (ctx) => {
        // Create 5 commits
        for (let i = 1; i <= 5; i++) {
          await createCommitWithFiles(ctx, `Commit ${i}`, {
            [`file${i}.txt`]: `content ${i}`,
          });
        }

        // Walk with limit of 3
        const commits = Array.from(ctx.repo.walkCommits(undefined, 3));
        assertEquals(commits.length, 3, "Should only return 3 commits");
        assertEquals(
          commits[0].message.includes("Commit 5"),
          true,
          "First should be most recent",
        );
      });
    });

    await t.step("Walk commits from specific starting point", async () => {
      await withTestContext({}, async (ctx) => {
        const commit1 = await createCommitWithFiles(ctx, "Commit 1", {
          "file1.txt": "content 1",
        });

        const commit2 = await createCommitWithFiles(ctx, "Commit 2", {
          "file2.txt": "content 2",
        });

        const _commit3 = await createCommitWithFiles(ctx, "Commit 3", {
          "file3.txt": "content 3",
        });

        // Walk from commit2 (should include commit2 and commit1)
        const commits = Array.from(ctx.repo.walkCommits(commit2));
        assertEquals(commits.length, 2, "Should have 2 commits from commit2");
        assertEquals(commits[0].oid, commit2);
        assertEquals(commits[1].oid, commit1);
      });
    });

    await t.step(
      "Modifying file creates new commit with correct parent",
      async () => {
        await withTestContext({}, async (ctx) => {
          // Create initial commit
          const commit1 = await createCommitWithFiles(ctx, "Initial", {
            "file.txt": "version 1",
          });

          // Modify file and create new commit
          const commit2 = await createCommitWithFiles(ctx, "Modified", {
            "file.txt": "version 2",
          });

          // Verify parent relationship
          const commits = Array.from(ctx.repo.walkCommits());
          assertEquals(commits.length, 2);
          assertEquals(commits[0].oid, commit2);
          assertEquals(commits[1].oid, commit1);

          // The second commit should have the first as parent
          assertEquals(commits[0].parents.length, 1);
          assertEquals(commits[0].parents[0], commit1);
        });
      },
    );

    await t.step("Empty repository has no commits to walk", async () => {
      await withTestContext({}, (ctx) => {
        // Empty repository has no HEAD, so walkCommits should throw or return empty
        // We catch the error since there's no HEAD to walk from
        try {
          const commits = Array.from(ctx.repo.walkCommits());
          assertEquals(
            commits.length,
            0,
            "Empty repository should have no commits",
          );
        } catch (e) {
          // Expected - no HEAD reference exists in empty repo
          assertEquals((e as Error).message.includes("not found"), true);
        }
      });
    });

    teardownLibrary();
  },
});
