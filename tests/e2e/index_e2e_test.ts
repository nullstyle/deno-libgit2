/**
 * End-to-end tests for Index (Staging Area) operations
 *
 * These tests validate index manipulation, staging, unstaging,
 * and tree writing using real git repositories in temporary directories.
 */

import { createFile, createTestContext, setupLibrary } from "./helpers.ts";
import { Index, Repository } from "../../mod.ts";
import {
  assertEquals,
  assertExists,
  assertFalse,
  assertThrows,
} from "@std/assert";
import { GitError } from "../../src/error.ts";

Deno.test({
  name: "E2E Index Tests",
  async fn(t) {
    using _git = await setupLibrary();

    await t.step("New repository has empty index", async () => {
      await using ctx = await createTestContext();
      using index = Index.fromRepository(ctx.repo);
      assertEquals(index.entryCount, 0, "New index should be empty");
      assertFalse(index.hasConflicts, "New index should have no conflicts");
    });

    await t.step("Add file to index", async () => {
      await using ctx = await createTestContext();
      await createFile(ctx.repoPath, "test.txt", "test content");

      using index = Index.fromRepository(ctx.repo);
      index.add("test.txt");
      index.write();

      assertEquals(index.entryCount, 1, "Index should have one entry");
    });

    await t.step("Add multiple files to index", async () => {
      await using ctx = await createTestContext();
      await createFile(ctx.repoPath, "file1.txt", "content 1");
      await createFile(ctx.repoPath, "file2.txt", "content 2");
      await createFile(ctx.repoPath, "src/file3.txt", "content 3");

      using index = Index.fromRepository(ctx.repo);
      index.add("file1.txt");
      index.add("file2.txt");
      index.add("src/file3.txt");
      index.write();

      assertEquals(index.entryCount, 3, "Index should have three entries");
    });

    await t.step("addAll() adds multiple files at once", async () => {
      await using ctx = await createTestContext();
      await createFile(ctx.repoPath, "a.txt", "a");
      await createFile(ctx.repoPath, "b.txt", "b");
      await createFile(ctx.repoPath, "c.txt", "c");

      using index = Index.fromRepository(ctx.repo);
      index.addAll(["a.txt", "b.txt", "c.txt"]);
      index.write();

      assertEquals(index.entryCount, 3, "Index should have three entries");
    });

    await t.step("Remove file from index", async () => {
      await using ctx = await createTestContext();
      await createFile(ctx.repoPath, "keep.txt", "keep");
      await createFile(ctx.repoPath, "remove.txt", "remove");

      using index = Index.fromRepository(ctx.repo);
      index.add("keep.txt");
      index.add("remove.txt");
      index.write();

      assertEquals(index.entryCount, 2);

      index.remove("remove.txt");
      index.write();

      assertEquals(
        index.entryCount,
        1,
        "Index should have one entry after removal",
      );
    });

    await t.step("Index writeTree creates tree object", async () => {
      await using ctx = await createTestContext();
      await createFile(ctx.repoPath, "test.txt", "content");

      using index = Index.fromRepository(ctx.repo);
      index.add("test.txt");
      index.write();

      const treeOid = index.writeTree();
      assertExists(treeOid);
      assertEquals(treeOid.length, 40, "Tree OID should be 40 characters");
    });

    await t.step(
      "Index writeTreeTo writes to specific repository",
      async () => {
        await using ctx = await createTestContext();
        await createFile(ctx.repoPath, "test.txt", "content");

        using index = Index.fromRepository(ctx.repo);
        index.add("test.txt");
        index.write();

        const treeOid = index.writeTreeTo(ctx.repo);
        assertExists(treeOid);
        assertEquals(treeOid.length, 40, "Tree OID should be 40 characters");
      },
    );

    await t.step("Index persists after close and reopen", async () => {
      await using ctx = await createTestContext();
      await createFile(ctx.repoPath, "persistent.txt", "content");

      {
        using index = Index.fromRepository(ctx.repo);
        index.add("persistent.txt");
        index.write();
      }

      // Close and reopen repository
      ctx.repo.close();
      ctx.repo = Repository.open(ctx.repoPath);

      using index = Index.fromRepository(ctx.repo);
      assertEquals(index.entryCount, 1, "Index should persist");
    });

    await t.step("Index handles nested directories", async () => {
      await using ctx = await createTestContext();
      await createFile(ctx.repoPath, "a/b/c/d/deep.txt", "deep content");
      await createFile(ctx.repoPath, "a/b/shallow.txt", "shallow content");

      using index = Index.fromRepository(ctx.repo);
      index.add("a/b/c/d/deep.txt");
      index.add("a/b/shallow.txt");
      index.write();

      assertEquals(index.entryCount, 2);

      const treeOid = index.writeTree();
      assertExists(treeOid);
    });

    await t.step("Index handles special characters in filenames", async () => {
      await using ctx = await createTestContext();
      await createFile(ctx.repoPath, "file-with-dashes.txt", "content");
      await createFile(ctx.repoPath, "file_with_underscores.txt", "content");
      await createFile(ctx.repoPath, "file.multiple.dots.txt", "content");

      using index = Index.fromRepository(ctx.repo);
      index.add("file-with-dashes.txt");
      index.add("file_with_underscores.txt");
      index.add("file.multiple.dots.txt");
      index.write();

      assertEquals(index.entryCount, 3);
    });

    await t.step("getByIndex returns entry at given position", async () => {
      await using ctx = await createTestContext();
      await createFile(ctx.repoPath, "alpha.txt", "alpha");
      await createFile(ctx.repoPath, "beta.txt", "beta");

      using index = Index.fromRepository(ctx.repo);
      index.add("alpha.txt");
      index.add("beta.txt");
      index.write();

      const entry = index.getByIndex(0);
      assertExists(entry, "Entry should exist at index 0");
      assertExists(entry.path, "Entry should have a path");
      assertExists(entry.oid, "Entry should have an OID");
      assertEquals(entry.oid.length, 40, "OID should be 40 hex characters");
    });

    await t.step("getByIndex returns null for invalid index", async () => {
      await using ctx = await createTestContext();
      using index = Index.fromRepository(ctx.repo);

      const entry = index.getByIndex(999);
      assertEquals(entry, null, "Should return null for invalid index");
    });

    await t.step("getByPath returns entry for given path", async () => {
      await using ctx = await createTestContext();
      await createFile(ctx.repoPath, "lookup.txt", "lookup content");

      using index = Index.fromRepository(ctx.repo);
      index.add("lookup.txt");
      index.write();

      const entry = index.getByPath("lookup.txt");
      assertExists(entry, "Entry should exist");
      assertEquals(entry.path, "lookup.txt", "Path should match");
      assertEquals(entry.stage, 0, "Stage should be 0 for normal entries");
    });

    await t.step("getByPath returns null for non-existent path", async () => {
      await using ctx = await createTestContext();
      await createFile(ctx.repoPath, "exists.txt", "content");

      using index = Index.fromRepository(ctx.repo);
      index.add("exists.txt");
      index.write();

      const entry = index.getByPath("does-not-exist.txt");
      assertEquals(entry, null, "Should return null for non-existent path");
    });

    await t.step("entries() returns all index entries", async () => {
      await using ctx = await createTestContext();
      await createFile(ctx.repoPath, "one.txt", "1");
      await createFile(ctx.repoPath, "two.txt", "2");
      await createFile(ctx.repoPath, "three.txt", "3");

      using index = Index.fromRepository(ctx.repo);
      index.add("one.txt");
      index.add("two.txt");
      index.add("three.txt");
      index.write();

      const entries = index.entries();
      assertEquals(entries.length, 3, "Should return all entries");

      const paths = entries.map((e) => e.path).sort();
      assertEquals(paths, ["one.txt", "three.txt", "two.txt"]);
    });

    await t.step("Index iteration works with for...of", async () => {
      await using ctx = await createTestContext();
      await createFile(ctx.repoPath, "a.txt", "a");
      await createFile(ctx.repoPath, "b.txt", "b");
      await createFile(ctx.repoPath, "c.txt", "c");

      using index = Index.fromRepository(ctx.repo);
      index.add("a.txt");
      index.add("b.txt");
      index.add("c.txt");
      index.write();

      const paths: string[] = [];
      for (const entry of index) {
        paths.push(entry.path);
      }

      assertEquals(paths.length, 3, "Should iterate over all entries");
    });

    await t.step("read() refreshes index from disk", async () => {
      await using ctx = await createTestContext();
      await createFile(ctx.repoPath, "initial.txt", "initial");

      using index = Index.fromRepository(ctx.repo);
      index.add("initial.txt");
      index.write();

      assertEquals(index.entryCount, 1);

      // Simulate external changes by using another index instance
      {
        using index2 = Index.fromRepository(ctx.repo);
        await createFile(ctx.repoPath, "external.txt", "external");
        index2.add("external.txt");
        index2.write();
      }

      // Read should pick up external changes
      index.read(true);
      assertEquals(
        index.entryCount,
        2,
        "Index should have 2 entries after read",
      );
    });

    await t.step("Index.use provides automatic cleanup", async () => {
      await using ctx = await createTestContext();
      await createFile(ctx.repoPath, "auto.txt", "auto content");

      const entryCount = Index.use(ctx.repo, (index) => {
        index.add("auto.txt");
        index.write();
        return index.entryCount;
      });

      assertEquals(entryCount, 1);
    });

    await t.step("Index.open opens index file directly", async () => {
      await using ctx = await createTestContext();
      await createFile(ctx.repoPath, "test.txt", "content");

      // Add a file via repository index
      {
        using index = Index.fromRepository(ctx.repo);
        index.add("test.txt");
        index.write();
      }

      // Open index file directly
      const indexPath = `${ctx.repoPath}/.git/index`;
      using index = Index.open(indexPath);

      assertEquals(index.entryCount, 1, "Direct open should show same entries");
    });

    await t.step("isClosed property reflects index state", async () => {
      await using ctx = await createTestContext();
      const index = Index.fromRepository(ctx.repo);

      assertFalse(index.isClosed, "Index should not be closed initially");

      index.close();
      assertEquals(
        index.isClosed,
        true,
        "Index should be closed after close()",
      );
    });

    await t.step("free() is alias for close()", async () => {
      await using ctx = await createTestContext();
      const index = Index.fromRepository(ctx.repo);

      assertFalse(index.isClosed);
      index.free();
      assertEquals(index.isClosed, true, "free() should close the index");
    });

    await t.step("Operations on closed index throw error", async () => {
      await using ctx = await createTestContext();
      const index = Index.fromRepository(ctx.repo);
      index.close();

      assertThrows(
        () => index.entryCount,
        GitError,
        "closed",
      );

      assertThrows(
        () => index.write(),
        GitError,
        "closed",
      );
    });

    await t.step("pointer property returns raw pointer", async () => {
      await using ctx = await createTestContext();
      using index = Index.fromRepository(ctx.repo);

      const ptr = index.pointer;
      assertExists(ptr, "Pointer should not be null");
    });

    await t.step("pointer property throws when index is closed", async () => {
      await using ctx = await createTestContext();
      const index = Index.fromRepository(ctx.repo);
      index.close();

      assertThrows(
        () => index.pointer,
        GitError,
        "closed",
      );
    });

    await t.step("Index constructor throws on null pointer", () => {
      assertThrows(
        () => new Index(null),
        GitError,
        "Invalid",
      );
    });

    await t.step("close() is idempotent", async () => {
      await using ctx = await createTestContext();
      const index = Index.fromRepository(ctx.repo);

      index.close();
      index.close(); // Should not throw
      index.close(); // Should not throw

      assertEquals(index.isClosed, true);
    });

    await t.step("read() with force=true re-reads from disk", async () => {
      await using ctx = await createTestContext();
      await createFile(ctx.repoPath, "file.txt", "content");

      using index = Index.fromRepository(ctx.repo);
      index.add("file.txt");
      index.write();

      // Force read even if up to date
      index.read(true);
      assertEquals(index.entryCount, 1);
    });

    await t.step("read() with force=false (default)", async () => {
      await using ctx = await createTestContext();
      await createFile(ctx.repoPath, "file.txt", "content");

      using index = Index.fromRepository(ctx.repo);
      index.add("file.txt");
      index.write();

      // Default read (force=false)
      index.read();
      assertEquals(index.entryCount, 1);
    });

    await t.step("Symbol.dispose works correctly", async () => {
      await using ctx = await createTestContext();
      await createFile(ctx.repoPath, "dispose.txt", "content");

      {
        using index = Index.fromRepository(ctx.repo);
        index.add("dispose.txt");
        index.write();
        assertEquals(index.entryCount, 1);
      }
      // index is automatically disposed here
    });

    await t.step("getByIndex returns entry with all properties", async () => {
      await using ctx = await createTestContext();
      await createFile(ctx.repoPath, "props.txt", "content with data");

      using index = Index.fromRepository(ctx.repo);
      index.add("props.txt");
      index.write();

      const entry = index.getByIndex(0);
      assertExists(entry);
      assertEquals(entry.path, "props.txt");
      assertEquals(entry.oid.length, 40);
      assertEquals(typeof entry.mode, "number");
      assertEquals(typeof entry.fileSize, "number");
      assertEquals(entry.stage, 0);
    });

    await t.step("entries() returns empty array for empty index", async () => {
      await using ctx = await createTestContext();
      using index = Index.fromRepository(ctx.repo);

      const entries = index.entries();
      assertEquals(entries.length, 0);
    });

    await t.step("Index iteration on empty index", async () => {
      await using ctx = await createTestContext();
      using index = Index.fromRepository(ctx.repo);

      const paths: string[] = [];
      for (const entry of index) {
        paths.push(entry.path);
      }
      assertEquals(paths.length, 0);
    });

    await t.step("hasConflicts returns false for clean index", async () => {
      await using ctx = await createTestContext();
      await createFile(ctx.repoPath, "clean.txt", "content");

      using index = Index.fromRepository(ctx.repo);
      index.add("clean.txt");
      index.write();

      assertFalse(index.hasConflicts);
    });

    await t.step("Index entry has correct properties", async () => {
      await using ctx = await createTestContext();
      await createFile(ctx.repoPath, "test.txt", "test content here");

      using index = Index.fromRepository(ctx.repo);
      index.add("test.txt");
      index.write();

      const entry = index.getByIndex(0);
      assertExists(entry);

      assertEquals(entry.path, "test.txt");
      assertEquals(entry.oid.length, 40);
      assertEquals(entry.stage, 0);
      assertEquals(typeof entry.mode, "number");
      assertEquals(typeof entry.fileSize, "number");
    });

    await t.step("Empty entries() returns empty array", async () => {
      await using ctx = await createTestContext();
      using index = Index.fromRepository(ctx.repo);

      const entries = index.entries();
      assertEquals(entries, []);
    });

    await t.step("Updating staged file updates index entry", async () => {
      await using ctx = await createTestContext();
      await createFile(ctx.repoPath, "update.txt", "initial");

      using index = Index.fromRepository(ctx.repo);
      index.add("update.txt");
      index.write();

      const entry1 = index.getByIndex(0);
      assertExists(entry1);
      const oid1 = entry1.oid;

      // Update the file
      await createFile(ctx.repoPath, "update.txt", "modified content");
      index.add("update.txt");
      index.write();

      const entry2 = index.getByIndex(0);
      assertExists(entry2);
      const oid2 = entry2.oid;

      // OIDs should be different after modification
      assertEquals(entry2.path, "update.txt");
      assertFalse(oid1 === oid2, "OID should change after file modification");
    });

    await t.step("Index handles binary files", async () => {
      await using ctx = await createTestContext();
      // Write binary content
      const binaryContent = new Uint8Array([0x00, 0x01, 0x02, 0xFF, 0xFE]);
      await Deno.writeFile(`${ctx.repoPath}/binary.bin`, binaryContent);

      using index = Index.fromRepository(ctx.repo);
      index.add("binary.bin");
      index.write();

      assertEquals(index.entryCount, 1);
      const entry = index.getByIndex(0);
      assertExists(entry);
      assertEquals(entry.path, "binary.bin");
    });

    await t.step("Index handles large number of files", async () => {
      await using ctx = await createTestContext();

      const fileCount = 50;
      for (let i = 0; i < fileCount; i++) {
        await createFile(
          ctx.repoPath,
          `file${i.toString().padStart(3, "0")}.txt`,
          `content ${i}`,
        );
      }

      using index = Index.fromRepository(ctx.repo);
      for (let i = 0; i < fileCount; i++) {
        index.add(`file${i.toString().padStart(3, "0")}.txt`);
      }
      index.write();

      assertEquals(index.entryCount, fileCount);

      const entries = index.entries();
      assertEquals(entries.length, fileCount);
    });

    await t.step("Symbol.dispose works for automatic cleanup", async () => {
      await using ctx = await createTestContext();
      await createFile(ctx.repoPath, "dispose.txt", "content");

      {
        using index = Index.fromRepository(ctx.repo);
        index.add("dispose.txt");
        index.write();
        assertEquals(index.isClosed, false);
      }
      // Index should be disposed after leaving the block
    });

    await t.step("hasConflicts is false for clean index", async () => {
      await using ctx = await createTestContext();
      await createFile(ctx.repoPath, "clean.txt", "clean");

      using index = Index.fromRepository(ctx.repo);
      index.add("clean.txt");
      index.write();

      assertFalse(index.hasConflicts);
    });
  },
});
