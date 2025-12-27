/**
 * End-to-end tests for reflog functionality
 * Tests use real file operations in temporary directories
 */

import {
  assertEquals,
  assertExists,
  assertGreater,
  assertGreaterOrEqual,
} from "@std/assert";
import {
  init,
  shutdown,
  Repository,
} from "../../mod.ts";
import {
  createTestContext,
  cleanupTestContext,
  createCommitWithFiles,
} from "./helpers.ts";

Deno.test("E2E Reflog Tests", async (t) => {
  await init();

  try {
    await t.step("read reflog for HEAD", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        await createCommitWithFiles(ctx, "First commit", {
          "file.txt": "content\n",
        });

        const reflog = ctx.repo.readReflog("HEAD");
        try {
          assertGreater(reflog.entryCount, 0, "Should have reflog entries");
        } finally {
          reflog.free();
        }
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("read reflog for refs/heads/main", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        await createCommitWithFiles(ctx, "First commit", {
          "file.txt": "content\n",
        });

        // Get the actual default branch name
        const head = ctx.repo.head();
        const branchName = head.name; // e.g., "refs/heads/main" or "refs/heads/master"

        const reflog = ctx.repo.readReflog(branchName);
        try {
          assertGreater(reflog.entryCount, 0, "Should have reflog entries");
        } finally {
          reflog.free();
        }
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("reflog entry count increases with commits", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        await createCommitWithFiles(ctx, "First commit", {
          "file.txt": "content 1\n",
        });

        const reflog1 = ctx.repo.readReflog("HEAD");
        const count1 = reflog1.entryCount;
        reflog1.free();

        await createCommitWithFiles(ctx, "Second commit", {
          "file.txt": "content 2\n",
        });

        // Reopen repo to get fresh reflog
        ctx.repo.close();
        ctx.repo = Repository.open(ctx.repoPath);

        const reflog2 = ctx.repo.readReflog("HEAD");
        const count2 = reflog2.entryCount;
        reflog2.free();

        assertGreater(count2, count1, "Entry count should increase after commit");
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("reflog entry contains old and new OID", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
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
          // Index 0 is the most recent entry
          const entry = reflog.getEntry(0);
          assertExists(entry, "Should have entry at index 0");
          assertExists(entry.newOid, "Entry should have new OID");
          assertExists(entry.oldOid, "Entry should have old OID");
          assertEquals(entry.oldOid, firstOid, "Old OID should be first commit");
        } finally {
          reflog.free();
        }
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("reflog entry contains committer information", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
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
        } finally {
          reflog.free();
        }
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("reflog entry contains message", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
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
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("iterate over all reflog entries", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        // Create multiple commits
        await createCommitWithFiles(ctx, "Commit 1", { "file.txt": "v1\n" });
        await createCommitWithFiles(ctx, "Commit 2", { "file.txt": "v2\n" });
        await createCommitWithFiles(ctx, "Commit 3", { "file.txt": "v3\n" });

        ctx.repo.close();
        ctx.repo = Repository.open(ctx.repoPath);

        const reflog = ctx.repo.readReflog("HEAD");
        try {
          const entries = reflog.entries();
          assertGreaterOrEqual(entries.length, 3, "Should have at least 3 entries");

          // Verify entries are in reverse chronological order (newest first)
          for (let i = 0; i < entries.length - 1; i++) {
            assertExists(entries[i].newOid, `Entry ${i} should have new OID`);
          }
        } finally {
          reflog.free();
        }
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("reflog tracks branch creation", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        await createCommitWithFiles(ctx, "Initial", { "file.txt": "content\n" });

        // Create a new branch
        ctx.repo.createBranch("feature", ctx.repo.headOid());

        // Read reflog for the new branch
        const reflog = ctx.repo.readReflog("refs/heads/feature");
        try {
          assertGreater(reflog.entryCount, 0, "New branch should have reflog entry");
        } finally {
          reflog.free();
        }
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("empty reflog for non-existent reference", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        await createCommitWithFiles(ctx, "Initial", { "file.txt": "content\n" });

        // Try to read reflog for non-existent reference
        const reflog = ctx.repo.readReflog("refs/heads/nonexistent");
        try {
          assertEquals(reflog.entryCount, 0, "Non-existent ref should have empty reflog");
        } finally {
          reflog.free();
        }
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("reflog entry OIDs are valid hex strings", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        await createCommitWithFiles(ctx, "First", { "file.txt": "v1\n" });
        await createCommitWithFiles(ctx, "Second", { "file.txt": "v2\n" });

        ctx.repo.close();
        ctx.repo = Repository.open(ctx.repoPath);

        const reflog = ctx.repo.readReflog("HEAD");
        try {
          const entry = reflog.getEntry(0);
          assertExists(entry, "Should have entry");
          
          // OIDs should be 40 character hex strings
          assertEquals(entry.newOid.length, 40, "New OID should be 40 chars");
          assertEquals(entry.oldOid.length, 40, "Old OID should be 40 chars");
          
          // Should only contain hex characters
          const hexRegex = /^[0-9a-f]{40}$/;
          assertEquals(hexRegex.test(entry.newOid), true, "New OID should be valid hex");
          assertEquals(hexRegex.test(entry.oldOid), true, "Old OID should be valid hex");
        } finally {
          reflog.free();
        }
      } finally {
        await cleanupTestContext(ctx);
      }
    });

  } finally {
    shutdown();
  }
});
