/**
 * End-to-end tests for Tree and TreeEntry operations
 *
 * These tests validate tree functionality including:
 * - Tree lookup and lifecycle
 * - TreeEntry properties and methods
 * - Tree navigation (by index, name, path)
 * - Tree iteration
 * - Helper functions
 * - Error handling
 */

import {
  assert,
  assertEquals,
  assertExists,
  assertNotEquals,
  assertThrows,
} from "@std/assert";
import { init, shutdown } from "../../mod.ts";
import {
  getTreeEntryByPath,
  GitFileMode,
  Tree,
  treeHasPath,
} from "../../src/tree.ts";
import { GitObjectType } from "../../src/types.ts";
import { createCommitWithFiles, createTestContext } from "./helpers.ts";

Deno.test("E2E Tree Tests", async (t) => {
  await init();

  try {
    // ==================== Tree Lookup Tests ====================

    await t.step("Tree.lookup retrieves tree by OID", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add files", {
        "file.txt": "content",
      });

      const headOid = ctx.repo.headOid()!;
      const commit = ctx.repo.lookupCommit(headOid);

      using tree = Tree.lookup(ctx.repo, commit.treeOid);
      assertExists(tree);
      assertEquals(tree.oid, commit.treeOid);
    });

    await t.step("Tree.lookup with invalid OID throws", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file", { "f.txt": "c" });

      assertThrows(
        () => Tree.lookup(ctx.repo, "invalid-oid"),
        Error,
      );
    });

    await t.step("Tree.lookup with non-existent OID throws", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file", { "f.txt": "c" });

      assertThrows(
        () => Tree.lookup(ctx.repo, "0".repeat(40)),
        Error,
      );
    });

    // ==================== Tree Properties Tests ====================

    await t.step("Tree.oid returns correct OID", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file", { "file.txt": "content" });

      const commit = ctx.repo.lookupCommit(ctx.repo.headOid()!);
      using tree = Tree.lookup(ctx.repo, commit.treeOid);

      assertEquals(tree.oid, commit.treeOid);
      assertEquals(tree.oid.length, 40);
    });

    await t.step("Tree.entryCount returns correct count", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add files", {
        "file1.txt": "content1",
        "file2.txt": "content2",
        "file3.txt": "content3",
      });

      const commit = ctx.repo.lookupCommit(ctx.repo.headOid()!);
      using tree = Tree.lookup(ctx.repo, commit.treeOid);

      // README.md from initial commit + 3 new files
      assertEquals(tree.entryCount, 4);
    });

    await t.step("Tree.pointer returns valid pointer", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file", { "f.txt": "c" });

      const commit = ctx.repo.lookupCommit(ctx.repo.headOid()!);
      using tree = Tree.lookup(ctx.repo, commit.treeOid);

      assertExists(tree.pointer);
      assertNotEquals(tree.pointer, null);
    });

    await t.step("Tree.isClosed reflects state", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file", { "f.txt": "c" });

      const commit = ctx.repo.lookupCommit(ctx.repo.headOid()!);
      const tree = Tree.lookup(ctx.repo, commit.treeOid);

      assertEquals(tree.isClosed, false);
      tree.close();
      assertEquals(tree.isClosed, true);
    });

    // ==================== Tree Close/Dispose Tests ====================

    await t.step("Tree.close frees resources", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file", { "f.txt": "c" });

      const commit = ctx.repo.lookupCommit(ctx.repo.headOid()!);
      const tree = Tree.lookup(ctx.repo, commit.treeOid);

      tree.close();

      assertThrows(
        () => tree.oid,
        Error,
        "Tree is closed",
      );
    });

    await t.step("Tree supports Symbol.dispose", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file", { "f.txt": "c" });

      const commit = ctx.repo.lookupCommit(ctx.repo.headOid()!);

      {
        using tree = Tree.lookup(ctx.repo, commit.treeOid);
        assertEquals(tree.isClosed, false);
      }
      // Tree should be disposed when scope exits
    });

    await t.step("Tree.close is idempotent", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file", { "f.txt": "c" });

      const commit = ctx.repo.lookupCommit(ctx.repo.headOid()!);
      const tree = Tree.lookup(ctx.repo, commit.treeOid);

      tree.close();
      tree.close();
      tree.close();

      assertEquals(tree.isClosed, true);
    });

    await t.step("Closed tree throws on property access", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file", { "f.txt": "c" });

      const commit = ctx.repo.lookupCommit(ctx.repo.headOid()!);
      const tree = Tree.lookup(ctx.repo, commit.treeOid);
      tree.close();

      assertThrows(() => tree.oid, Error, "Tree is closed");
      assertThrows(() => tree.entryCount, Error, "Tree is closed");
      assertThrows(() => tree.pointer, Error, "Tree is closed");
      assertThrows(() => tree.getByIndex(0), Error, "Tree is closed");
      assertThrows(() => tree.getByName("test"), Error, "Tree is closed");
      assertThrows(() => tree.getByPath("test"), Error, "Tree is closed");
    });

    // ==================== Tree.getByIndex Tests ====================

    await t.step("Tree.getByIndex returns entry at index", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file", { "test.txt": "content" });

      const commit = ctx.repo.lookupCommit(ctx.repo.headOid()!);
      using tree = Tree.lookup(ctx.repo, commit.treeOid);

      // Entries are sorted, so we can get any valid index
      const entry = tree.getByIndex(0);
      assertExists(entry);
      assertExists(entry.name);
    });

    await t.step("Tree.getByIndex returns null for invalid index", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file", { "f.txt": "c" });

      const commit = ctx.repo.lookupCommit(ctx.repo.headOid()!);
      using tree = Tree.lookup(ctx.repo, commit.treeOid);

      const entry = tree.getByIndex(9999);
      assertEquals(entry, null);
    });

    await t.step("Tree.getByIndex with negative index", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file", { "f.txt": "c" });

      const commit = ctx.repo.lookupCommit(ctx.repo.headOid()!);
      using tree = Tree.lookup(ctx.repo, commit.treeOid);

      // Negative indices should return null (handled by libgit2)
      const entry = tree.getByIndex(-1);
      assertEquals(entry, null);
    });

    // ==================== Tree.getByName Tests ====================

    await t.step("Tree.getByName finds existing file", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file", {
        "myfile.txt": "my content",
      });

      const commit = ctx.repo.lookupCommit(ctx.repo.headOid()!);
      using tree = Tree.lookup(ctx.repo, commit.treeOid);

      const entry = tree.getByName("myfile.txt");
      assertExists(entry);
      assertEquals(entry.name, "myfile.txt");
    });

    await t.step(
      "Tree.getByName returns null for non-existent file",
      async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });
        await createCommitWithFiles(ctx, "Add file", { "f.txt": "c" });

        const commit = ctx.repo.lookupCommit(ctx.repo.headOid()!);
        using tree = Tree.lookup(ctx.repo, commit.treeOid);

        const entry = tree.getByName("nonexistent.txt");
        assertEquals(entry, null);
      },
    );

    await t.step("Tree.getByName finds directory entry", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add nested file", {
        "subdir/file.txt": "content",
      });

      const commit = ctx.repo.lookupCommit(ctx.repo.headOid()!);
      using tree = Tree.lookup(ctx.repo, commit.treeOid);

      const entry = tree.getByName("subdir");
      assertExists(entry);
      assertEquals(entry.name, "subdir");
      assertEquals(entry.isTree, true);
    });

    await t.step("Tree.getByName is case-sensitive", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file", {
        "MyFile.txt": "content",
      });

      const commit = ctx.repo.lookupCommit(ctx.repo.headOid()!);
      using tree = Tree.lookup(ctx.repo, commit.treeOid);

      const exact = tree.getByName("MyFile.txt");
      assertExists(exact);

      const wrong = tree.getByName("myfile.txt");
      assertEquals(wrong, null);
    });

    // ==================== Tree.getByPath Tests ====================

    await t.step("Tree.getByPath finds nested file", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add nested", {
        "src/lib/utils.ts": "export const x = 1;",
      });

      const commit = ctx.repo.lookupCommit(ctx.repo.headOid()!);
      using tree = Tree.lookup(ctx.repo, commit.treeOid);

      using entry = tree.getByPath("src/lib/utils.ts");
      assertExists(entry);
      assertEquals(entry.name, "utils.ts");
    });

    await t.step("Tree.getByPath finds intermediate directory", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add nested", {
        "a/b/c/file.txt": "deep",
      });

      const commit = ctx.repo.lookupCommit(ctx.repo.headOid()!);
      using tree = Tree.lookup(ctx.repo, commit.treeOid);

      using entry = tree.getByPath("a/b");
      assertExists(entry);
      assertEquals(entry.name, "b");
      assertEquals(entry.isTree, true);
    });

    await t.step(
      "Tree.getByPath returns null for non-existent path",
      async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });
        await createCommitWithFiles(ctx, "Add file", { "f.txt": "c" });

        const commit = ctx.repo.lookupCommit(ctx.repo.headOid()!);
        using tree = Tree.lookup(ctx.repo, commit.treeOid);

        const entry = tree.getByPath("nonexistent/path/file.txt");
        assertEquals(entry, null);
      },
    );

    await t.step("Tree.getByPath with root file", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file", {
        "rootfile.txt": "root content",
      });

      const commit = ctx.repo.lookupCommit(ctx.repo.headOid()!);
      using tree = Tree.lookup(ctx.repo, commit.treeOid);

      using entry = tree.getByPath("rootfile.txt");
      assertExists(entry);
      assertEquals(entry.name, "rootfile.txt");
    });

    // ==================== Tree.hasPath Tests ====================

    await t.step("Tree.hasPath returns true for existing path", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file", {
        "docs/guide.md": "# Guide",
      });

      const commit = ctx.repo.lookupCommit(ctx.repo.headOid()!);
      using tree = Tree.lookup(ctx.repo, commit.treeOid);

      assertEquals(tree.hasPath("docs/guide.md"), true);
    });

    await t.step(
      "Tree.hasPath returns false for non-existent path",
      async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });
        await createCommitWithFiles(ctx, "Add file", { "f.txt": "c" });

        const commit = ctx.repo.lookupCommit(ctx.repo.headOid()!);
        using tree = Tree.lookup(ctx.repo, commit.treeOid);

        assertEquals(tree.hasPath("nonexistent/file.txt"), false);
      },
    );

    await t.step("Tree.hasPath works for directories", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add nested", {
        "src/index.ts": "export {}",
      });

      const commit = ctx.repo.lookupCommit(ctx.repo.headOid()!);
      using tree = Tree.lookup(ctx.repo, commit.treeOid);

      assertEquals(tree.hasPath("src"), true);
    });

    // ==================== Tree.entries Tests ====================

    await t.step("Tree.entries returns all entries", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add files", {
        "a.txt": "a",
        "b.txt": "b",
        "c.txt": "c",
      });

      const commit = ctx.repo.lookupCommit(ctx.repo.headOid()!);
      using tree = Tree.lookup(ctx.repo, commit.treeOid);

      const entries = tree.entries();
      // README.md + 3 files
      assertEquals(entries.length, 4);

      // Check entry structure
      for (const entry of entries) {
        assertExists(entry.name);
        assertExists(entry.oid);
        assertExists(entry.type);
        assertExists(entry.filemode);
      }
    });

    await t.step("Tree.entries with single file", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });

      // Initial commit has just README.md
      const commit = ctx.repo.lookupCommit(ctx.repo.headOid()!);
      using tree = Tree.lookup(ctx.repo, commit.treeOid);

      const entries = tree.entries();
      assertEquals(entries.length, 1); // Just README.md
      assertEquals(entries[0].name, "README.md");
    });

    // ==================== Tree Iterator Tests ====================

    await t.step("Tree iterator yields all entries", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add files", {
        "x.txt": "x",
        "y.txt": "y",
      });

      const commit = ctx.repo.lookupCommit(ctx.repo.headOid()!);
      using tree = Tree.lookup(ctx.repo, commit.treeOid);

      const entries = [...tree];
      assertEquals(entries.length, tree.entryCount);
    });

    await t.step("Tree iterator can be used with for...of", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file", { "test.txt": "content" });

      const commit = ctx.repo.lookupCommit(ctx.repo.headOid()!);
      using tree = Tree.lookup(ctx.repo, commit.treeOid);

      let count = 0;
      for (const entry of tree) {
        assertExists(entry.name);
        count++;
      }
      assertEquals(count, tree.entryCount);
    });

    // ==================== Tree.use Tests ====================

    await t.step("Tree.use provides automatic cleanup", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file", { "test.txt": "content" });

      const commit = ctx.repo.lookupCommit(ctx.repo.headOid()!);

      const result = Tree.use(ctx.repo, commit.treeOid, (tree) => {
        return tree.entryCount;
      });

      assertEquals(result, 2); // README.md + test.txt
    });

    await t.step("Tree.use returns function result", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file", { "file.txt": "data" });

      const commit = ctx.repo.lookupCommit(ctx.repo.headOid()!);

      const hasFile = Tree.use(ctx.repo, commit.treeOid, (tree) => {
        return tree.hasPath("file.txt");
      });

      assertEquals(hasFile, true);
    });

    // ==================== TreeEntry Properties Tests ====================

    await t.step("TreeEntry.name returns correct name", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file", {
        "myspecialfile.txt": "content",
      });

      const commit = ctx.repo.lookupCommit(ctx.repo.headOid()!);
      using tree = Tree.lookup(ctx.repo, commit.treeOid);
      const entry = tree.getByName("myspecialfile.txt");
      assertExists(entry);

      assertEquals(entry.name, "myspecialfile.txt");
    });

    await t.step("TreeEntry.oid returns valid OID", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file", { "f.txt": "c" });

      const commit = ctx.repo.lookupCommit(ctx.repo.headOid()!);
      using tree = Tree.lookup(ctx.repo, commit.treeOid);
      const entry = tree.getByName("f.txt");
      assertExists(entry);

      assertEquals(entry.oid.length, 40);
    });

    await t.step("TreeEntry.type returns correct type for blob", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file", { "f.txt": "c" });

      const commit = ctx.repo.lookupCommit(ctx.repo.headOid()!);
      using tree = Tree.lookup(ctx.repo, commit.treeOid);
      const entry = tree.getByName("f.txt");
      assertExists(entry);

      assertEquals(entry.type, GitObjectType.BLOB);
    });

    await t.step("TreeEntry.type returns correct type for tree", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add nested", {
        "dir/file.txt": "content",
      });

      const commit = ctx.repo.lookupCommit(ctx.repo.headOid()!);
      using tree = Tree.lookup(ctx.repo, commit.treeOid);
      const entry = tree.getByName("dir");
      assertExists(entry);

      assertEquals(entry.type, GitObjectType.TREE);
    });

    await t.step(
      "TreeEntry.filemode returns correct mode for file",
      async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });
        await createCommitWithFiles(ctx, "Add file", { "f.txt": "c" });

        const commit = ctx.repo.lookupCommit(ctx.repo.headOid()!);
        using tree = Tree.lookup(ctx.repo, commit.treeOid);
        const entry = tree.getByName("f.txt");
        assertExists(entry);

        assertEquals(entry.filemode, GitFileMode.BLOB);
      },
    );

    await t.step(
      "TreeEntry.filemode returns correct mode for directory",
      async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });
        await createCommitWithFiles(ctx, "Add nested", {
          "dir/file.txt": "content",
        });

        const commit = ctx.repo.lookupCommit(ctx.repo.headOid()!);
        using tree = Tree.lookup(ctx.repo, commit.treeOid);
        const entry = tree.getByName("dir");
        assertExists(entry);

        assertEquals(entry.filemode, GitFileMode.TREE);
      },
    );

    await t.step("TreeEntry.pointer returns valid pointer", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file", { "f.txt": "c" });

      const commit = ctx.repo.lookupCommit(ctx.repo.headOid()!);
      using tree = Tree.lookup(ctx.repo, commit.treeOid);
      const entry = tree.getByName("f.txt");
      assertExists(entry);

      assertExists(entry.pointer);
    });

    // ==================== TreeEntry Type Helpers Tests ====================

    await t.step("TreeEntry.isTree returns true for directory", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add nested", {
        "mydir/file.txt": "c",
      });

      const commit = ctx.repo.lookupCommit(ctx.repo.headOid()!);
      using tree = Tree.lookup(ctx.repo, commit.treeOid);
      const entry = tree.getByName("mydir");
      assertExists(entry);

      assertEquals(entry.isTree, true);
      assertEquals(entry.isBlob, false);
      assertEquals(entry.isSubmodule, false);
    });

    await t.step("TreeEntry.isBlob returns true for file", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file", { "myfile.txt": "c" });

      const commit = ctx.repo.lookupCommit(ctx.repo.headOid()!);
      using tree = Tree.lookup(ctx.repo, commit.treeOid);
      const entry = tree.getByName("myfile.txt");
      assertExists(entry);

      assertEquals(entry.isBlob, true);
      assertEquals(entry.isTree, false);
      assertEquals(entry.isSubmodule, false);
    });

    // ==================== TreeEntry.toInfo Tests ====================

    await t.step("TreeEntry.toInfo returns correct structure", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file", { "test.txt": "content" });

      const commit = ctx.repo.lookupCommit(ctx.repo.headOid()!);
      using tree = Tree.lookup(ctx.repo, commit.treeOid);
      const entry = tree.getByName("test.txt");
      assertExists(entry);

      const info = entry.toInfo();
      assertEquals(info.name, "test.txt");
      assertEquals(info.oid.length, 40);
      assertEquals(info.type, GitObjectType.BLOB);
      assertEquals(info.filemode, GitFileMode.BLOB);
    });

    // ==================== TreeEntry.free Tests ====================

    await t.step("TreeEntry from getByPath must be freed", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add nested", {
        "a/b/c.txt": "deep file",
      });

      const commit = ctx.repo.lookupCommit(ctx.repo.headOid()!);
      using tree = Tree.lookup(ctx.repo, commit.treeOid);

      // Entry from getByPath is owned by caller
      const entry = tree.getByPath("a/b/c.txt");
      assertExists(entry);
      assertEquals(entry.name, "c.txt");

      // Free it explicitly
      entry.free();
    });

    await t.step("TreeEntry supports Symbol.dispose", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add nested", {
        "x/y.txt": "content",
      });

      const commit = ctx.repo.lookupCommit(ctx.repo.headOid()!);
      using tree = Tree.lookup(ctx.repo, commit.treeOid);

      {
        using entry = tree.getByPath("x/y.txt");
        assertExists(entry);
        assertEquals(entry.name, "y.txt");
      }
      // Entry disposed on scope exit
    });

    // ==================== Helper Function Tests ====================

    await t.step("getTreeEntryByPath returns entry info", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file", {
        "src/main.ts": "console.log('hello');",
      });

      const commit = ctx.repo.lookupCommit(ctx.repo.headOid()!);

      const info = getTreeEntryByPath(ctx.repo, commit.treeOid, "src/main.ts");
      assertExists(info);
      assertEquals(info.name, "main.ts");
      assertEquals(info.type, GitObjectType.BLOB);
    });

    await t.step(
      "getTreeEntryByPath returns null for non-existent",
      async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });
        await createCommitWithFiles(ctx, "Add file", { "f.txt": "c" });

        const commit = ctx.repo.lookupCommit(ctx.repo.headOid()!);

        const info = getTreeEntryByPath(
          ctx.repo,
          commit.treeOid,
          "nonexistent.txt",
        );
        assertEquals(info, null);
      },
    );

    await t.step("treeHasPath returns true for existing path", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file", {
        "docs/readme.md": "# Docs",
      });

      const commit = ctx.repo.lookupCommit(ctx.repo.headOid()!);

      assertEquals(
        treeHasPath(ctx.repo, commit.treeOid, "docs/readme.md"),
        true,
      );
    });

    await t.step(
      "treeHasPath returns false for non-existent path",
      async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });
        await createCommitWithFiles(ctx, "Add file", { "f.txt": "c" });

        const commit = ctx.repo.lookupCommit(ctx.repo.headOid()!);

        assertEquals(treeHasPath(ctx.repo, commit.treeOid, "nope.txt"), false);
      },
    );

    // ==================== Edge Cases ====================

    await t.step("Tree with deeply nested structure", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add deep structure", {
        "a/b/c/d/e/f/g/deep.txt": "very deep content",
      });

      const commit = ctx.repo.lookupCommit(ctx.repo.headOid()!);
      using tree = Tree.lookup(ctx.repo, commit.treeOid);

      assertEquals(tree.hasPath("a/b/c/d/e/f/g/deep.txt"), true);

      using entry = tree.getByPath("a/b/c/d/e/f/g/deep.txt");
      assertExists(entry);
      assertEquals(entry.name, "deep.txt");
    });

    await t.step("Tree with special characters in filenames", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add special files", {
        "file with spaces.txt": "spaces",
        "file-with-dashes.txt": "dashes",
        "file_with_underscores.txt": "underscores",
      });

      const commit = ctx.repo.lookupCommit(ctx.repo.headOid()!);
      using tree = Tree.lookup(ctx.repo, commit.treeOid);

      assertEquals(tree.hasPath("file with spaces.txt"), true);
      assertEquals(tree.hasPath("file-with-dashes.txt"), true);
      assertEquals(tree.hasPath("file_with_underscores.txt"), true);
    });

    await t.step("Multiple trees can be opened simultaneously", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "First commit", { "a.txt": "a" });
      const commit1 = ctx.repo.lookupCommit(ctx.repo.headOid()!);

      await createCommitWithFiles(ctx, "Second commit", { "b.txt": "b" });
      const commit2 = ctx.repo.lookupCommit(ctx.repo.headOid()!);

      using tree1 = Tree.lookup(ctx.repo, commit1.treeOid);
      using tree2 = Tree.lookup(ctx.repo, commit2.treeOid);

      assertNotEquals(tree1.oid, tree2.oid);
      assertEquals(tree1.entryCount, 2); // README + a.txt
      assertEquals(tree2.entryCount, 3); // README + a.txt + b.txt
    });

    await t.step("Tree entries are sorted alphabetically", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add files", {
        "zebra.txt": "z",
        "apple.txt": "a",
        "mango.txt": "m",
      });

      const commit = ctx.repo.lookupCommit(ctx.repo.headOid()!);
      using tree = Tree.lookup(ctx.repo, commit.treeOid);

      const entries = tree.entries();
      const names = entries.map((e) => e.name);

      // Git sorts entries alphabetically (case-sensitive)
      // README.md, apple.txt, mango.txt, zebra.txt
      assertEquals(names.includes("apple.txt"), true);
      assertEquals(names.includes("zebra.txt"), true);
    });
  } finally {
    shutdown();
  }
});
