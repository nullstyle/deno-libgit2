/**
 * End-to-end tests for patch functionality
 * Tests use real file operations in temporary directories
 */

import { assert, assertEquals, assertExists, assertThrows } from "@std/assert";
import { createCommitWithFiles, createTestContext, setupLibrary } from "./helpers.ts";

Deno.test("E2E Patch Tests", async (t) => {
  using _git = await setupLibrary();
    await t.step("create patch from diff", async () => {
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

      // Create patch from diff
      const patch = ctx.repo.patchFromDiff(diff, 0);
      assertExists(patch, "Should return a patch");

      // Get patch as string
      const patchStr = patch.toString();
      assert(patchStr.includes("file.txt"), "Patch should mention file.txt");
      assert(patchStr.includes("-initial"), "Patch should show removed line");
      assert(patchStr.includes("+modified"), "Patch should show added line");

      patch.free();
      diff.free();
    });

    await t.step("patch num hunks", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      // Create first commit
      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "line1\nline2\nline3\n",
      });
      const firstOid = ctx.repo.headOid();

      // Create second commit with changes
      await createCommitWithFiles(ctx, "Modified", {
        "file.txt": "line1\nmodified\nline3\n",
      });
      const secondOid = ctx.repo.headOid();

      // Get diff and patch
      const diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
      const patch = ctx.repo.patchFromDiff(diff, 0);
      assertExists(patch, "Should return a patch");

      // Check number of hunks
      const numHunks = patch.numHunks;
      assertEquals(numHunks, 1, "Should have 1 hunk");

      patch.free();
      diff.free();
    });

    await t.step("patch get delta", async () => {
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

      // Get diff and patch
      const diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
      const patch = ctx.repo.patchFromDiff(diff, 0);
      assertExists(patch, "Should return a patch");

      // Get delta from patch
      const delta = patch.getDelta();
      assertExists(delta, "Should return a delta");
      assertEquals(delta.oldFile.path, "file.txt");
      assertEquals(delta.newFile.path, "file.txt");

      patch.free();
      diff.free();
    });

    await t.step("patch for added file", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
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

      // Get diff
      const diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
      assertEquals(diff.numDeltas, 1, "Should have 1 delta");

      // Create patch for the added file
      const patch = ctx.repo.patchFromDiff(diff, 0);
      assertExists(patch, "Should return a patch");

      // Get patch as string
      const patchStr = patch.toString();
      assert(patchStr.includes("new.txt"), "Patch should mention new.txt");
      assert(
        patchStr.includes("+new content"),
        "Patch should show added content",
      );

      patch.free();
      diff.free();
    });

    await t.step("patch line stats", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      // Create first commit
      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "line1\nline2\nline3\n",
      });
      const firstOid = ctx.repo.headOid();

      // Create second commit with changes
      await createCommitWithFiles(ctx, "Modified", {
        "file.txt": "line1\nmodified\nline3\nnew line\n",
      });
      const secondOid = ctx.repo.headOid();

      // Get diff and patch
      const diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
      const patch = ctx.repo.patchFromDiff(diff, 0);
      assertExists(patch, "Should return a patch");

      // Get line stats
      const stats = patch.lineStats;
      assertExists(stats, "Should return line stats");
      // 1 line deleted (line2), 2 lines added (modified, new line)
      assert(stats.additions >= 1, "Should have additions");
      assert(stats.deletions >= 1, "Should have deletions");

      patch.free();
      diff.free();
    });

    await t.step("patch ptr getter returns valid pointer", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "initial\n",
      });
      const firstOid = ctx.repo.headOid();

      await createCommitWithFiles(ctx, "Modified", {
        "file.txt": "modified\n",
      });
      const secondOid = ctx.repo.headOid();

      const diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
      const patch = ctx.repo.patchFromDiff(diff, 0);
      assertExists(patch);

      const ptr = patch.ptr;
      assertExists(ptr);

      patch.free();
      diff.free();
    });

    await t.step("patch Symbol.dispose works correctly", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "initial\n",
      });
      const firstOid = ctx.repo.headOid();

      await createCommitWithFiles(ctx, "Modified", {
        "file.txt": "modified\n",
      });
      const secondOid = ctx.repo.headOid();

      const diff = ctx.repo.diffTreeToTree(firstOid, secondOid);

      {
        using patch = ctx.repo.patchFromDiff(diff, 0);
        assertExists(patch);
        assert(patch.numHunks >= 0);
      }
      // patch is automatically disposed here

      diff.free();
    });

    await t.step("patch double free is safe", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "initial\n",
      });
      const firstOid = ctx.repo.headOid();

      await createCommitWithFiles(ctx, "Modified", {
        "file.txt": "modified\n",
      });
      const secondOid = ctx.repo.headOid();

      const diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
      const patch = ctx.repo.patchFromDiff(diff, 0);
      assertExists(patch);

      // First free
      patch.free();

      // Second free should be safe (no-op)
      patch.free();

      diff.free();
    });

    await t.step("patch numHunks throws after freed", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "initial\n",
      });
      const firstOid = ctx.repo.headOid();

      await createCommitWithFiles(ctx, "Modified", {
        "file.txt": "modified\n",
      });
      const secondOid = ctx.repo.headOid();

      const diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
      const patch = ctx.repo.patchFromDiff(diff, 0);
      assertExists(patch);

      patch.free();

      assertThrows(
        () => patch.numHunks,
        Error,
        "freed",
      );

      diff.free();
    });

    await t.step("patch getDelta throws after freed", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "initial\n",
      });
      const firstOid = ctx.repo.headOid();

      await createCommitWithFiles(ctx, "Modified", {
        "file.txt": "modified\n",
      });
      const secondOid = ctx.repo.headOid();

      const diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
      const patch = ctx.repo.patchFromDiff(diff, 0);
      assertExists(patch);

      patch.free();

      assertThrows(
        () => patch.getDelta(),
        Error,
        "freed",
      );

      diff.free();
    });

    await t.step("patch lineStats throws after freed", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "initial\n",
      });
      const firstOid = ctx.repo.headOid();

      await createCommitWithFiles(ctx, "Modified", {
        "file.txt": "modified\n",
      });
      const secondOid = ctx.repo.headOid();

      const diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
      const patch = ctx.repo.patchFromDiff(diff, 0);
      assertExists(patch);

      patch.free();

      assertThrows(
        () => patch.lineStats,
        Error,
        "freed",
      );

      diff.free();
    });

    await t.step("patch toString throws after freed", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "initial\n",
      });
      const firstOid = ctx.repo.headOid();

      await createCommitWithFiles(ctx, "Modified", {
        "file.txt": "modified\n",
      });
      const secondOid = ctx.repo.headOid();

      const diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
      const patch = ctx.repo.patchFromDiff(diff, 0);
      assertExists(patch);

      patch.free();

      assertThrows(
        () => patch.toString(),
        Error,
        "freed",
      );

      diff.free();
    });

    await t.step("patch with file modifications", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      // Create first commit with a file
      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "original content\n",
      });
      const firstOid = ctx.repo.headOid();

      // Create second commit with different content
      await createCommitWithFiles(ctx, "Modify file", {
        "file.txt": "new content\n",
      });
      const secondOid = ctx.repo.headOid();

      const diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
      assert(diff.numDeltas >= 1, "Should have at least 1 delta");

      const patch = ctx.repo.patchFromDiff(diff, 0);
      assertExists(patch);

      const delta = patch.getDelta();
      assertExists(delta);
      assertEquals(delta.oldFile.path, "file.txt");

      const patchStr = patch.toString();
      assert(
        patchStr.includes("-original content"),
        "Patch should show removed content",
      );
      assert(
        patchStr.includes("+new content"),
        "Patch should show added content",
      );

      patch.free();
      diff.free();
    });

    await t.step("patch with multiple hunks", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      // Create a file with many lines
      const originalContent = Array.from(
        { length: 20 },
        (_, i) => `line ${i + 1}`,
      ).join("\n") + "\n";
      await createCommitWithFiles(ctx, "Initial", {
        "multiline.txt": originalContent,
      });
      const firstOid = ctx.repo.headOid();

      // Modify lines at the beginning and end (creates multiple hunks)
      const lines = originalContent.split("\n");
      lines[0] = "modified first line";
      lines[18] = "modified near end";
      const modifiedContent = lines.join("\n");
      await createCommitWithFiles(ctx, "Modified", {
        "multiline.txt": modifiedContent,
      });
      const secondOid = ctx.repo.headOid();

      const diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
      const patch = ctx.repo.patchFromDiff(diff, 0);
      assertExists(patch);

      // Should have 2 hunks (one for each change)
      const numHunks = patch.numHunks;
      assert(numHunks >= 1, "Should have at least 1 hunk");

      patch.free();
      diff.free();
    });

    await t.step("patch delta has valid properties", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "initial\n",
      });
      const firstOid = ctx.repo.headOid();

      await createCommitWithFiles(ctx, "Modified", {
        "file.txt": "modified\n",
      });
      const secondOid = ctx.repo.headOid();

      const diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
      const patch = ctx.repo.patchFromDiff(diff, 0);
      assertExists(patch);

      const delta = patch.getDelta();
      assertExists(delta);

      // Status should be a valid delta type (1=ADDED, 2=DELETED, 3=MODIFIED, etc.)
      assert(delta.status >= 1, "Status should be a valid delta type");
      // nfiles should be 1 or 2
      assert(delta.nfiles >= 1 && delta.nfiles <= 2, "nfiles should be 1 or 2");
      // flags should be a number
      assertEquals(typeof delta.flags, "number");
      // similarity should be a number
      assertEquals(typeof delta.similarity, "number");

      patch.free();
      diff.free();
    });

    await t.step("patch for renamed file", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial", {
        "old-name.txt": "content\n",
      });
      const firstOid = ctx.repo.headOid();

      // "Rename" by deleting old and creating new with same content
      await createCommitWithFiles(ctx, "Renamed", {
        "new-name.txt": "content\n",
      });
      const secondOid = ctx.repo.headOid();

      const diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
      // This creates a delete and an add (not a true rename without detection)
      assert(diff.numDeltas >= 1, "Should have at least 1 delta");

      if (diff.numDeltas >= 1) {
        const patch = ctx.repo.patchFromDiff(diff, 0);
        if (patch) {
          const delta = patch.getDelta();
          assertExists(delta);
          assertExists(delta.oldFile);
          assertExists(delta.newFile);
          patch.free();
        }
      }

      diff.free();
    });

    await t.step("patchFromDiff with invalid index throws error", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "initial\n",
      });
      const firstOid = ctx.repo.headOid();

      await createCommitWithFiles(ctx, "Modified", {
        "file.txt": "modified\n",
      });
      const secondOid = ctx.repo.headOid();

      const diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
      assertEquals(diff.numDeltas, 1, "Should have 1 delta");

      // Try to get patch for an index that doesn't exist - should throw
      assertThrows(
        () => ctx.repo.patchFromDiff(diff, 999),
        Error,
      );

      diff.free();
    });

    await t.step("patchFromDiff with empty diff", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "content\n",
      });
      const firstOid = ctx.repo.headOid();

      // Same content - no changes
      await createCommitWithFiles(ctx, "No change", {
        "file.txt": "content\n",
      });
      const secondOid = ctx.repo.headOid();

      const diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
      // No changes means no deltas
      assertEquals(diff.numDeltas, 0, "Should have 0 deltas");

      diff.free();
    });

    // ==================== Additional Coverage Tests ====================

    await t.step("patch line stats has context lines", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "line1\nline2\nline3\nline4\nline5\n",
      });
      const firstOid = ctx.repo.headOid();

      await createCommitWithFiles(ctx, "Modified", {
        "file.txt": "line1\nline2\nMODIFIED\nline4\nline5\n",
      });
      const secondOid = ctx.repo.headOid();

      const diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
      const patch = ctx.repo.patchFromDiff(diff, 0);
      assertExists(patch);

      const stats = patch.lineStats;
      // Context should be the surrounding unchanged lines
      assert(stats.context >= 0);
      assert(stats.additions >= 1);
      assert(stats.deletions >= 1);

      patch.free();
      diff.free();
    });

    await t.step("patch delta has file OIDs", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "initial\n",
      });
      const firstOid = ctx.repo.headOid();

      await createCommitWithFiles(ctx, "Modified", {
        "file.txt": "modified\n",
      });
      const secondOid = ctx.repo.headOid();

      const diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
      const patch = ctx.repo.patchFromDiff(diff, 0);
      assertExists(patch);

      const delta = patch.getDelta();
      // Both old and new files should have OIDs
      assertExists(delta.oldFile.oid);
      assertExists(delta.newFile.oid);
      assertEquals(delta.oldFile.oid.length, 40);
      assertEquals(delta.newFile.oid.length, 40);

      patch.free();
      diff.free();
    });

    await t.step("patch delta file has size property", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "some content here\n",
      });
      const firstOid = ctx.repo.headOid();

      await createCommitWithFiles(ctx, "Modified", {
        "file.txt": "different content\n",
      });
      const secondOid = ctx.repo.headOid();

      const diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
      const patch = ctx.repo.patchFromDiff(diff, 0);
      assertExists(patch);

      const delta = patch.getDelta();
      // Size should be a bigint
      assertEquals(typeof delta.oldFile.size, "bigint");
      assertEquals(typeof delta.newFile.size, "bigint");

      patch.free();
      diff.free();
    });

    await t.step("patch delta file has mode property", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "content\n",
      });
      const firstOid = ctx.repo.headOid();

      await createCommitWithFiles(ctx, "Modified", {
        "file.txt": "modified content\n",
      });
      const secondOid = ctx.repo.headOid();

      const diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
      const patch = ctx.repo.patchFromDiff(diff, 0);
      assertExists(patch);

      const delta = patch.getDelta();
      // Mode should be a number
      assertEquals(typeof delta.oldFile.mode, "number");
      assertEquals(typeof delta.newFile.mode, "number");

      patch.free();
      diff.free();
    });

    await t.step("patch delta file has flags property", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "content\n",
      });
      const firstOid = ctx.repo.headOid();

      await createCommitWithFiles(ctx, "Modified", {
        "file.txt": "modified\n",
      });
      const secondOid = ctx.repo.headOid();

      const diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
      const patch = ctx.repo.patchFromDiff(diff, 0);
      assertExists(patch);

      const delta = patch.getDelta();
      assertEquals(typeof delta.oldFile.flags, "number");
      assertEquals(typeof delta.newFile.flags, "number");

      patch.free();
      diff.free();
    });

    await t.step("patch line stats shows 0 for new file with only additions", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "content\n",
      });
      const firstOid = ctx.repo.headOid();

      // Add a new file
      await createCommitWithFiles(ctx, "Add new file", {
        "file.txt": "content\n",
        "newfile.txt": "new content\n",
      });
      const secondOid = ctx.repo.headOid();

      const diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
      assertEquals(diff.numDeltas, 1);

      const patch = ctx.repo.patchFromDiff(diff, 0);
      assertExists(patch);

      const stats = patch.lineStats;
      // New file - should have additions, no deletions
      assert(stats.additions >= 1);
      assertEquals(stats.deletions, 0);

      patch.free();
      diff.free();
    });

    await t.step("patch toString includes diff header", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "initial\n",
      });
      const firstOid = ctx.repo.headOid();

      await createCommitWithFiles(ctx, "Modified", {
        "file.txt": "modified\n",
      });
      const secondOid = ctx.repo.headOid();

      const diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
      const patch = ctx.repo.patchFromDiff(diff, 0);
      assertExists(patch);

      const patchStr = patch.toString();
      // Standard diff format includes these headers
      assert(patchStr.includes("diff --git"));
      assert(patchStr.includes("---"));
      assert(patchStr.includes("+++"));
      assert(patchStr.includes("@@"));

      patch.free();
      diff.free();
    });

    await t.step("multiple patches from single diff", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial", {
        "file1.txt": "content1\n",
        "file2.txt": "content2\n",
      });
      const firstOid = ctx.repo.headOid();

      await createCommitWithFiles(ctx, "Modified", {
        "file1.txt": "modified1\n",
        "file2.txt": "modified2\n",
      });
      const secondOid = ctx.repo.headOid();

      const diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
      assertEquals(diff.numDeltas, 2);

      const patch1 = ctx.repo.patchFromDiff(diff, 0);
      const patch2 = ctx.repo.patchFromDiff(diff, 1);

      assertExists(patch1);
      assertExists(patch2);

      const delta1 = patch1.getDelta();
      const delta2 = patch2.getDelta();

      // Both patches should have valid deltas
      assertExists(delta1.oldFile.path);
      assertExists(delta2.oldFile.path);

      patch1.free();
      patch2.free();
      diff.free();
    });
});
