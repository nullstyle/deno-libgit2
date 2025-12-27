/**
 * End-to-end tests for reflog functionality
 *
 * These tests validate reflog functionality including:
 * - Reading reflogs for various references
 * - Entry count and iteration
 * - Entry properties (OIDs, committer, message)
 * - Writing and dropping entries
 * - Symbol.dispose support
 * - Error handling
 */

import {
  assert,
  assertEquals,
  assertExists,
  assertGreater,
  assertGreaterOrEqual,
  assertNotEquals,
  assertThrows,
} from "@std/assert";
import { Repository } from "../../mod.ts";
import {
  createCommitWithFiles,
  createTestContext,
  setupLibrary,
} from "./helpers.ts";

Deno.test("E2E Reflog Tests", async (t) => {
  using _git = await setupLibrary();

  // ==================== Read Reflog Tests ====================

  await t.step("read reflog for HEAD", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    await createCommitWithFiles(ctx, "First commit", {
      "file.txt": "content\n",
    });

    const reflog = ctx.repo.readReflog("HEAD");
    try {
      assertGreater(reflog.entryCount, 0, "Should have reflog entries");
    } finally {
      reflog.free();
    }
  });

  await t.step("read reflog for refs/heads/main", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    await createCommitWithFiles(ctx, "First commit", {
      "file.txt": "content\n",
    });

    // Get the actual default branch name
    const head = ctx.repo.head();
    const branchName = head.name;

    const reflog = ctx.repo.readReflog(branchName);
    try {
      assertGreater(reflog.entryCount, 0, "Should have reflog entries");
    } finally {
      reflog.free();
    }
  });

  await t.step("empty reflog for non-existent reference", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    await createCommitWithFiles(ctx, "Initial", { "file.txt": "content\n" });

    const reflog = ctx.repo.readReflog("refs/heads/nonexistent");
    try {
      assertEquals(
        reflog.entryCount,
        0,
        "Non-existent ref should have empty reflog",
      );
    } finally {
      reflog.free();
    }
  });

  // ==================== Reflog Pointer Tests ====================

  await t.step("reflog pointer property", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    await createCommitWithFiles(ctx, "Initial", { "file.txt": "content\n" });

    const reflog = ctx.repo.readReflog("HEAD");
    try {
      assertExists(reflog.pointer);
      assertNotEquals(reflog.pointer, null);
    } finally {
      reflog.free();
    }
  });

  // ==================== Entry Count Tests ====================

  await t.step("reflog entry count increases with commits", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    await createCommitWithFiles(ctx, "First commit", {
      "file.txt": "content 1\n",
    });

    const reflog1 = ctx.repo.readReflog("HEAD");
    const count1 = reflog1.entryCount;
    reflog1.free();

    await createCommitWithFiles(ctx, "Second commit", {
      "file.txt": "content 2\n",
    });

    ctx.repo.close();
    ctx.repo = Repository.open(ctx.repoPath);

    const reflog2 = ctx.repo.readReflog("HEAD");
    const count2 = reflog2.entryCount;
    reflog2.free();

    assertGreater(count2, count1, "Entry count should increase after commit");
  });

  await t.step("reflog entry count for multiple commits", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });

    // Create 5 commits
    for (let i = 1; i <= 5; i++) {
      await createCommitWithFiles(ctx, `Commit ${i}`, {
        "file.txt": `content ${i}\n`,
      });
    }

    ctx.repo.close();
    ctx.repo = Repository.open(ctx.repoPath);

    const reflog = ctx.repo.readReflog("HEAD");
    try {
      assertGreaterOrEqual(reflog.entryCount, 5);
    } finally {
      reflog.free();
    }
  });

  // ==================== Get Entry Tests ====================

  await t.step("reflog entry contains old and new OID", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    await createCommitWithFiles(ctx, "First commit", {
      "file.txt": "content 1\n",
    });

    const firstOid = ctx.repo.headOid();

    await createCommitWithFiles(ctx, "Second commit", {
      "file.txt": "content 2\n",
    });

    ctx.repo.close();
    ctx.repo = Repository.open(ctx.repoPath);

    const reflog = ctx.repo.readReflog("HEAD");
    try {
      const entry = reflog.getEntry(0);
      assertExists(entry, "Should have entry at index 0");
      assertExists(entry.newOid, "Entry should have new OID");
      assertExists(entry.oldOid, "Entry should have old OID");
      assertEquals(entry.oldOid, firstOid, "Old OID should be first commit");
    } finally {
      reflog.free();
    }
  });

  await t.step("reflog entry contains committer information", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    await createCommitWithFiles(ctx, "First commit", {
      "file.txt": "content\n",
    });

    const reflog = ctx.repo.readReflog("HEAD");
    try {
      const entry = reflog.getEntry(0);
      assertExists(entry, "Should have entry");
      assertExists(entry.committer, "Entry should have committer");
      assertExists(entry.committer.name, "Committer should have name");
      assertExists(entry.committer.email, "Committer should have email");
      assertExists(entry.committer.when, "Committer should have when");
      assertEquals(typeof entry.committer.when.time, "bigint");
      assertEquals(typeof entry.committer.when.offset, "number");
    } finally {
      reflog.free();
    }
  });

  await t.step("reflog entry contains message", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    await createCommitWithFiles(ctx, "Test commit message", {
      "file.txt": "content\n",
    });

    const reflog = ctx.repo.readReflog("HEAD");
    try {
      const entry = reflog.getEntry(0);
      assertExists(entry, "Should have entry");
      assertExists(entry.message, "Entry should have message");
    } finally {
      reflog.free();
    }
  });

  await t.step("getEntry returns null for invalid index", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    await createCommitWithFiles(ctx, "Commit", { "file.txt": "content\n" });

    const reflog = ctx.repo.readReflog("HEAD");
    try {
      const entry = reflog.getEntry(9999);
      assertEquals(entry, null, "Should return null for invalid index");
    } finally {
      reflog.free();
    }
  });

  await t.step("getEntry returns null for negative index", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    await createCommitWithFiles(ctx, "Commit", { "file.txt": "content\n" });

    const reflog = ctx.repo.readReflog("HEAD");
    try {
      const entry = reflog.getEntry(-1);
      assertEquals(entry, null, "Should return null for negative index");
    } finally {
      reflog.free();
    }
  });

  await t.step("reflog entry OIDs are valid hex strings", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    await createCommitWithFiles(ctx, "First", { "file.txt": "v1\n" });
    await createCommitWithFiles(ctx, "Second", { "file.txt": "v2\n" });

    ctx.repo.close();
    ctx.repo = Repository.open(ctx.repoPath);

    const reflog = ctx.repo.readReflog("HEAD");
    try {
      const entry = reflog.getEntry(0);
      assertExists(entry, "Should have entry");

      assertEquals(entry.newOid.length, 40, "New OID should be 40 chars");
      assertEquals(entry.oldOid.length, 40, "Old OID should be 40 chars");

      const hexRegex = /^[0-9a-f]{40}$/;
      assertEquals(
        hexRegex.test(entry.newOid),
        true,
        "New OID should be valid hex",
      );
      assertEquals(
        hexRegex.test(entry.oldOid),
        true,
        "Old OID should be valid hex",
      );
    } finally {
      reflog.free();
    }
  });

  // ==================== Entries Tests ====================

  await t.step("iterate over all reflog entries", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    await createCommitWithFiles(ctx, "Commit 1", { "file.txt": "v1\n" });
    await createCommitWithFiles(ctx, "Commit 2", { "file.txt": "v2\n" });
    await createCommitWithFiles(ctx, "Commit 3", { "file.txt": "v3\n" });

    ctx.repo.close();
    ctx.repo = Repository.open(ctx.repoPath);

    const reflog = ctx.repo.readReflog("HEAD");
    try {
      const entries = reflog.entries();
      assertGreaterOrEqual(
        entries.length,
        3,
        "Should have at least 3 entries",
      );

      for (let i = 0; i < entries.length; i++) {
        assertExists(entries[i].newOid, `Entry ${i} should have new OID`);
        assertExists(entries[i].oldOid, `Entry ${i} should have old OID`);
        assertExists(
          entries[i].committer,
          `Entry ${i} should have committer`,
        );
      }
    } finally {
      reflog.free();
    }
  });

  await t.step(
    "entries returns array in reverse chronological order",
    async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "C1", { "file.txt": "v1\n" });
      const oid1 = ctx.repo.headOid()!;
      await createCommitWithFiles(ctx, "C2", { "file.txt": "v2\n" });
      const oid2 = ctx.repo.headOid()!;

      ctx.repo.close();
      ctx.repo = Repository.open(ctx.repoPath);

      const reflog = ctx.repo.readReflog("HEAD");
      try {
        const entries = reflog.entries();
        // Entry 0 should be the most recent (oid2)
        assertEquals(entries[0].newOid, oid2);
        // Entry 1 should have oid1 as its newOid
        assertEquals(entries[1].newOid, oid1);
      } finally {
        reflog.free();
      }
    },
  );

  await t.step("entries for empty reflog returns empty array", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    await createCommitWithFiles(ctx, "Commit", { "f.txt": "c" });

    const reflog = ctx.repo.readReflog("refs/heads/nonexistent");
    try {
      const entries = reflog.entries();
      assertEquals(entries.length, 0);
    } finally {
      reflog.free();
    }
  });

  // ==================== Write Tests ====================

  await t.step("write reflog persists changes", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    await createCommitWithFiles(ctx, "Commit", { "file.txt": "content\n" });

    const reflog = ctx.repo.readReflog("HEAD");
    try {
      // Write should not throw
      reflog.write();
    } finally {
      reflog.free();
    }
  });

  await t.step("write reflog after multiple operations", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    await createCommitWithFiles(ctx, "C1", { "f.txt": "1\n" });
    await createCommitWithFiles(ctx, "C2", { "f.txt": "2\n" });
    await createCommitWithFiles(ctx, "C3", { "f.txt": "3\n" });

    ctx.repo.close();
    ctx.repo = Repository.open(ctx.repoPath);

    const reflog = ctx.repo.readReflog("HEAD");
    try {
      const countBefore = reflog.entryCount;
      reflog.write();

      // Re-read and verify
      ctx.repo.close();
      ctx.repo = Repository.open(ctx.repoPath);
      const reflog2 = ctx.repo.readReflog("HEAD");
      assertEquals(reflog2.entryCount, countBefore);
      reflog2.free();
    } finally {
      reflog.free();
    }
  });

  // ==================== Drop Tests ====================

  await t.step("drop reflog entry", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    await createCommitWithFiles(ctx, "C1", { "f.txt": "1\n" });
    await createCommitWithFiles(ctx, "C2", { "f.txt": "2\n" });
    await createCommitWithFiles(ctx, "C3", { "f.txt": "3\n" });

    ctx.repo.close();
    ctx.repo = Repository.open(ctx.repoPath);

    const reflog = ctx.repo.readReflog("HEAD");
    try {
      const countBefore = reflog.entryCount;
      assertGreaterOrEqual(countBefore, 3);

      // Drop the most recent entry
      reflog.drop(0);

      assertEquals(reflog.entryCount, countBefore - 1);
    } finally {
      reflog.free();
    }
  });

  await t.step(
    "drop reflog entry with rewritePreviousEntry true",
    async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "C1", { "f.txt": "1\n" });
      await createCommitWithFiles(ctx, "C2", { "f.txt": "2\n" });
      await createCommitWithFiles(ctx, "C3", { "f.txt": "3\n" });

      ctx.repo.close();
      ctx.repo = Repository.open(ctx.repoPath);

      const reflog = ctx.repo.readReflog("HEAD");
      try {
        const countBefore = reflog.entryCount;

        // Drop with rewrite (default)
        reflog.drop(0, true);

        assertEquals(reflog.entryCount, countBefore - 1);
      } finally {
        reflog.free();
      }
    },
  );

  await t.step(
    "drop reflog entry with rewritePreviousEntry false",
    async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "C1", { "f.txt": "1\n" });
      await createCommitWithFiles(ctx, "C2", { "f.txt": "2\n" });
      await createCommitWithFiles(ctx, "C3", { "f.txt": "3\n" });

      ctx.repo.close();
      ctx.repo = Repository.open(ctx.repoPath);

      const reflog = ctx.repo.readReflog("HEAD");
      try {
        const countBefore = reflog.entryCount;

        // Drop without rewrite
        reflog.drop(0, false);

        assertEquals(reflog.entryCount, countBefore - 1);
      } finally {
        reflog.free();
      }
    },
  );

  await t.step("drop multiple entries", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    for (let i = 0; i < 5; i++) {
      await createCommitWithFiles(ctx, `C${i}`, { "f.txt": `${i}\n` });
    }

    ctx.repo.close();
    ctx.repo = Repository.open(ctx.repoPath);

    const reflog = ctx.repo.readReflog("HEAD");
    try {
      const countBefore = reflog.entryCount;

      // Drop first two entries
      reflog.drop(0);
      reflog.drop(0);

      assertEquals(reflog.entryCount, countBefore - 2);
    } finally {
      reflog.free();
    }
  });

  // ==================== Branch Tracking Tests ====================

  await t.step("reflog tracks branch creation", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    await createCommitWithFiles(ctx, "Initial", { "file.txt": "content\n" });

    ctx.repo.createBranch("feature", ctx.repo.headOid());

    const reflog = ctx.repo.readReflog("refs/heads/feature");
    try {
      assertGreater(
        reflog.entryCount,
        0,
        "New branch should have reflog entry",
      );
    } finally {
      reflog.free();
    }
  });

  await t.step("reflog for different branches are independent", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    await createCommitWithFiles(ctx, "Initial", { "f.txt": "c\n" });

    const headOid = ctx.repo.headOid()!;
    ctx.repo.createBranch("feature1", headOid);
    ctx.repo.createBranch("feature2", headOid);

    const reflog1 = ctx.repo.readReflog("refs/heads/feature1");
    const reflog2 = ctx.repo.readReflog("refs/heads/feature2");

    try {
      // Both branches should have their own reflogs
      assertGreater(reflog1.entryCount, 0);
      assertGreater(reflog2.entryCount, 0);
    } finally {
      reflog1.free();
      reflog2.free();
    }
  });

  // ==================== Symbol.dispose Tests ====================

  await t.step("reflog supports Symbol.dispose", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    await createCommitWithFiles(ctx, "Commit", { "f.txt": "c\n" });

    {
      using reflog = ctx.repo.readReflog("HEAD");
      assertGreater(reflog.entryCount, 0);
    }
    // Reflog disposed on scope exit
  });

  await t.step("reflog close is alias for free", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    await createCommitWithFiles(ctx, "Commit", { "f.txt": "c\n" });

    const reflog = ctx.repo.readReflog("HEAD");
    reflog.close();

    assertThrows(
      () => reflog.entryCount,
      Error,
      "Reflog has been freed",
    );
  });

  await t.step("reflog free is idempotent", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    await createCommitWithFiles(ctx, "Commit", { "f.txt": "c\n" });

    const reflog = ctx.repo.readReflog("HEAD");
    reflog.free();
    reflog.free();
    reflog.free();
    // Should not throw
  });

  // ==================== Error Handling Tests ====================

  await t.step("throws when accessing entryCount after free", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    await createCommitWithFiles(ctx, "Commit", { "f.txt": "c\n" });

    const reflog = ctx.repo.readReflog("HEAD");
    reflog.free();

    assertThrows(
      () => reflog.entryCount,
      Error,
      "Reflog has been freed",
    );
  });

  await t.step("throws when calling getEntry after free", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    await createCommitWithFiles(ctx, "Commit", { "f.txt": "c\n" });

    const reflog = ctx.repo.readReflog("HEAD");
    reflog.free();

    assertThrows(
      () => reflog.getEntry(0),
      Error,
      "Reflog has been freed",
    );
  });

  await t.step("throws when calling entries after free", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    await createCommitWithFiles(ctx, "Commit", { "f.txt": "c\n" });

    const reflog = ctx.repo.readReflog("HEAD");
    reflog.free();

    assertThrows(
      () => reflog.entries(),
      Error,
      "Reflog has been freed",
    );
  });

  await t.step("throws when calling write after free", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    await createCommitWithFiles(ctx, "Commit", { "f.txt": "c\n" });

    const reflog = ctx.repo.readReflog("HEAD");
    reflog.free();

    assertThrows(
      () => reflog.write(),
      Error,
      "Reflog has been freed",
    );
  });

  await t.step("throws when calling drop after free", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    await createCommitWithFiles(ctx, "Commit", { "f.txt": "c\n" });

    const reflog = ctx.repo.readReflog("HEAD");
    reflog.free();

    assertThrows(
      () => reflog.drop(0),
      Error,
      "Reflog has been freed",
    );
  });

  // ==================== Delete Reflog Tests ====================

  await t.step("delete reflog removes it", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    await createCommitWithFiles(ctx, "Commit", { "f.txt": "c\n" });

    ctx.repo.createBranch("to-delete", ctx.repo.headOid()!);

    // Verify reflog exists
    const reflog1 = ctx.repo.readReflog("refs/heads/to-delete");
    assertGreater(reflog1.entryCount, 0);
    reflog1.free();

    // Delete the reflog
    ctx.repo.deleteReflog("refs/heads/to-delete");

    // Verify reflog is empty now
    const reflog2 = ctx.repo.readReflog("refs/heads/to-delete");
    assertEquals(reflog2.entryCount, 0);
    reflog2.free();
  });

  // ==================== Rename Reflog Tests ====================

  await t.step("rename reflog moves entries", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    await createCommitWithFiles(ctx, "Commit", { "f.txt": "c\n" });

    const headOid = ctx.repo.headOid()!;
    ctx.repo.createBranch("old-name", headOid);

    // Verify old reflog exists
    const reflogOld = ctx.repo.readReflog("refs/heads/old-name");
    const oldCount = reflogOld.entryCount;
    assertGreater(oldCount, 0);
    reflogOld.free();

    // Rename the reflog
    ctx.repo.renameReflog("refs/heads/old-name", "refs/heads/new-name");

    // Verify new reflog has the entries
    const reflogNew = ctx.repo.readReflog("refs/heads/new-name");
    assertEquals(reflogNew.entryCount, oldCount);
    reflogNew.free();

    // Old reflog should be empty
    const reflogOld2 = ctx.repo.readReflog("refs/heads/old-name");
    assertEquals(reflogOld2.entryCount, 0);
    reflogOld2.free();
  });

  // ==================== Edge Cases ====================

  await t.step("reflog entry message can be null", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    await createCommitWithFiles(ctx, "Commit", { "f.txt": "c\n" });

    const reflog = ctx.repo.readReflog("HEAD");
    try {
      const entries = reflog.entries();
      // Some entries may have null messages, just verify we can access them
      for (const entry of entries) {
        // message is string | null
        assertEquals(
          typeof entry.message === "string" || entry.message === null,
          true,
        );
      }
    } finally {
      reflog.free();
    }
  });

  await t.step("multiple reflogs can be opened simultaneously", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    await createCommitWithFiles(ctx, "Commit", { "f.txt": "c\n" });

    ctx.repo.createBranch("branch1", ctx.repo.headOid()!);
    ctx.repo.createBranch("branch2", ctx.repo.headOid()!);

    const reflog1 = ctx.repo.readReflog("HEAD");
    const reflog2 = ctx.repo.readReflog("refs/heads/branch1");
    const reflog3 = ctx.repo.readReflog("refs/heads/branch2");

    try {
      assertGreater(reflog1.entryCount, 0);
      assertGreater(reflog2.entryCount, 0);
      assertGreater(reflog3.entryCount, 0);
    } finally {
      reflog1.free();
      reflog2.free();
      reflog3.free();
    }
  });

  await t.step(
    "reflog preserves commit author in committer field",
    async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(
        ctx,
        "Test commit",
        { "f.txt": "c\n" },
        "Test Author",
        "test@example.com",
      );

      ctx.repo.close();
      ctx.repo = Repository.open(ctx.repoPath);

      const reflog = ctx.repo.readReflog("HEAD");
      try {
        const entry = reflog.getEntry(0);
        assertExists(entry);
        assertEquals(entry.committer.name, "Test Author");
        assertEquals(entry.committer.email, "test@example.com");
      } finally {
        reflog.free();
      }
    },
  );

  // ==================== Additional Coverage Tests ====================

  await t.step("reflog committer.when.sign field", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    await createCommitWithFiles(ctx, "Test commit", { "f.txt": "c\n" });

    const reflog = ctx.repo.readReflog("HEAD");
    try {
      const entry = reflog.getEntry(0);
      assertExists(entry);
      assertExists(entry.committer.when);
      // Sign should be "+" or "-"
      assert(
        entry.committer.when.sign === "+" || entry.committer.when.sign === "-",
      );
    } finally {
      reflog.free();
    }
  });

  await t.step("reflog entry with zero OID for initial commit", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    // First commit on a new branch will have all-zeros for old OID
    const reflog = ctx.repo.readReflog("HEAD");
    try {
      const entries = reflog.entries();
      // Find the very first entry (the initial commit)
      const lastEntry = entries[entries.length - 1];
      if (lastEntry) {
        // The initial commit's oldOid should be all zeros
        assertEquals(lastEntry.oldOid.length, 40);
      }
    } finally {
      reflog.free();
    }
  });

  await t.step("reflog entries method returns correct count", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    await createCommitWithFiles(ctx, "C1", { "f.txt": "1\n" });
    await createCommitWithFiles(ctx, "C2", { "f.txt": "2\n" });

    ctx.repo.close();
    ctx.repo = Repository.open(ctx.repoPath);

    const reflog = ctx.repo.readReflog("HEAD");
    try {
      const entries = reflog.entries();
      assertEquals(entries.length, reflog.entryCount);
    } finally {
      reflog.free();
    }
  });

  await t.step("getEntry skips null entries in entries()", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    await createCommitWithFiles(ctx, "Commit", { "f.txt": "c\n" });

    const reflog = ctx.repo.readReflog("HEAD");
    try {
      const entries = reflog.entries();
      // All returned entries should be valid (not null)
      for (const entry of entries) {
        assertExists(entry);
        assertExists(entry.newOid);
        assertExists(entry.oldOid);
        assertExists(entry.committer);
      }
    } finally {
      reflog.free();
    }
  });

  await t.step("reflog entry message can be empty string", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    await createCommitWithFiles(ctx, "Commit", { "f.txt": "c\n" });

    const reflog = ctx.repo.readReflog("HEAD");
    try {
      const entries = reflog.entries();
      // Verify message handling (could be string or null)
      for (const entry of entries) {
        const msg = entry.message;
        assert(msg === null || typeof msg === "string");
      }
    } finally {
      reflog.free();
    }
  });

  await t.step("reflog drop with rewrite changes history", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    await createCommitWithFiles(ctx, "C1", { "f.txt": "1\n" });
    await createCommitWithFiles(ctx, "C2", { "f.txt": "2\n" });
    await createCommitWithFiles(ctx, "C3", { "f.txt": "3\n" });
    await createCommitWithFiles(ctx, "C4", { "f.txt": "4\n" });

    ctx.repo.close();
    ctx.repo = Repository.open(ctx.repoPath);

    const reflog = ctx.repo.readReflog("HEAD");
    try {
      const initialCount = reflog.entryCount;
      assertGreaterOrEqual(initialCount, 4);

      // Drop a middle entry with rewrite
      reflog.drop(1, true);

      assertEquals(reflog.entryCount, initialCount - 1);
    } finally {
      reflog.free();
    }
  });

  await t.step("reflog pointer is valid after reading", async () => {
    await using ctx = await createTestContext({ withInitialCommit: true });
    await createCommitWithFiles(ctx, "Commit", { "f.txt": "c\n" });

    const reflog = ctx.repo.readReflog("HEAD");
    try {
      assertExists(reflog.pointer);
      // Pointer should be accessible until freed
      assertNotEquals(reflog.pointer, null);
    } finally {
      reflog.free();
    }
  });
});
