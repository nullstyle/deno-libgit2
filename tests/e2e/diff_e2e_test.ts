/**
 * End-to-end tests for diff functionality
 * Tests use real file operations in temporary directories
 */

import { assertEquals, assertExists } from "@std/assert";
import { init, shutdown } from "../../mod.ts";
import {
  
  createCommitWithDeletions,
  createCommitWithFiles,
  createTestContext,
} from "./helpers.ts";

Deno.test("E2E Diff Tests", async (t) => {
  await init();

  try {
    await t.step("diff tree to tree", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
        // Create first commit
        await createCommitWithFiles(ctx, "Initial", {
          "file.txt": "initial\n",
        });
        const firstOid = ctx.repo.headOid();

        // Create second commit with changes
        await createCommitWithFiles(ctx, "Modified", {
          "file.txt": "modified\n",
          "new.txt": "new file\n",
        });
        const secondOid = ctx.repo.headOid();

        // Get diff between the two commits
        const diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
        assertExists(diff, "Should return a diff");

        // Check number of deltas
        const numDeltas = diff.numDeltas;
        assertEquals(numDeltas, 2, "Should have 2 deltas (modified + added)");

        diff.free();
      
    });

    await t.step("diff tree to workdir", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
        // Create initial commit
        await createCommitWithFiles(ctx, "Initial", {
          "file.txt": "initial\n",
        });
        const commitOid = ctx.repo.headOid();

        // Modify file in working directory
        await Deno.writeTextFile(`${ctx.repoPath}/file.txt`, "modified\n");

        // Get diff between commit and workdir
        const diff = ctx.repo.diffTreeToWorkdir(commitOid);
        assertExists(diff, "Should return a diff");

        // Check number of deltas
        const numDeltas = diff.numDeltas;
        assertEquals(numDeltas, 1, "Should have 1 delta (modified file)");

        diff.free();
      
    });

    await t.step("diff index to workdir", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
        // Create initial commit
        await createCommitWithFiles(ctx, "Initial", {
          "file.txt": "initial\n",
        });

        // Modify file in working directory
        await Deno.writeTextFile(`${ctx.repoPath}/file.txt`, "modified\n");

        // Get diff between index and workdir
        const diff = ctx.repo.diffIndexToWorkdir();
        assertExists(diff, "Should return a diff");

        // Check number of deltas
        const numDeltas = diff.numDeltas;
        assertEquals(numDeltas, 1, "Should have 1 delta (modified file)");

        diff.free();
      
    });

    await t.step("diff with added files", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
        // Create initial commit
        await createCommitWithFiles(ctx, "Initial", {
          "file.txt": "initial\n",
        });
        const firstOid = ctx.repo.headOid();

        // Create second commit with new files
        await createCommitWithFiles(ctx, "Add files", {
          "file.txt": "initial\n",
          "new1.txt": "new1\n",
          "new2.txt": "new2\n",
        });
        const secondOid = ctx.repo.headOid();

        // Get diff
        const diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
        assertExists(diff, "Should return a diff");

        // Should have 2 added files
        const numDeltas = diff.numDeltas;
        assertEquals(numDeltas, 2, "Should have 2 deltas (added files)");

        diff.free();
      
    });

    await t.step("diff with deleted files", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
        // Create initial commit with multiple files
        await createCommitWithFiles(ctx, "Initial", {
          "file1.txt": "file1\n",
          "file2.txt": "file2\n",
        });
        const firstOid = ctx.repo.headOid();

        // Delete file2.txt using libgit2 to avoid external git config issues
        await createCommitWithDeletions(ctx, "Delete file2", ["file2.txt"]);

        const secondOid = ctx.repo.headOid();

        // Get diff
        const diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
        assertExists(diff, "Should return a diff");

        // Should have 1 deleted file
        const numDeltas = diff.numDeltas;
        assertEquals(numDeltas, 1, "Should have 1 delta (deleted file)");

        diff.free();
      
    });

    await t.step("diff empty (no changes)", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
        // Create commit
        await createCommitWithFiles(ctx, "Initial", {
          "file.txt": "initial\n",
        });
        const commitOid = ctx.repo.headOid();

        // Diff same commit against itself
        const diff = ctx.repo.diffTreeToTree(commitOid, commitOid);
        assertExists(diff, "Should return a diff");

        // Should have no deltas
        const numDeltas = diff.numDeltas;
        assertEquals(numDeltas, 0, "Should have 0 deltas (no changes)");

        diff.free();
      
    });

    await t.step("get delta from diff", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
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

        // Get diff
        const diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
        assertExists(diff, "Should return a diff");

        // Get delta info
        const delta = diff.getDelta(0);
        assertExists(delta, "Should return a delta");
        assertEquals(delta.oldFile.path, "file.txt");
        assertEquals(delta.newFile.path, "file.txt");

        diff.free();
      
    });
  } finally {
    shutdown();
  }
});
