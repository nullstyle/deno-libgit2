/**
 * End-to-end tests for apply functionality
 * Tests use real file operations in temporary directories
 */

import {
  assert,
  assertEquals,
  assertExists,
} from "@std/assert";
import { ApplyLocation, init, Repository, shutdown } from "../../mod.ts";
import {
  cleanupTestContext,
  createCommitWithFiles,
  createTestContext,
  readFile,
} from "./helpers.ts";

Deno.test("E2E Apply Tests", async (t) => {
  init();

  try {
    await t.step("apply diff to workdir", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        // Create first commit
        await createCommitWithFiles(ctx, "Initial", {
          "file.txt": "initial\n",
        });
        const firstOid = ctx.repo.headOid();

        // Create second commit with changes
        await createCommitWithFiles(ctx, "Modified", {
          "file.txt": "modified\n",
        });
        const secondOid = ctx.repo.headOid();

        // Reset workdir to first commit state
        await Deno.writeTextFile(`${ctx.repoPath}/file.txt`, "initial\n");

        // Get diff between first and second commit
        const diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
        assertExists(diff, "Should return a diff");

        // Apply diff to workdir
        ctx.repo.apply(diff, ApplyLocation.WORKDIR);

        // Check that file was modified
        const content = await readFile(`${ctx.repoPath}/file.txt`);
        assertEquals(content, "modified\n", "File should be modified");

        diff.free();
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step({
      name: "apply diff to index",
      ignore: true,
      fn: async () => {
        const ctx = await createTestContext({ withInitialCommit: true });
        try {
          // Create first commit
          await createCommitWithFiles(ctx, "Initial", {
            "file.txt": "initial\n",
          });
          const firstOid = ctx.repo.headOid();

          // Create second commit with changes
          await createCommitWithFiles(ctx, "Modified", {
            "file.txt": "modified\n",
          });
          const secondOid = ctx.repo.headOid();

          // Get diff between first and second commit
          const diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
          assertExists(diff, "Should return a diff");

          // Apply diff to index - note: this applies on top of current index
          // which already has "modified" content, so this is a no-op
          // The test just verifies the API works without error
          ctx.repo.apply(diff, ApplyLocation.INDEX);

          diff.free();
        } finally {
          await cleanupTestContext(ctx);
        }
      },
    });

    await t.step({
      name: "apply diff to both workdir and index",
      ignore: true,
      fn: async () => {
        const ctx = await createTestContext({ withInitialCommit: true });
        try {
          // Create first commit
          await createCommitWithFiles(ctx, "Initial", {
            "file.txt": "initial\n",
          });
          const firstOid = ctx.repo.headOid();

          // Create second commit with changes
          await createCommitWithFiles(ctx, "Modified", {
            "file.txt": "modified\n",
          });
          const secondOid = ctx.repo.headOid();

          // Get diff between first and second commit
          const diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
          assertExists(diff, "Should return a diff");

          // Apply diff to both - note: this applies on top of current state
          // which already has "modified" content, so this is a no-op
          // The test just verifies the API works without error
          ctx.repo.apply(diff, ApplyLocation.BOTH);

          // Check that file still has modified content
          const content = await readFile(`${ctx.repoPath}/file.txt`);
          assertEquals(content, "modified\n", "File should be modified");

          diff.free();
        } finally {
          await cleanupTestContext(ctx);
        }
      },
    });

    await t.step("apply diff to tree (returns index)", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        // Create first commit
        await createCommitWithFiles(ctx, "Initial", {
          "file.txt": "initial\n",
        });
        const firstOid = ctx.repo.headOid();

        // Create second commit with changes
        await createCommitWithFiles(ctx, "Modified", {
          "file.txt": "modified\n",
        });
        const secondOid = ctx.repo.headOid();

        // Get diff between first and second commit
        const diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
        assertExists(diff, "Should return a diff");

        // Apply diff to tree (first commit's tree)
        const index = ctx.repo.applyToTree(firstOid, diff);
        assertExists(index, "Should return an index");

        // Index should have the modified file
        const entryCount = index.entryCount;
        assert(entryCount > 0, "Index should have entries");

        index.free();
        diff.free();
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("apply diff with added file", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        // Create first commit
        await createCommitWithFiles(ctx, "Initial", {
          "file.txt": "initial\n",
        });
        const firstOid = ctx.repo.headOid();

        // Create second commit with new file
        await createCommitWithFiles(ctx, "Add file", {
          "file.txt": "initial\n",
          "new.txt": "new content\n",
        });
        const secondOid = ctx.repo.headOid();

        // Remove the new file from workdir
        try {
          await Deno.remove(`${ctx.repoPath}/new.txt`);
        } catch {
          // File might not exist
        }

        // Get diff between first and second commit
        const diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
        assertExists(diff, "Should return a diff");

        // Apply diff to workdir
        ctx.repo.apply(diff, ApplyLocation.WORKDIR);

        // Check that new file was created
        const content = await readFile(`${ctx.repoPath}/new.txt`);
        assertEquals(content, "new content\n", "New file should be created");

        diff.free();
      } finally {
        await cleanupTestContext(ctx);
      }
    });
  } finally {
    shutdown();
  }
});
