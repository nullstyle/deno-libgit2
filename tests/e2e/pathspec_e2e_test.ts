/**
 * End-to-end tests for pathspec operations
 */

import { assertEquals, assertExists, assertGreater } from "@std/assert";
import {
  
  createCommitWithFiles,
  createTestContext,
} from "./helpers.ts";
import { GitPathspecFlags, Index, init, shutdown } from "../../mod.ts";

Deno.test("E2E Pathspec Tests", async (t) => {
  await init();

  await t.step("create pathspec and match single path", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
      // Create a pathspec for *.txt files
      const ps = ctx.repo.createPathspec(["*.txt"]);
      assertExists(ps);

      // Test matching
      assertEquals(ps.matchesPath("file.txt"), true);
      assertEquals(ps.matchesPath("file.md"), false);
      assertEquals(ps.matchesPath("dir/file.txt"), true);

      ps.free();
    
  });

  await t.step("pathspec with multiple patterns", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
      const ps = ctx.repo.createPathspec(["*.txt", "*.md", "src/*"]);

      assertEquals(ps.matchesPath("readme.txt"), true);
      assertEquals(ps.matchesPath("readme.md"), true);
      assertEquals(ps.matchesPath("src/main.ts"), true);
      assertEquals(ps.matchesPath("lib/main.ts"), false);
      assertEquals(ps.matchesPath("file.js"), false);

      ps.free();
    
  });

  await t.step("pathspec case-insensitive matching", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
      const ps = ctx.repo.createPathspec(["*.TXT"]);

      // With IGNORE_CASE flag
      assertEquals(
        ps.matchesPath("file.txt", GitPathspecFlags.IGNORE_CASE),
        true,
      );
      assertEquals(
        ps.matchesPath("FILE.TXT", GitPathspecFlags.IGNORE_CASE),
        true,
      );

      ps.free();
    
  });

  await t.step("pathspec no glob mode", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
      const ps = ctx.repo.createPathspec(["*.txt"]);

      // With NO_GLOB flag, should match literally
      assertEquals(ps.matchesPath("*.txt", GitPathspecFlags.NO_GLOB), true);
      assertEquals(ps.matchesPath("file.txt", GitPathspecFlags.NO_GLOB), false);

      ps.free();
    
  });

  await t.step("pathspec directory pattern", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
      const ps = ctx.repo.createPathspec(["src/**"]);

      assertEquals(ps.matchesPath("src/file.ts"), true);
      assertEquals(ps.matchesPath("src/sub/file.ts"), true);
      assertEquals(ps.matchesPath("lib/file.ts"), false);

      ps.free();
    
  });

  await t.step("pathspec negation pattern", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
      // Note: libgit2 pathspec doesn't support negation like gitignore
      // This test verifies basic pattern matching
      const ps = ctx.repo.createPathspec(["*.ts"]);

      assertEquals(ps.matchesPath("main.ts"), true);
      assertEquals(ps.matchesPath("main.js"), false);

      ps.free();
    
  });

  await t.step("empty pathspec matches everything", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
      const ps = ctx.repo.createPathspec([]);

      // Empty pathspec matches everything in libgit2
      assertEquals(ps.matchesPath("any/file.txt"), true);

      ps.free();
    
  });

  await t.step("pathspec with exact filename", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
      const ps = ctx.repo.createPathspec(["package.json"]);

      assertEquals(ps.matchesPath("package.json"), true);
      // Note: pathspec doesn't match subdirectory paths by default
      // unless using ** glob pattern
      assertEquals(ps.matchesPath("package.lock"), false);

      ps.free();
    
  });

  await t.step("matchWorkdir finds files in working directory", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
      // Create some files in the working directory
      await createCommitWithFiles(ctx, "Add files", {
        "file1.txt": "content1\n",
        "file2.txt": "content2\n",
        "file3.md": "content3\n",
        "src/code.ts": "code\n",
      });

      // Match only .txt files
      const ps = ctx.repo.createPathspec(["*.txt"]);
      const matchList = ps.matchWorkdir({ ptr: ctx.repo.pointer });

      assertExists(matchList);
      assertGreater(matchList.entryCount, 0, "Should find .txt files");

      const entries = matchList.entries();
      assertEquals(entries.includes("file1.txt"), true);
      assertEquals(entries.includes("file2.txt"), true);
      assertEquals(entries.includes("file3.md"), false);

      matchList.free();
      ps.free();
    
  });

  await t.step("matchWorkdir with directory pattern", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
      // Create files in different directories
      await createCommitWithFiles(ctx, "Add files", {
        "src/main.ts": "main\n",
        "src/utils.ts": "utils\n",
        "lib/helper.ts": "helper\n",
        "index.ts": "index\n",
      });

      // Match only src directory
      const ps = ctx.repo.createPathspec(["src/*"]);
      const matchList = ps.matchWorkdir({ ptr: ctx.repo.pointer });

      assertExists(matchList);
      const entries = matchList.entries();

      // Should contain src files
      const hasSrcFiles = entries.some((e) => e.startsWith("src/"));
      assertEquals(hasSrcFiles, true, "Should find files in src/");

      matchList.free();
      ps.free();
    
  });

  await t.step("matchIndex finds staged files", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
      // Create and stage some files
      await Deno.writeTextFile(`${ctx.repoPath}/staged1.txt`, "content1\n");
      await Deno.writeTextFile(`${ctx.repoPath}/staged2.txt`, "content2\n");
      await Deno.writeTextFile(`${ctx.repoPath}/staged3.md`, "content3\n");

      const index = Index.fromRepository(ctx.repo);
      index.add("staged1.txt");
      index.add("staged2.txt");
      index.add("staged3.md");
      index.write();

      // Match only .txt files in the index
      const ps = ctx.repo.createPathspec(["*.txt"]);
      const matchList = ps.matchIndex({ ptr: index.pointer });

      assertExists(matchList);
      assertGreater(matchList.entryCount, 0, "Should find .txt files in index");

      const entries = matchList.entries();
      assertEquals(entries.includes("staged1.txt"), true);
      assertEquals(entries.includes("staged2.txt"), true);
      assertEquals(entries.includes("staged3.md"), false);

      matchList.free();
      ps.free();
      index.close();
    
  });

  await t.step("matchTree finds files in a commit tree", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
      // Create a commit with specific files
      const commitOid = await createCommitWithFiles(ctx, "Add files", {
        "tree1.txt": "content1\n",
        "tree2.txt": "content2\n",
        "tree3.js": "content3\n",
      });

      // Match only .txt files in the tree
      const ps = ctx.repo.createPathspec(["*.txt"]);
      const matchList = ps.matchTree({ ptr: ctx.repo.pointer }, commitOid);

      assertExists(matchList);
      assertGreater(matchList.entryCount, 0, "Should find .txt files in tree");

      const entries = matchList.entries();
      assertEquals(entries.includes("tree1.txt"), true);
      assertEquals(entries.includes("tree2.txt"), true);
      assertEquals(entries.includes("tree3.js"), false);

      matchList.free();
      ps.free();
    
  });

  await t.step("PathspecMatchList entry retrieval", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add files", {
        "a.txt": "a\n",
        "b.txt": "b\n",
        "c.txt": "c\n",
      });

      const ps = ctx.repo.createPathspec(["*.txt"]);
      const matchList = ps.matchWorkdir({ ptr: ctx.repo.pointer });

      assertExists(matchList);
      const count = matchList.entryCount;
      assertGreater(count, 0, "Should have matches");

      // Test individual entry retrieval
      for (let i = 0; i < count; i++) {
        const entry = matchList.entry(i);
        assertExists(entry, `Entry at index ${i} should exist`);
      }

      // Test out of range returns null
      const outOfRange = matchList.entry(count + 100);
      assertEquals(outOfRange, null);

      matchList.free();
      ps.free();
    
  });

  await t.step("pathspec FIND_FAILURES tracks unmatched patterns", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
      // Create some files
      await createCommitWithFiles(ctx, "Add files", {
        "file.txt": "content\n",
      });

      // Create pathspec with a pattern that won't match anything
      const ps = ctx.repo.createPathspec(["*.txt", "*.nonexistent"]);
      const matchList = ps.matchWorkdir(
        { ptr: ctx.repo.pointer },
        GitPathspecFlags.FIND_FAILURES,
      );

      assertExists(matchList);

      // Should have found .txt files
      assertGreater(matchList.entryCount, 0);

      // Should have tracked the unmatched pattern
      const failedCount = matchList.failedEntryCount;
      assertGreater(failedCount, 0, "Should have failed patterns");

      const failedEntries = matchList.failedEntries();
      assertEquals(failedEntries.includes("*.nonexistent"), true);

      matchList.free();
      ps.free();
    
  });

  await t.step("pathspec USE_CASE forces case-sensitive", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
      const ps = ctx.repo.createPathspec(["*.TXT"]);

      // With USE_CASE flag, should be case-sensitive
      assertEquals(ps.matchesPath("file.TXT", GitPathspecFlags.USE_CASE), true);
      assertEquals(
        ps.matchesPath("file.txt", GitPathspecFlags.USE_CASE),
        false,
      );

      ps.free();
    
  });

  await t.step("pathspec combined flags", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
      const ps = ctx.repo.createPathspec(["*.txt"]);

      // Combine flags
      const flags = GitPathspecFlags.IGNORE_CASE | GitPathspecFlags.NO_GLOB;

      // With combined flags, "*.txt" is literal (NO_GLOB) but case-insensitive
      assertEquals(ps.matchesPath("*.TXT", flags), true);
      assertEquals(ps.matchesPath("*.txt", flags), true);
      assertEquals(ps.matchesPath("file.txt", flags), false);

      ps.free();
    
  });

  await t.step("pathspec with special characters", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
      // Test patterns with special glob characters
      const ps = ctx.repo.createPathspec(["[abc]*.txt"]);

      assertEquals(ps.matchesPath("a_file.txt"), true);
      assertEquals(ps.matchesPath("b_file.txt"), true);
      assertEquals(ps.matchesPath("c_file.txt"), true);
      assertEquals(ps.matchesPath("d_file.txt"), false);

      ps.free();
    
  });

  await t.step("pathspec with question mark wildcard", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
      const ps = ctx.repo.createPathspec(["file?.txt"]);

      assertEquals(ps.matchesPath("file1.txt"), true);
      assertEquals(ps.matchesPath("fileA.txt"), true);
      assertEquals(ps.matchesPath("file.txt"), false);
      assertEquals(ps.matchesPath("file12.txt"), false);

      ps.free();
    
  });

  await t.step("pathspec dispose pattern", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
      // Test using dispose
      {
        using ps = ctx.repo.createPathspec(["*.txt"]);
        assertEquals(ps.matchesPath("file.txt"), true);
        // ps.free() is called automatically
      }

      // Create another to verify no issues
      const ps2 = ctx.repo.createPathspec(["*.md"]);
      assertEquals(ps2.matchesPath("file.md"), true);
      ps2.free();
    
  });

  await t.step("PathspecMatchList dispose pattern", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Add file", {
        "test.txt": "content\n",
      });

      const ps = ctx.repo.createPathspec(["*.txt"]);

      // Test using dispose on match list
      {
        using matchList = ps.matchWorkdir({ ptr: ctx.repo.pointer });
        assertGreater(matchList.entryCount, 0);
        // matchList.free() is called automatically
      }

      ps.free();
    
  });

  shutdown();
});
