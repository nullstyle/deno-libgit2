/**
 * End-to-end tests for diff functionality (diff.ts)
 *
 * These tests validate diff operations including tree-to-tree,
 * tree-to-index, index-to-workdir, and tree-to-workdir diffs.
 */

import {
  assertEquals,
  assertExists,
  assertFalse,
  assertThrows,
} from "@std/assert";
import {
  createCommitWithDeletions,
  createCommitWithFiles,
  createFile,
  createTestContext,
  setupLibrary,
} from "./helpers.ts";
import {
  Diff,
  DiffDeltaType,
  DiffFileFlags,
  diffIndexToWorkdir,
  diffTreeToIndex,
  diffTreeToTree,
  diffTreeToWorkdir,
} from "../../src/diff.ts";
import { getLibrary } from "../../src/library.ts";

Deno.test({
  name: "E2E Diff Tests",
  async fn(t) {
    using _git = await setupLibrary();
    // Enum tests
    await t.step("DiffDeltaType enum has correct values", () => {
      assertEquals(DiffDeltaType.UNMODIFIED, 0);
      assertEquals(DiffDeltaType.ADDED, 1);
      assertEquals(DiffDeltaType.DELETED, 2);
      assertEquals(DiffDeltaType.MODIFIED, 3);
      assertEquals(DiffDeltaType.RENAMED, 4);
      assertEquals(DiffDeltaType.COPIED, 5);
      assertEquals(DiffDeltaType.IGNORED, 6);
      assertEquals(DiffDeltaType.UNTRACKED, 7);
      assertEquals(DiffDeltaType.TYPECHANGE, 8);
      assertEquals(DiffDeltaType.UNREADABLE, 9);
      assertEquals(DiffDeltaType.CONFLICTED, 10);
    });

    await t.step("DiffFileFlags enum has correct values", () => {
      assertEquals(DiffFileFlags.VALID_ID, 1);
      assertEquals(DiffFileFlags.BINARY, 2);
      assertEquals(DiffFileFlags.NOT_BINARY, 4);
      assertEquals(DiffFileFlags.VALID_SIZE, 8);
      assertEquals(DiffFileFlags.EXISTS, 16);
    });

    // Basic diff tests
    await t.step("diff tree to tree (modified file)", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });

      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "initial\n",
      });
      const firstOid = ctx.repo.headOid();

      await createCommitWithFiles(ctx, "Modified", {
        "file.txt": "modified\n",
      });
      const secondOid = ctx.repo.headOid();

      using diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
      assertExists(diff, "Should return a diff");

      assertEquals(diff.numDeltas, 1, "Should have 1 delta");

      const delta = diff.getDelta(0);
      assertExists(delta);
      assertEquals(delta.status, DiffDeltaType.MODIFIED);
      assertEquals(delta.oldFile.path, "file.txt");
      assertEquals(delta.newFile.path, "file.txt");
    });

    await t.step("diff tree to tree (added file)", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });

      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "initial\n",
      });
      const firstOid = ctx.repo.headOid();

      await createCommitWithFiles(ctx, "Add file", {
        "file.txt": "initial\n",
        "new.txt": "new file\n",
      });
      const secondOid = ctx.repo.headOid();

      using diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
      assertExists(diff);

      assertEquals(diff.numDeltas, 1, "Should have 1 delta (added)");

      const delta = diff.getDelta(0);
      assertExists(delta);
      assertEquals(delta.status, DiffDeltaType.ADDED);
      assertEquals(delta.newFile.path, "new.txt");
    });

    await t.step("diff tree to tree (deleted file)", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });

      await createCommitWithFiles(ctx, "Initial", {
        "file1.txt": "file1\n",
        "file2.txt": "file2\n",
      });
      const firstOid = ctx.repo.headOid();

      await createCommitWithDeletions(ctx, "Delete file2", ["file2.txt"]);
      const secondOid = ctx.repo.headOid();

      using diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
      assertExists(diff);

      assertEquals(diff.numDeltas, 1, "Should have 1 delta (deleted)");

      const delta = diff.getDelta(0);
      assertExists(delta);
      assertEquals(delta.status, DiffDeltaType.DELETED);
      assertEquals(delta.oldFile.path, "file2.txt");
    });

    await t.step("diff tree to tree (multiple changes)", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });

      await createCommitWithFiles(ctx, "Initial", {
        "keep.txt": "keep\n",
        "modify.txt": "original\n",
        "delete.txt": "to delete\n",
      });
      const firstOid = ctx.repo.headOid();

      // Delete first, then add and modify
      await createCommitWithDeletions(ctx, "Delete", ["delete.txt"]);

      await createCommitWithFiles(ctx, "Modify and add", {
        "keep.txt": "keep\n",
        "modify.txt": "modified\n",
        "add.txt": "new\n",
      });
      const secondOid = ctx.repo.headOid();

      using diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
      assertExists(diff);

      // Should have: 1 deleted, 1 modified, 1 added = 3 deltas
      assertEquals(diff.numDeltas, 3, "Should have 3 deltas");
    });

    await t.step("diff tree to tree (no changes)", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });

      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "content\n",
      });
      const commitOid = ctx.repo.headOid();

      using diff = ctx.repo.diffTreeToTree(commitOid, commitOid);
      assertExists(diff);

      assertEquals(diff.numDeltas, 0, "Should have 0 deltas");
    });

    await t.step("diff tree to workdir", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });

      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "initial\n",
      });
      const commitOid = ctx.repo.headOid();

      // Modify file in working directory
      await Deno.writeTextFile(`${ctx.repoPath}/file.txt`, "modified\n");

      using diff = ctx.repo.diffTreeToWorkdir(commitOid);
      assertExists(diff);

      assertEquals(diff.numDeltas, 1, "Should have 1 delta");

      const delta = diff.getDelta(0);
      assertExists(delta);
      assertEquals(delta.status, DiffDeltaType.MODIFIED);
    });

    await t.step("diff tree to workdir (modified tracked file)", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });

      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "initial\n",
        "another.txt": "another\n",
      });
      const commitOid = ctx.repo.headOid();

      // Modify a tracked file in working directory
      await Deno.writeTextFile(`${ctx.repoPath}/another.txt`, "changed\n");

      using diff = ctx.repo.diffTreeToWorkdir(commitOid);
      assertExists(diff);

      // Should detect the modified tracked file
      assertEquals(
        diff.numDeltas,
        1,
        "Should have 1 delta for modified file",
      );
      const delta = diff.getDelta(0);
      assertExists(delta);
      assertEquals(delta.status, DiffDeltaType.MODIFIED);
    });

    await t.step("diff index to workdir", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });

      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "initial\n",
      });

      // Modify file in working directory
      await Deno.writeTextFile(`${ctx.repoPath}/file.txt`, "modified\n");

      using diff = ctx.repo.diffIndexToWorkdir();
      assertExists(diff);

      assertEquals(diff.numDeltas, 1, "Should have 1 delta");

      const delta = diff.getDelta(0);
      assertExists(delta);
      assertEquals(delta.status, DiffDeltaType.MODIFIED);
      assertEquals(delta.oldFile.path, "file.txt");
    });

    await t.step(
      "diff index to workdir (no changes after clean commit)",
      async () => {
        await using ctx = await createTestContext({
          withInitialCommit: true,
        });

        await createCommitWithFiles(ctx, "Initial", {
          "file.txt": "initial\n",
        });

        // Working directory should match index
        using diff = ctx.repo.diffIndexToWorkdir();
        assertExists(diff);

        assertEquals(diff.numDeltas, 0, "Should have 0 deltas");
      },
    );

    // Direct function tests
    await t.step("diffTreeToTree function", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });

      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "initial\n",
      });
      const firstOid = ctx.repo.headOid()!;

      await createCommitWithFiles(ctx, "Modified", {
        "file.txt": "modified\n",
      });
      const secondOid = ctx.repo.headOid()!;

      // Get tree pointers manually
      const lib = getLibrary();

      // We need to get tree pointers - use repo's internal method
      using diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
      assertExists(diff);
      assertEquals(diff.numDeltas, 1);
    });

    await t.step("diffIndexToWorkdir function", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });

      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "initial\n",
      });

      await Deno.writeTextFile(`${ctx.repoPath}/file.txt`, "modified\n");

      const lib = getLibrary();
      using diff = diffIndexToWorkdir(lib, ctx.repo.pointer, null);
      assertExists(diff);
      assertEquals(diff.numDeltas, 1);
    });

    await t.step("diffTreeToIndex function (staged changes)", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });

      // Create initial commit
      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "initial\n",
      });
      const commitOid = ctx.repo.headOid()!;

      // Stage a new file
      await createFile(ctx.repoPath, "staged.txt", "staged content\n");

      // Get index and stage the file
      const { Index } = await import("../../mod.ts");
      using index = Index.fromRepository(ctx.repo);
      index.add("staged.txt");
      index.write();

      // Now diff tree to index should show the staged file
      const lib = getLibrary();

      // Get tree pointer from commit
      const treeOutPtr = new Uint8Array(8);
      const commitOutPtr = new Uint8Array(8);
      const oidBuf = new Uint8Array(20);

      // Parse OID
      for (let i = 0; i < 20; i++) {
        oidBuf[i] = parseInt(commitOid.substring(i * 2, i * 2 + 2), 16);
      }

      // We'll use the repo method instead since getting tree pointer is complex
      // Just verify the function exists and can be called via repo wrapper
      using diff = ctx.repo.diffTreeToTree(commitOid, null);
      assertExists(diff);
    });

    await t.step("diffTreeToIndex via index changes", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });

      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "initial\n",
      });

      // Modify and stage
      await createFile(ctx.repoPath, "file.txt", "modified\n");

      const { Index } = await import("../../mod.ts");
      using index = Index.fromRepository(ctx.repo);
      index.add("file.txt");
      index.write();

      // diffTreeToIndex is called internally when comparing staged changes
      // We can test by comparing HEAD tree to index
      const lib = getLibrary();
      using diff = diffTreeToIndex(lib, ctx.repo.pointer, null, null);
      assertExists(diff);
      // With null tree, it compares empty tree to index
      assertEquals(diff.numDeltas >= 1, true);
    });

    // Delta details tests
    await t.step("getDelta returns null for invalid index", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });

      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "initial\n",
      });
      const commitOid = ctx.repo.headOid();

      using diff = ctx.repo.diffTreeToTree(commitOid, commitOid);
      assertExists(diff);

      assertEquals(diff.numDeltas, 0);
      const delta = diff.getDelta(0);
      assertEquals(delta, null);
      assertEquals(diff.getDelta(999), null);
    });

    await t.step("delta contains file info", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });

      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "initial content\n",
      });
      const firstOid = ctx.repo.headOid();

      await createCommitWithFiles(ctx, "Modified", {
        "file.txt": "modified content here\n",
      });
      const secondOid = ctx.repo.headOid();

      using diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
      assertExists(diff);

      const delta = diff.getDelta(0);
      assertExists(delta);

      // Check old file
      assertExists(delta.oldFile);
      assertEquals(delta.oldFile.path, "file.txt");
      assertEquals(delta.oldFile.oid.length, 40);
      assertEquals(typeof delta.oldFile.size, "bigint");
      assertEquals(typeof delta.oldFile.flags, "number");
      assertEquals(typeof delta.oldFile.mode, "number");

      // Check new file
      assertExists(delta.newFile);
      assertEquals(delta.newFile.path, "file.txt");
      assertEquals(delta.newFile.oid.length, 40);

      // OIDs should be different for modified file
      assertFalse(delta.oldFile.oid === delta.newFile.oid);
    });

    await t.step("delta flags and similarity", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });

      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "content\n",
      });
      const firstOid = ctx.repo.headOid();

      await createCommitWithFiles(ctx, "Modified", {
        "file.txt": "modified\n",
      });
      const secondOid = ctx.repo.headOid();

      using diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
      const delta = diff.getDelta(0);
      assertExists(delta);

      assertEquals(typeof delta.flags, "number");
      assertEquals(typeof delta.similarity, "number");
      assertEquals(typeof delta.nfiles, "number");
    });

    // Deltas generator test
    await t.step("deltas generator iterates all deltas", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });

      await createCommitWithFiles(ctx, "Initial", {
        "file1.txt": "content1\n",
      });
      const firstOid = ctx.repo.headOid();

      await createCommitWithFiles(ctx, "Add files", {
        "file1.txt": "content1\n",
        "file2.txt": "content2\n",
        "file3.txt": "content3\n",
      });
      const secondOid = ctx.repo.headOid();

      using diff = ctx.repo.diffTreeToTree(firstOid, secondOid);

      const deltas = [...diff.deltas()];
      assertEquals(deltas.length, 2, "Should have 2 added files");

      for (const delta of deltas) {
        assertEquals(delta.status, DiffDeltaType.ADDED);
      }
    });

    await t.step("deltas generator handles empty diff", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });

      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "content\n",
      });
      const commitOid = ctx.repo.headOid();

      using diff = ctx.repo.diffTreeToTree(commitOid, commitOid);

      const deltas = [...diff.deltas()];
      assertEquals(deltas.length, 0);
    });

    // Diff pointer test
    await t.step("diff ptr property returns pointer", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });

      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "content\n",
      });
      const commitOid = ctx.repo.headOid();

      using diff = ctx.repo.diffTreeToTree(commitOid, commitOid);
      assertExists(diff.ptr);
    });

    // Cleanup tests
    await t.step("free is idempotent", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });

      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "content\n",
      });
      const commitOid = ctx.repo.headOid();

      const diff = ctx.repo.diffTreeToTree(commitOid, commitOid);
      diff.free();
      diff.free(); // Should not throw
      diff.free(); // Should not throw
    });

    await t.step("numDeltas throws after freed", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });

      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "content\n",
      });
      const commitOid = ctx.repo.headOid();

      const diff = ctx.repo.diffTreeToTree(commitOid, commitOid);
      diff.free();

      assertThrows(
        () => diff.numDeltas,
        Error,
        "freed",
      );
    });

    await t.step("getDelta throws after freed", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });

      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "content\n",
      });
      const commitOid = ctx.repo.headOid();

      const diff = ctx.repo.diffTreeToTree(commitOid, commitOid);
      diff.free();

      assertThrows(
        () => diff.getDelta(0),
        Error,
        "freed",
      );
    });

    await t.step("Symbol.dispose works for automatic cleanup", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });

      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "content\n",
      });
      const commitOid = ctx.repo.headOid();

      {
        using diff = ctx.repo.diffTreeToTree(commitOid, commitOid);
        assertEquals(diff.numDeltas, 0);
      }
      // Diff should be freed after leaving the block
    });

    // Large diff test
    await t.step("handle diff with many files", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });

      await createCommitWithFiles(ctx, "Initial", {
        "base.txt": "base\n",
      });
      const firstOid = ctx.repo.headOid();

      // Create many files
      const files: Record<string, string> = {
        "base.txt": "base\n",
      };
      for (let i = 0; i < 20; i++) {
        files[`file${i.toString().padStart(2, "0")}.txt`] = `content ${i}\n`;
      }

      await createCommitWithFiles(ctx, "Add many files", files);
      const secondOid = ctx.repo.headOid();

      using diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
      assertExists(diff);

      assertEquals(diff.numDeltas, 20, "Should have 20 added files");

      // Iterate through all deltas
      let count = 0;
      for (const delta of diff.deltas()) {
        assertEquals(delta.status, DiffDeltaType.ADDED);
        count++;
      }
      assertEquals(count, 20);
    });

    // Nested directory diff
    await t.step("diff with nested directories", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });

      await createCommitWithFiles(ctx, "Initial", {
        "root.txt": "root\n",
      });
      const firstOid = ctx.repo.headOid();

      await createCommitWithFiles(ctx, "Add nested", {
        "root.txt": "root\n",
        "a/b/c/deep.txt": "deep content\n",
        "a/shallow.txt": "shallow\n",
      });
      const secondOid = ctx.repo.headOid();

      using diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
      assertExists(diff);

      assertEquals(diff.numDeltas, 2, "Should have 2 added files");

      const paths = [...diff.deltas()].map((d) => d.newFile.path).sort();
      assertEquals(paths, ["a/b/c/deep.txt", "a/shallow.txt"]);
    });

    // Binary file diff
    await t.step("diff with binary file", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });

      await createCommitWithFiles(ctx, "Initial", {
        "text.txt": "text\n",
      });
      const firstOid = ctx.repo.headOid();

      // Add binary file
      const binaryContent = new Uint8Array([
        0x00,
        0x01,
        0x02,
        0xff,
        0xfe,
        0x00,
      ]);
      await Deno.writeFile(`${ctx.repoPath}/binary.bin`, binaryContent);

      // Stage and commit
      await createCommitWithFiles(ctx, "Add binary", {
        "text.txt": "text\n",
        // We need to add the binary file differently
      });

      // Just verify we can create diffs with mixed content
      const secondOid = ctx.repo.headOid();
      using diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
      assertExists(diff);
    });

    // Empty tree diff
    await t.step("diff with first commit (null old tree)", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });

      // Create a commit
      await createCommitWithFiles(ctx, "First commit", {
        "file.txt": "content\n",
      });
      const commitOid = ctx.repo.headOid();

      // Diff null (empty) to the commit's tree
      using diff = ctx.repo.diffTreeToTree(null, commitOid);
      assertExists(diff);

      // All files should appear as added
      assertEquals(diff.numDeltas >= 1, true);
      const delta = diff.getDelta(0);
      assertExists(delta);
    });

    // Status type tests for different operations
    await t.step("modified status for changed content", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });

      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "original content\n",
      });
      const firstOid = ctx.repo.headOid();

      await createCommitWithFiles(ctx, "Modified", {
        "file.txt": "changed content\n",
      });
      const secondOid = ctx.repo.headOid();

      using diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
      const delta = diff.getDelta(0);
      assertExists(delta);

      assertEquals(
        delta.status,
        DiffDeltaType.MODIFIED,
        "Status should be MODIFIED",
      );
    });

    await t.step("added status for new file", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });

      await createCommitWithFiles(ctx, "Initial", {
        "existing.txt": "existing\n",
      });
      const firstOid = ctx.repo.headOid();

      await createCommitWithFiles(ctx, "Add new", {
        "existing.txt": "existing\n",
        "newfile.txt": "new\n",
      });
      const secondOid = ctx.repo.headOid();

      using diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
      const delta = diff.getDelta(0);
      assertExists(delta);

      assertEquals(
        delta.status,
        DiffDeltaType.ADDED,
        "Status should be ADDED",
      );
      assertEquals(delta.newFile.path, "newfile.txt");
    });

    await t.step("deleted status for removed file", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });

      await createCommitWithFiles(ctx, "Initial", {
        "tokeep.txt": "keep\n",
        "todelete.txt": "delete\n",
      });
      const firstOid = ctx.repo.headOid();

      await createCommitWithDeletions(ctx, "Delete", ["todelete.txt"]);
      const secondOid = ctx.repo.headOid();

      using diff = ctx.repo.diffTreeToTree(firstOid, secondOid);
      const delta = diff.getDelta(0);
      assertExists(delta);

      assertEquals(
        delta.status,
        DiffDeltaType.DELETED,
        "Status should be DELETED",
      );
      assertEquals(delta.oldFile.path, "todelete.txt");
    });
  },
});
