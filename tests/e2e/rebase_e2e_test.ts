/**
 * End-to-end tests for rebase functionality
 *
 * These tests validate rebase functionality including:
 * - Initializing rebases
 * - Operation count and iteration
 * - Getting operations by index
 * - Performing next operations
 * - Committing with various options
 * - Aborting rebases
 * - Finishing rebases
 * - Symbol.dispose support
 * - Error handling
 */

import {
  assert,
  assertEquals,
  assertExists,
  assertGreater,
  assertThrows,
} from "@std/assert";
import { init, Repository, shutdown } from "../../mod.ts";
import { GitRebaseOperationType } from "../../src/rebase.ts";
import { createCommitWithFiles, createTestContext } from "./helpers.ts";

/**
 * Helper to create a standard rebase scenario:
 * - Initial commit on main
 * - Main branch advances
 * - Feature branch with commits to rebase
 */
async function setupRebaseScenario(
  ctx: Awaited<ReturnType<typeof createTestContext>>,
  featureCommits: number = 1,
) {
  // Create initial commit on main
  await createCommitWithFiles(ctx, "Initial commit", {
    "file.txt": "initial content\n",
  });

  const mainOid = ctx.repo.headOid();

  // Create a feature branch at this point
  ctx.repo.createBranch("feature", mainOid);

  // Add a commit to master
  await createCommitWithFiles(ctx, "Master commit", {
    "master.txt": "master content\n",
  });

  // Switch to feature branch using git command
  ctx.repo.close();
  const cmd = new Deno.Command("git", {
    args: ["checkout", "feature"],
    cwd: ctx.repoPath,
    stdout: "null",
    stderr: "null",
  });
  await cmd.output();

  ctx.repo = Repository.open(ctx.repoPath);

  // Add commits to feature branch
  for (let i = 1; i <= featureCommits; i++) {
    await createCommitWithFiles(ctx, `Feature commit ${i}`, {
      [`feature${i}.txt`]: `feature ${i}\n`,
    });
  }
}

Deno.test("E2E Rebase Tests", async (t) => {
  await init();

  try {
    // ==================== Init Rebase Tests ====================

    await t.step("init rebase with two branches", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await setupRebaseScenario(ctx, 2);

      const rebase = ctx.repo.initRebase("feature", "master");
      try {
        assertExists(rebase, "Should create rebase");
        assertGreater(rebase.operationCount, 0, "Should have operations");
      } finally {
        rebase.free();
      }
    });

    await t.step("init rebase returns valid pointer", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await setupRebaseScenario(ctx, 1);

      const rebase = ctx.repo.initRebase("feature", "master");
      try {
        assertExists(rebase.pointer);
      } finally {
        rebase.free();
      }
    });

    // ==================== Operation Count Tests ====================

    await t.step("rebase operation count matches commits", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await setupRebaseScenario(ctx, 3);

      const rebase = ctx.repo.initRebase("feature", "master");
      try {
        assertEquals(rebase.operationCount, 3, "Should have 3 operations");
      } finally {
        rebase.free();
      }
    });

    await t.step("rebase with single commit has one operation", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await setupRebaseScenario(ctx, 1);

      const rebase = ctx.repo.initRebase("feature", "master");
      try {
        assertEquals(rebase.operationCount, 1, "Should have 1 operation");
      } finally {
        rebase.free();
      }
    });

    // ==================== Current Operation Tests ====================

    await t.step("currentOperation returns initial state", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await setupRebaseScenario(ctx, 2);

      const rebase = ctx.repo.initRebase("feature", "master");
      try {
        // Before any next() call, currentOperation may return SIZE_MAX or 0
        const current = rebase.currentOperation;
        assertEquals(typeof current, "number");
      } finally {
        rebase.free();
      }
    });

    await t.step("currentOperation updates after next", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await setupRebaseScenario(ctx, 2);

      const rebase = ctx.repo.initRebase("feature", "master");
      try {
        rebase.next();
        const current = rebase.currentOperation;
        assertEquals(
          current,
          0,
          "Current operation should be 0 after first next",
        );
      } finally {
        rebase.abort();
        rebase.free();
      }
    });

    // ==================== Get Operation Tests ====================

    await t.step("get rebase operation by index", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await setupRebaseScenario(ctx, 1);

      const rebase = ctx.repo.initRebase("feature", "master");
      try {
        const op = rebase.getOperation(0);
        assertExists(op, "Should get operation");
        assertExists(op.id, "Operation should have commit ID");
        assertEquals(op.id.length, 40, "ID should be 40 char hex");
        assertEquals(
          op.type,
          GitRebaseOperationType.PICK,
          "Should be PICK type",
        );
      } finally {
        rebase.free();
      }
    });

    await t.step("get operation returns null for invalid index", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await setupRebaseScenario(ctx, 1);

      const rebase = ctx.repo.initRebase("feature", "master");
      try {
        const op = rebase.getOperation(999);
        assertEquals(op, null, "Should return null for invalid index");
      } finally {
        rebase.free();
      }
    });

    await t.step("get operation returns null for negative index", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await setupRebaseScenario(ctx, 1);

      const rebase = ctx.repo.initRebase("feature", "master");
      try {
        const op = rebase.getOperation(-1);
        assertEquals(op, null, "Should return null for negative index");
      } finally {
        rebase.free();
      }
    });

    await t.step("get all operations by index", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await setupRebaseScenario(ctx, 3);

      const rebase = ctx.repo.initRebase("feature", "master");
      try {
        const ops = [];
        for (let i = 0; i < rebase.operationCount; i++) {
          const op = rebase.getOperation(i);
          if (op) ops.push(op);
        }
        assertEquals(ops.length, 3, "Should have 3 operations");

        // All operations should be PICK type and have valid IDs
        for (const op of ops) {
          assertEquals(op.type, GitRebaseOperationType.PICK);
          assertEquals(op.id.length, 40);
          assertEquals(op.exec, null); // PICK operations don't have exec
        }
      } finally {
        rebase.abort();
        rebase.free();
      }
    });

    // ==================== Next Operation Tests ====================

    await t.step("perform rebase next operation", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await setupRebaseScenario(ctx, 1);

      const rebase = ctx.repo.initRebase("feature", "master");
      try {
        const op = rebase.next();
        assertExists(op, "Should perform next operation");
        assertExists(op.id);
        assertEquals(op.type, GitRebaseOperationType.PICK);
      } finally {
        rebase.abort();
        rebase.free();
      }
    });

    await t.step("next returns null when no more operations", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await setupRebaseScenario(ctx, 1);

      const rebase = ctx.repo.initRebase("feature", "master");
      try {
        // First operation
        const op1 = rebase.next();
        assertExists(op1);

        // Commit the operation
        rebase.commit({
          committer: { name: "Test", email: "test@test.com" },
        });

        // No more operations
        const op2 = rebase.next();
        assertEquals(op2, null, "Should return null when no more operations");

        rebase.finish();
      } finally {
        rebase.free();
      }
    });

    await t.step("iterate through multiple operations with next", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await setupRebaseScenario(ctx, 3);

      const rebase = ctx.repo.initRebase("feature", "master");
      try {
        let count = 0;
        while (true) {
          const op = rebase.next();
          if (op === null) break;
          count++;

          rebase.commit({
            committer: { name: "Rebaser", email: "rebaser@test.com" },
          });
        }
        assertEquals(count, 3, "Should process 3 operations");

        rebase.finish();
      } finally {
        rebase.free();
      }
    });

    // ==================== Commit Tests ====================

    await t.step("rebase commit creates new commit", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await setupRebaseScenario(ctx, 1);

      const rebase = ctx.repo.initRebase("feature", "master");
      try {
        const op = rebase.next();
        assertExists(op);

        const newOid = rebase.commit({
          committer: { name: "Test Committer", email: "committer@test.com" },
        });
        assertExists(newOid, "Should return new commit OID");
        assertEquals(newOid.length, 40, "OID should be 40 hex chars");

        rebase.finish();
      } finally {
        rebase.free();
      }
    });

    await t.step("rebase commit with custom message", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await setupRebaseScenario(ctx, 1);

      const rebase = ctx.repo.initRebase("feature", "master");
      try {
        const op = rebase.next();
        assertExists(op);

        const newOid = rebase.commit({
          committer: { name: "Rebaser", email: "rebaser@test.com" },
          message: "Rewritten commit message",
        });
        assertExists(newOid);

        rebase.finish();

        // Verify the new commit has the custom message
        const commit = ctx.repo.lookupCommit(newOid);
        assertEquals(commit.message.trim(), "Rewritten commit message");
      } finally {
        rebase.free();
      }
    });

    await t.step("rebase commit with custom author", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await setupRebaseScenario(ctx, 1);

      const rebase = ctx.repo.initRebase("feature", "master");
      try {
        const op = rebase.next();
        assertExists(op);

        const newOid = rebase.commit({
          author: { name: "Custom Author", email: "author@custom.com" },
          committer: { name: "Committer", email: "committer@test.com" },
        });
        assertExists(newOid);

        rebase.finish();

        // Verify the new commit has the custom author
        const commit = ctx.repo.lookupCommit(newOid);
        assertEquals(commit.author.name, "Custom Author");
        assertEquals(commit.author.email, "author@custom.com");
      } finally {
        rebase.free();
      }
    });

    await t.step("rebase commit with message encoding", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await setupRebaseScenario(ctx, 1);

      const rebase = ctx.repo.initRebase("feature", "master");
      try {
        const op = rebase.next();
        assertExists(op);

        const newOid = rebase.commit({
          committer: { name: "Rebaser", email: "rebaser@test.com" },
          message: "Message with encoding",
          messageEncoding: "UTF-8",
        });
        assertExists(newOid);
        assertEquals(newOid.length, 40);

        rebase.finish();
      } finally {
        rebase.free();
      }
    });

    await t.step("rebase commit with author and message", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await setupRebaseScenario(ctx, 1);

      const rebase = ctx.repo.initRebase("feature", "master");
      try {
        const op = rebase.next();
        assertExists(op);

        const newOid = rebase.commit({
          author: { name: "Author Name", email: "author@example.com" },
          committer: { name: "Committer Name", email: "committer@example.com" },
          message: "Custom message with custom author",
        });
        assertExists(newOid);

        rebase.finish();

        const commit = ctx.repo.lookupCommit(newOid);
        assertEquals(commit.author.name, "Author Name");
        assertEquals(
          commit.message.trim(),
          "Custom message with custom author",
        );
      } finally {
        rebase.free();
      }
    });

    // ==================== Abort Tests ====================

    await t.step("abort rebase", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await setupRebaseScenario(ctx, 1);

      const rebase = ctx.repo.initRebase("feature", "master");
      try {
        rebase.abort();
        // Should not throw
      } finally {
        rebase.free();
      }
    });

    await t.step("abort rebase after next", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await setupRebaseScenario(ctx, 2);

      const rebase = ctx.repo.initRebase("feature", "master");
      try {
        rebase.next();
        rebase.abort();

        // Repo should be back to normal state
        assertEquals(ctx.repo.state, 0, "Repo should be in normal state");
      } finally {
        rebase.free();
      }
    });

    await t.step("abort rebase after partial completion", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await setupRebaseScenario(ctx, 3);

      const rebase = ctx.repo.initRebase("feature", "master");
      try {
        // Complete first operation
        rebase.next();
        rebase.commit({
          committer: { name: "Test", email: "test@test.com" },
        });

        // Start second operation
        rebase.next();

        // Abort
        rebase.abort();

        assertEquals(ctx.repo.state, 0, "Repo should be in normal state");
      } finally {
        rebase.free();
      }
    });

    // ==================== Finish Tests ====================

    await t.step("rebase finish completes rebase", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await setupRebaseScenario(ctx, 1);

      const rebase = ctx.repo.initRebase("feature", "master");
      try {
        while (true) {
          const op = rebase.next();
          if (op === null) break;

          rebase.commit({
            committer: { name: "Rebaser", email: "rebaser@test.com" },
          });
        }

        rebase.finish();
        assertEquals(ctx.repo.state, 0, "Repo should be in normal state");
      } finally {
        rebase.free();
      }
    });

    await t.step("rebase finish with signature", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await setupRebaseScenario(ctx, 1);

      const rebase = ctx.repo.initRebase("feature", "master");
      try {
        while (true) {
          const op = rebase.next();
          if (op === null) break;

          rebase.commit({
            committer: { name: "Rebaser", email: "rebaser@test.com" },
          });
        }

        // Finish with a signature for the reflog
        rebase.finish({ name: "Finisher", email: "finisher@test.com" });
        assertEquals(ctx.repo.state, 0);
      } finally {
        rebase.free();
      }
    });

    await t.step("rebase finish without signature", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await setupRebaseScenario(ctx, 1);

      const rebase = ctx.repo.initRebase("feature", "master");
      try {
        while (true) {
          const op = rebase.next();
          if (op === null) break;

          rebase.commit({
            committer: { name: "Rebaser", email: "rebaser@test.com" },
          });
        }

        // Finish without signature
        rebase.finish();
        assertEquals(ctx.repo.state, 0);
      } finally {
        rebase.free();
      }
    });

    // ==================== Symbol.dispose Tests ====================

    await t.step("rebase supports Symbol.dispose", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await setupRebaseScenario(ctx, 1);

      {
        using rebase = ctx.repo.initRebase("feature", "master");
        assertExists(rebase);
        assertEquals(rebase.operationCount, 1);
        rebase.abort();
      }
      // Rebase should be disposed when scope exits
    });

    await t.step("rebase close is alias for free", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await setupRebaseScenario(ctx, 1);

      const rebase = ctx.repo.initRebase("feature", "master");
      rebase.abort();
      rebase.close();

      // Should throw when accessing after close
      assertThrows(
        () => rebase.operationCount,
        Error,
        "Rebase has been freed",
      );
    });

    await t.step("rebase free is idempotent", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await setupRebaseScenario(ctx, 1);

      const rebase = ctx.repo.initRebase("feature", "master");
      rebase.abort();

      rebase.free();
      rebase.free();
      rebase.free();
      // Should not throw
    });

    // ==================== Error Handling Tests ====================

    await t.step(
      "throws when accessing operationCount after free",
      async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });
        await setupRebaseScenario(ctx, 1);

        const rebase = ctx.repo.initRebase("feature", "master");
        rebase.abort();
        rebase.free();

        assertThrows(
          () => rebase.operationCount,
          Error,
          "Rebase has been freed",
        );
      },
    );

    await t.step(
      "throws when accessing currentOperation after free",
      async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });
        await setupRebaseScenario(ctx, 1);

        const rebase = ctx.repo.initRebase("feature", "master");
        rebase.abort();
        rebase.free();

        assertThrows(
          () => rebase.currentOperation,
          Error,
          "Rebase has been freed",
        );
      },
    );

    await t.step("throws when calling getOperation after free", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await setupRebaseScenario(ctx, 1);

      const rebase = ctx.repo.initRebase("feature", "master");
      rebase.abort();
      rebase.free();

      assertThrows(
        () => rebase.getOperation(0),
        Error,
        "Rebase has been freed",
      );
    });

    await t.step("throws when calling next after free", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await setupRebaseScenario(ctx, 1);

      const rebase = ctx.repo.initRebase("feature", "master");
      rebase.abort();
      rebase.free();

      assertThrows(
        () => rebase.next(),
        Error,
        "Rebase has been freed",
      );
    });

    await t.step("throws when calling commit after free", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await setupRebaseScenario(ctx, 1);

      const rebase = ctx.repo.initRebase("feature", "master");
      rebase.abort();
      rebase.free();

      assertThrows(
        () =>
          rebase.commit({
            committer: { name: "Test", email: "test@test.com" },
          }),
        Error,
        "Rebase has been freed",
      );
    });

    await t.step("throws when calling abort after free", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await setupRebaseScenario(ctx, 1);

      const rebase = ctx.repo.initRebase("feature", "master");
      rebase.abort();
      rebase.free();

      assertThrows(
        () => rebase.abort(),
        Error,
        "Rebase has been freed",
      );
    });

    await t.step("throws when calling finish after free", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await setupRebaseScenario(ctx, 1);

      const rebase = ctx.repo.initRebase("feature", "master");
      rebase.abort();
      rebase.free();

      assertThrows(
        () => rebase.finish(),
        Error,
        "Rebase has been freed",
      );
    });

    // ==================== Open Rebase Tests ====================

    await t.step("open existing rebase operation", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await setupRebaseScenario(ctx, 2);

      // Start a rebase
      const rebase1 = ctx.repo.initRebase("feature", "master");
      rebase1.next();
      rebase1.free();

      // Open the existing rebase
      const rebase2 = ctx.repo.openRebase();
      try {
        assertExists(rebase2);
        assertGreater(rebase2.operationCount, 0);
      } finally {
        rebase2.abort();
        rebase2.free();
      }
    });

    // ==================== Edge Cases ====================

    await t.step("rebase with many commits", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });

      // Create initial commit
      await createCommitWithFiles(ctx, "Initial", { "init.txt": "init\n" });
      const mainOid = ctx.repo.headOid();
      ctx.repo.createBranch("feature", mainOid);

      await createCommitWithFiles(ctx, "Master", { "master.txt": "master\n" });

      ctx.repo.close();
      const cmd = new Deno.Command("git", {
        args: ["checkout", "feature"],
        cwd: ctx.repoPath,
        stdout: "null",
        stderr: "null",
      });
      await cmd.output();
      ctx.repo = Repository.open(ctx.repoPath);

      // Add 5 commits
      for (let i = 1; i <= 5; i++) {
        await createCommitWithFiles(ctx, `Feature ${i}`, {
          [`f${i}.txt`]: `${i}\n`,
        });
      }

      const rebase = ctx.repo.initRebase("feature", "master");
      try {
        assertEquals(rebase.operationCount, 5);

        let completed = 0;
        while (true) {
          const op = rebase.next();
          if (op === null) break;

          rebase.commit({
            committer: { name: "Rebaser", email: "rebaser@test.com" },
          });
          completed++;
        }

        assertEquals(completed, 5);
        rebase.finish();
      } finally {
        rebase.free();
      }
    });

    await t.step("rebase operation exec field is null for PICK", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await setupRebaseScenario(ctx, 1);

      const rebase = ctx.repo.initRebase("feature", "master");
      try {
        const op = rebase.getOperation(0);
        assertExists(op);
        assertEquals(op.exec, null, "PICK operations should have null exec");
      } finally {
        rebase.abort();
        rebase.free();
      }
    });

    await t.step("rebase preserves commit content", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });

      // Create specific content to verify
      await createCommitWithFiles(ctx, "Initial", { "init.txt": "init\n" });
      const mainOid = ctx.repo.headOid();
      ctx.repo.createBranch("feature", mainOid);

      await createCommitWithFiles(ctx, "Master", { "master.txt": "master\n" });

      ctx.repo.close();
      const cmd = new Deno.Command("git", {
        args: ["checkout", "feature"],
        cwd: ctx.repoPath,
        stdout: "null",
        stderr: "null",
      });
      await cmd.output();
      ctx.repo = Repository.open(ctx.repoPath);

      await createCommitWithFiles(ctx, "Feature with content", {
        "feature.txt": "specific feature content\n",
      });

      const rebase = ctx.repo.initRebase("feature", "master");
      try {
        const op = rebase.next();
        assertExists(op);

        const newOid = rebase.commit({
          committer: { name: "Rebaser", email: "rebaser@test.com" },
        });

        rebase.finish();

        // Verify the file exists in the new commit
        const content = await Deno.readTextFile(
          `${ctx.repoPath}/feature.txt`,
        );
        assertEquals(content, "specific feature content\n");
      } finally {
        rebase.free();
      }
    });
  } finally {
    shutdown();
  }
});
