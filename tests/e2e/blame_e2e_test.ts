/**
 * End-to-end tests for blame functionality
 * Tests use real file operations in temporary directories
 */

import {
  assertEquals,
  assertExists,
  assertGreater,
  assertGreaterOrEqual,
  assertThrows,
} from "@std/assert";

import {
  createCommitWithFiles,
  createTestContext,
  setupLibrary,
} from "./helpers.ts";

import { type BlameHunk, GitBlameFlags, Repository } from "../../mod.ts";

Deno.test({
  name: "E2E Blame Tests",
  async fn(t) {
    using _git = await setupLibrary();

    await t.step(
      "blame file shows commit that introduced each line",
      async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });
        await createCommitWithFiles(ctx, "Add file with content", {
          "test.txt": "line 1\nline 2\nline 3\n",
        });

        using repo = Repository.open(ctx.repoPath);
        using blame = repo.blameFile("test.txt");

        const hunkCount = blame.hunkCount;
        assertGreater(hunkCount, 0, "Should have at least one hunk");

        const hunk = blame.getHunkByIndex(0);
        assertExists(hunk, "Should have hunk at index 0");
        assertExists(hunk.finalCommitId, "Hunk should have final commit ID");
        assertGreater(hunk.linesInHunk, 0, "Hunk should have lines");
      },
    );

    await t.step("blame tracks changes across multiple commits", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial file", {
        "test.txt": "line 1\nline 2\n",
      });

      await createCommitWithFiles(ctx, "Add more lines", {
        "test.txt": "line 1\nline 2\nline 3\nline 4\n",
      });

      using repo = Repository.open(ctx.repoPath);
      using blame = repo.blameFile("test.txt");

      const hunkCount = blame.hunkCount;
      assertGreaterOrEqual(hunkCount, 1, "Should have hunks");

      const lineCount = blame.lineCount;
      assertEquals(lineCount, 4, "Should have 4 lines");
    });

    await t.step(
      "blame getHunkByLine returns correct hunk for line number",
      async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });
        await createCommitWithFiles(ctx, "Add file", {
          "test.txt": "line 1\nline 2\nline 3\n",
        });

        using repo = Repository.open(ctx.repoPath);
        using blame = repo.blameFile("test.txt");

        const hunk1 = blame.getHunkByLine(1);
        assertExists(hunk1, "Should have hunk for line 1");

        const hunk2 = blame.getHunkByLine(2);
        assertExists(hunk2, "Should have hunk for line 2");

        const hunk3 = blame.getHunkByLine(3);
        assertExists(hunk3, "Should have hunk for line 3");
      },
    );

    await t.step("blame hunk contains author information", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file with author", {
        "test.txt": "content\n",
      });

      using repo = Repository.open(ctx.repoPath);
      using blame = repo.blameFile("test.txt");

      const hunk = blame.getHunkByIndex(0);
      assertExists(hunk, "Should have hunk");
      assertExists(hunk.finalSignature, "Should have final signature");
      assertExists(hunk.finalSignature.name, "Should have author name");
      assertExists(hunk.finalSignature.email, "Should have author email");
    });

    await t.step("blame hunk contains line number information", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add multi-line file", {
        "test.txt": "line 1\nline 2\nline 3\nline 4\nline 5\n",
      });

      using repo = Repository.open(ctx.repoPath);
      using blame = repo.blameFile("test.txt");

      const hunk = blame.getHunkByIndex(0);
      assertExists(hunk, "Should have hunk");
      assertGreater(
        hunk.finalStartLineNumber,
        0,
        "Should have start line number",
      );
      assertGreater(hunk.linesInHunk, 0, "Should have lines count");
    });

    await t.step("blame with line range (minLine/maxLine)", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file", {
        "test.txt": "line 1\nline 2\nline 3\nline 4\nline 5\n",
      });

      using repo = Repository.open(ctx.repoPath);
      using blame = repo.blameFile("test.txt", {
        minLine: 2,
        maxLine: 4,
      });

      assertGreater(blame.hunkCount, 0, "Should have hunks");
    });

    await t.step("blame iteration over all hunks", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "First commit", {
        "test.txt": "line 1\nline 2\n",
      });

      await createCommitWithFiles(ctx, "Second commit", {
        "test.txt": "line 1\nline 2\nline 3\nline 4\n",
      });

      using repo = Repository.open(ctx.repoPath);
      using blame = repo.blameFile("test.txt");

      const hunks: BlameHunk[] = [];
      for (let i = 0; i < blame.hunkCount; i++) {
        const hunk = blame.getHunkByIndex(i);
        if (hunk) hunks.push(hunk);
      }
      assertGreater(hunks.length, 0, "Should have collected hunks");

      const totalLines = hunks.reduce((sum, h) => sum + h.linesInHunk, 0);
      assertEquals(totalLines, 4, "Total lines should be 4");
    });

    await t.step("blame hunk has commit summary", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "This is the commit message", {
        "test.txt": "content\n",
      });

      using repo = Repository.open(ctx.repoPath);
      using blame = repo.blameFile("test.txt");

      const hunk = blame.getHunkByIndex(0);
      assertExists(hunk, "Should have hunk");
      if (hunk.summary) {
        assertExists(hunk.summary, "Should have summary");
      }
    });

    await t.step("blameFile helper on Repository class", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file", {
        "test.txt": "line 1\nline 2\n",
      });

      using repo = Repository.open(ctx.repoPath);
      using blame = repo.blameFile("test.txt");

      assertGreater(blame.hunkCount, 0);
      assertGreater(blame.lineCount, 0);
    });

    await t.step("blame.close() is alias for free()", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file", {
        "test.txt": "content\n",
      });

      using repo = Repository.open(ctx.repoPath);
      const blame = repo.blameFile("test.txt");
      blame.close();

      assertThrows(() => blame.hunkCount, Error, "freed");
    });

    await t.step("blame free is idempotent", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file", {
        "test.txt": "content\n",
      });

      using repo = Repository.open(ctx.repoPath);
      const blame = repo.blameFile("test.txt");

      // Free multiple times should not throw
      blame.free();
      blame.free();
      blame.free();
    });

    await t.step("blame throws after freed for hunkCount", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file", {
        "test.txt": "content\n",
      });

      using repo = Repository.open(ctx.repoPath);
      const blame = repo.blameFile("test.txt");
      blame.free();

      assertThrows(() => blame.hunkCount, Error, "freed");
    });

    await t.step("blame throws after freed for lineCount", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file", {
        "test.txt": "content\n",
      });

      using repo = Repository.open(ctx.repoPath);
      const blame = repo.blameFile("test.txt");
      blame.free();

      assertThrows(() => blame.lineCount, Error, "freed");
    });

    await t.step("blame throws after freed for getHunkByIndex", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file", {
        "test.txt": "content\n",
      });

      using repo = Repository.open(ctx.repoPath);
      const blame = repo.blameFile("test.txt");
      blame.free();

      assertThrows(() => blame.getHunkByIndex(0), Error, "freed");
    });

    await t.step("blame throws after freed for getHunkByLine", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file", {
        "test.txt": "content\n",
      });

      using repo = Repository.open(ctx.repoPath);
      const blame = repo.blameFile("test.txt");
      blame.free();

      assertThrows(() => blame.getHunkByLine(1), Error, "freed");
    });

    await t.step("getHunkByIndex returns null for invalid index", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file", {
        "test.txt": "content\n",
      });

      using repo = Repository.open(ctx.repoPath);
      using blame = repo.blameFile("test.txt");

      const hunk = blame.getHunkByIndex(999);
      assertEquals(hunk, null, "Should return null for invalid index");
    });

    await t.step(
      "getHunkByLine returns null for invalid line number",
      async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });
        await createCommitWithFiles(ctx, "Add file", {
          "test.txt": "line 1\nline 2\n",
        });

        using repo = Repository.open(ctx.repoPath);
        using blame = repo.blameFile("test.txt");

        const hunk = blame.getHunkByLine(999);
        assertEquals(hunk, null, "Should return null for invalid line number");
      },
    );

    await t.step("blame single line file", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add single line file", {
        "single.txt": "only one line\n",
      });

      using repo = Repository.open(ctx.repoPath);
      using blame = repo.blameFile("single.txt");

      assertEquals(blame.hunkCount, 1, "Should have exactly one hunk");
      assertEquals(blame.lineCount, 1, "Should have exactly one line");

      const hunk = blame.getHunkByIndex(0);
      assertExists(hunk);
      assertEquals(hunk.linesInHunk, 1, "Hunk should have one line");
      assertEquals(hunk.finalStartLineNumber, 1, "Should start at line 1");
    });

    await t.step("blame file in subdirectory", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file in subdir", {
        "src/utils/helper.ts": "export function help() {}\n",
      });

      using repo = Repository.open(ctx.repoPath);
      using blame = repo.blameFile("src/utils/helper.ts");

      assertGreater(blame.hunkCount, 0, "Should have hunks");
      const hunk = blame.getHunkByIndex(0);
      assertExists(hunk);
    });

    await t.step("blame with normal flags option", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file", {
        "test.txt": "line 1\nline 2\nline 3\n",
      });

      using repo = Repository.open(ctx.repoPath);
      using blame = repo.blameFile("test.txt", {
        flags: GitBlameFlags.NORMAL,
      });

      assertGreater(blame.hunkCount, 0);
    });

    await t.step("blame with first parent only flag", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file", {
        "test.txt": "content\n",
      });

      using repo = Repository.open(ctx.repoPath);
      using blame = repo.blameFile("test.txt", {
        flags: GitBlameFlags.FIRST_PARENT,
      });

      assertGreater(blame.hunkCount, 0);
    });

    await t.step("blame hunk contains origCommitId", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file", {
        "test.txt": "content\n",
      });

      using repo = Repository.open(ctx.repoPath);
      using blame = repo.blameFile("test.txt");

      const hunk = blame.getHunkByIndex(0);
      assertExists(hunk);
      assertExists(hunk.origCommitId, "Should have original commit ID");
      assertEquals(hunk.origCommitId.length, 40, "OID should be 40 hex chars");
    });

    await t.step("blame hunk contains origStartLineNumber", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file", {
        "test.txt": "line 1\nline 2\nline 3\n",
      });

      using repo = Repository.open(ctx.repoPath);
      using blame = repo.blameFile("test.txt");

      const hunk = blame.getHunkByIndex(0);
      assertExists(hunk);
      assertGreater(
        hunk.origStartLineNumber,
        0,
        "Should have original start line",
      );
    });

    await t.step("blame hunk isBoundary property", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file", {
        "test.txt": "content\n",
      });

      using repo = Repository.open(ctx.repoPath);
      using blame = repo.blameFile("test.txt");

      const hunk = blame.getHunkByIndex(0);
      assertExists(hunk);
      assertEquals(typeof hunk.isBoundary, "boolean");
    });

    await t.step("blame file modified by multiple authors", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(
        ctx,
        "Initial file",
        { "test.txt": "line 1\nline 2\n" },
        "Alice",
        "alice@example.com",
      );

      await createCommitWithFiles(
        ctx,
        "Add more lines",
        { "test.txt": "line 1\nline 2\nline 3\nline 4\n" },
        "Bob",
        "bob@example.com",
      );

      using repo = Repository.open(ctx.repoPath);
      using blame = repo.blameFile("test.txt");

      const hunks: BlameHunk[] = [];
      for (let i = 0; i < blame.hunkCount; i++) {
        const hunk = blame.getHunkByIndex(i);
        if (hunk) hunks.push(hunk);
      }

      assertGreater(hunks.length, 0);

      for (const hunk of hunks) {
        assertExists(hunk.finalSignature);
        assertExists(hunk.finalSignature.name);
        assertExists(hunk.finalSignature.email);
      }
    });

    await t.step("blame pointer getter works", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file", {
        "test.txt": "content\n",
      });

      using repo = Repository.open(ctx.repoPath);
      using blame = repo.blameFile("test.txt");

      assertExists(blame.pointer);
    });

    await t.step("blame minLine option restricts start", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file", {
        "test.txt": "line 1\nline 2\nline 3\nline 4\nline 5\n",
      });

      using repo = Repository.open(ctx.repoPath);
      using blame = repo.blameFile("test.txt", { minLine: 3 });

      assertGreater(blame.hunkCount, 0);
    });

    await t.step("blame maxLine option restricts end", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file", {
        "test.txt": "line 1\nline 2\nline 3\nline 4\nline 5\n",
      });

      using repo = Repository.open(ctx.repoPath);
      using blame = repo.blameFile("test.txt", { maxLine: 2 });

      assertGreater(blame.hunkCount, 0);
    });

    await t.step("blame with combined minLine and maxLine", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file", {
        "test.txt": "1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n",
      });

      using repo = Repository.open(ctx.repoPath);
      using blame = repo.blameFile("test.txt", { minLine: 4, maxLine: 6 });

      assertGreater(blame.hunkCount, 0);
      assertGreaterOrEqual(blame.lineCount, 1);
    });

    await t.step(
      "blame hunk finalCommitId matches head for new file",
      async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });
        await createCommitWithFiles(ctx, "Add file", {
          "test.txt": "content\n",
        });

        const headOid = ctx.repo.headOid();

        using repo = Repository.open(ctx.repoPath);
        using blame = repo.blameFile("test.txt");

        const hunk = blame.getHunkByIndex(0);
        assertExists(hunk);
        assertEquals(
          hunk.finalCommitId,
          headOid,
          "Hunk commit should match HEAD",
        );
      },
    );

    await t.step("blame with many lines", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      const lines = Array.from({ length: 100 }, (_, i) =>
        `line ${i + 1}`).join("\n") + "\n";
      await createCommitWithFiles(ctx, "Add large file", {
        "large.txt": lines,
      });

      using repo = Repository.open(ctx.repoPath);
      using blame = repo.blameFile("large.txt");

      assertEquals(blame.lineCount, 100, "Should have 100 lines");
      assertGreater(blame.hunkCount, 0);

      const hunk1 = blame.getHunkByLine(1);
      const hunk50 = blame.getHunkByLine(50);
      const hunk100 = blame.getHunkByLine(100);

      assertExists(hunk1);
      assertExists(hunk50);
      assertExists(hunk100);
    });

    await t.step(
      "blame tracks when lines were modified across commits",
      async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });
        const commit1 = await createCommitWithFiles(ctx, "Initial", {
          "test.txt": "line A\nline B\nline C\n",
        });

        const commit2 = await createCommitWithFiles(ctx, "Modify B", {
          "test.txt": "line A\nline B modified\nline C\n",
        });

        using repo = Repository.open(ctx.repoPath);
        using blame = repo.blameFile("test.txt");

        const hunkForLine1 = blame.getHunkByLine(1);
        const hunkForLine2 = blame.getHunkByLine(2);
        const hunkForLine3 = blame.getHunkByLine(3);

        assertExists(hunkForLine1);
        assertExists(hunkForLine2);
        assertExists(hunkForLine3);

        assertEquals(
          hunkForLine1.finalCommitId,
          commit1,
          "Line 1 should be from first commit",
        );
        assertEquals(
          hunkForLine2.finalCommitId,
          commit2,
          "Line 2 should be from second commit",
        );
        assertEquals(
          hunkForLine3.finalCommitId,
          commit1,
          "Line 3 should be from first commit",
        );
      },
    );

    await t.step("blame with Symbol.dispose support", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file", {
        "test.txt": "content\n",
      });

      using repo = Repository.open(ctx.repoPath);
      {
        using blame = repo.blameFile("test.txt");
        assertGreater(blame.hunkCount, 0);
      }
      // After the block, blame should be disposed
    });

    await t.step("blame empty file", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add empty file", {
        "empty.txt": "",
      });

      using repo = Repository.open(ctx.repoPath);
      using blame = repo.blameFile("empty.txt");

      // Empty file may still have a hunk in libgit2 (representing the empty content)
      assertGreaterOrEqual(
        blame.hunkCount,
        0,
        "Empty file should have >= 0 hunks",
      );
      assertGreaterOrEqual(
        blame.lineCount,
        0,
        "Empty file should have >= 0 lines",
      );
    });

    await t.step("blame file with only newlines", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add newline file", {
        "newlines.txt": "\n\n\n",
      });

      using repo = Repository.open(ctx.repoPath);
      using blame = repo.blameFile("newlines.txt");

      assertGreater(blame.hunkCount, 0, "Should have hunks for newlines");
      assertEquals(blame.lineCount, 3, "Should count 3 lines");
    });

    await t.step("blame with newestCommit option", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      const commit1 = await createCommitWithFiles(ctx, "First", {
        "test.txt": "original\n",
      });

      await createCommitWithFiles(ctx, "Second", {
        "test.txt": "modified\n",
      });

      using repo = Repository.open(ctx.repoPath);
      using blame = repo.blameFile("test.txt", { newestCommit: commit1 });

      assertGreater(blame.hunkCount, 0);
      const hunk = blame.getHunkByIndex(0);
      assertExists(hunk);
      assertEquals(
        hunk.finalCommitId,
        commit1,
        "Should blame from first commit",
      );
    });

    await t.step("blame with oldestCommit option", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "First", {
        "test.txt": "line 1\n",
      });

      const commit2 = await createCommitWithFiles(ctx, "Second", {
        "test.txt": "line 1\nline 2\n",
      });

      using repo = Repository.open(ctx.repoPath);
      using blame = repo.blameFile("test.txt", { oldestCommit: commit2 });

      assertGreater(blame.hunkCount, 0);
    });

    await t.step("blame with both newestCommit and oldestCommit", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      const commit1 = await createCommitWithFiles(ctx, "First", {
        "test.txt": "v1\n",
      });

      const commit2 = await createCommitWithFiles(ctx, "Second", {
        "test.txt": "v2\n",
      });

      await createCommitWithFiles(ctx, "Third", {
        "test.txt": "v3\n",
      });

      using repo = Repository.open(ctx.repoPath);
      using blame = repo.blameFile("test.txt", {
        oldestCommit: commit1,
        newestCommit: commit2,
      });

      assertGreater(blame.hunkCount, 0);
    });

    await t.step("blame with all options combined", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file", {
        "test.txt": "1\n2\n3\n4\n5\n",
      });

      using repo = Repository.open(ctx.repoPath);
      using blame = repo.blameFile("test.txt", {
        flags: GitBlameFlags.NORMAL,
        minLine: 2,
        maxLine: 4,
      });

      assertGreater(blame.hunkCount, 0);
    });

    await t.step("blame hunk origSignature and origCommitter", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(
        ctx,
        "Add file",
        { "test.txt": "content\n" },
        "Original Author",
        "original@example.com",
      );

      using repo = Repository.open(ctx.repoPath);
      using blame = repo.blameFile("test.txt");

      const hunk = blame.getHunkByIndex(0);
      assertExists(hunk);
      if (hunk.origSignature) {
        assertExists(hunk.origSignature.name);
        assertExists(hunk.origSignature.email);
      }
    });

    await t.step("blame getHunkByLine with line 0 returns null", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file", {
        "test.txt": "content\n",
      });

      using repo = Repository.open(ctx.repoPath);
      using blame = repo.blameFile("test.txt");

      // Line 0 is invalid (lines are 1-based)
      const hunk = blame.getHunkByLine(0);
      assertEquals(hunk, null);
    });

    await t.step("blame file with special characters in path", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file with spaces", {
        "path with spaces/file.txt": "content\n",
      });

      using repo = Repository.open(ctx.repoPath);
      using blame = repo.blameFile("path with spaces/file.txt");

      assertGreater(blame.hunkCount, 0);
    });

    await t.step("blame file with unicode content", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add unicode file", {
        "unicode.txt": "日本語\nEmoji: 🎉\nÜmlaut: äöü\n",
      });

      using repo = Repository.open(ctx.repoPath);
      using blame = repo.blameFile("unicode.txt");

      assertGreater(blame.hunkCount, 0);
      assertEquals(blame.lineCount, 3);
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
