/**
 * End-to-end tests for rebase functionality
 * Tests use real file operations in temporary directories
 */

import {
  assert,
  assertEquals,
  assertExists,
  assertGreater,
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

Deno.test("E2E Rebase Tests", async (t) => {
  init();

  try {
    await t.step("init rebase with two branches", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        // Create initial commit on main
        await createCommitWithFiles(ctx, "Initial commit", {
          "file.txt": "initial content\n",
        });

        const mainOid = ctx.repo.headOid();

        // Create a feature branch
        ctx.repo.createBranch("feature", mainOid);

        // Add a commit to master
        await createCommitWithFiles(ctx, "Master commit", {
          "master.txt": "master content\n",
        });

        // Switch to feature branch and add commits
        ctx.repo.close();
        const cmd1 = new Deno.Command("git", {
          args: ["checkout", "feature"],
          cwd: ctx.repoPath,
          stdout: "null",
          stderr: "null",
        });
        await cmd1.output();

        ctx.repo = Repository.open(ctx.repoPath);

        await createCommitWithFiles(ctx, "Feature commit 1", {
          "feature1.txt": "feature 1\n",
        });

        await createCommitWithFiles(ctx, "Feature commit 2", {
          "feature2.txt": "feature 2\n",
        });

        // Now we have:
        // main: initial -> main commit
        // feature: initial -> feature1 -> feature2

        // Initialize rebase of feature onto master
        const rebase = ctx.repo.initRebase("feature", "master");
        try {
          assertExists(rebase, "Should create rebase");
          assertGreater(rebase.operationCount, 0, "Should have operations");
        } finally {
          rebase.free();
        }
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("rebase operation count matches commits", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        await createCommitWithFiles(ctx, "Initial commit", {
          "file.txt": "initial\n",
        });

        const mainOid = ctx.repo.headOid();
        ctx.repo.createBranch("feature", mainOid);

        // Add commit to master
        await createCommitWithFiles(ctx, "Master commit", {
          "master.txt": "master\n",
        });

        // Switch to feature and add 3 commits
        ctx.repo.close();
        const cmd = new Deno.Command("git", {
          args: ["checkout", "feature"],
          cwd: ctx.repoPath,
          stdout: "null",
          stderr: "null",
        });
        await cmd.output();
        ctx.repo = Repository.open(ctx.repoPath);

        await createCommitWithFiles(ctx, "Feature 1", { "f1.txt": "1\n" });
        await createCommitWithFiles(ctx, "Feature 2", { "f2.txt": "2\n" });
        await createCommitWithFiles(ctx, "Feature 3", { "f3.txt": "3\n" });

        const rebase = ctx.repo.initRebase("feature", "master");
        try {
          // Should have 3 operations (one per feature commit)
          assertEquals(rebase.operationCount, 3, "Should have 3 operations");
        } finally {
          rebase.free();
        }
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("get rebase operation by index", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        await createCommitWithFiles(ctx, "Initial", { "file.txt": "init\n" });

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

        await createCommitWithFiles(ctx, "Feature", { "feat.txt": "feat\n" });

        const rebase = ctx.repo.initRebase("feature", "master");
        try {
          const op = rebase.getOperation(0);
          assertExists(op, "Should get operation");
          assertExists(op.id, "Operation should have commit ID");
          assertEquals(op.id.length, 40, "ID should be 40 char hex");
        } finally {
          rebase.free();
        }
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("perform rebase next operation", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        await createCommitWithFiles(ctx, "Initial", { "file.txt": "init\n" });

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

        await createCommitWithFiles(ctx, "Feature", { "feat.txt": "feat\n" });

        const rebase = ctx.repo.initRebase("feature", "master");
        try {
          // Perform the first operation
          const op = rebase.next();
          assertExists(op, "Should perform next operation");
        } finally {
          rebase.free();
        }
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("abort rebase", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        await createCommitWithFiles(ctx, "Initial", { "file.txt": "init\n" });

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

        await createCommitWithFiles(ctx, "Feature", { "feat.txt": "feat\n" });

        const rebase = ctx.repo.initRebase("feature", "master");
        try {
          // Abort the rebase
          rebase.abort();
          // Should not throw
        } finally {
          rebase.free();
        }
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("rebase commit creates new commit", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        await createCommitWithFiles(ctx, "Initial", { "file.txt": "init\n" });

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

        await createCommitWithFiles(ctx, "Feature commit", { "feat.txt": "feat\n" });

        const rebase = ctx.repo.initRebase("feature", "master");
        try {
          // Perform the first operation
          const op = rebase.next();
          assertExists(op, "Should have an operation");

          // Commit the rebased changes
          const newOid = rebase.commit({
            committer: { name: "Test Committer", email: "committer@test.com" },
          });
          assertExists(newOid, "Should return new commit OID");
          assert(newOid.length === 40, "OID should be 40 hex chars");

          // Finish the rebase
          rebase.finish();
        } finally {
          rebase.free();
        }
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("rebase finish completes rebase", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        await createCommitWithFiles(ctx, "Initial", { "file.txt": "init\n" });

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

        await createCommitWithFiles(ctx, "Feature", { "feat.txt": "feat\n" });

        const rebase = ctx.repo.initRebase("feature", "master");
        try {
          // Step through all operations
          while (true) {
            const op = rebase.next();
            if (op === null) break;

            // Commit each rebased change
            rebase.commit({
              committer: { name: "Rebaser", email: "rebaser@test.com" },
            });
          }

          // Finish the rebase
          rebase.finish();

          // Verify rebase completed - repo should not be in rebasing state
          assertEquals(ctx.repo.state, 0, "Repo should be in normal state");
        } finally {
          rebase.free();
        }
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("rebase commit with custom message", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        await createCommitWithFiles(ctx, "Initial", { "file.txt": "init\n" });

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

        await createCommitWithFiles(ctx, "Original message", { "feat.txt": "feat\n" });

        const rebase = ctx.repo.initRebase("feature", "master");
        try {
          const op = rebase.next();
          assertExists(op, "Should have an operation");

          // Commit with custom message
          const newOid = rebase.commit({
            committer: { name: "Rebaser", email: "rebaser@test.com" },
            message: "Rewritten commit message",
          });
          assertExists(newOid, "Should return new commit OID");

          rebase.finish();

          // Verify the new commit has the custom message
          const commit = ctx.repo.lookupCommit(newOid);
          assertEquals(commit.message.trim(), "Rewritten commit message");
        } finally {
          rebase.free();
        }
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("rebase operations list", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        await createCommitWithFiles(ctx, "Initial", { "file.txt": "init\n" });

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

        await createCommitWithFiles(ctx, "Feature 1", { "feat1.txt": "feat1\n" });
        await createCommitWithFiles(ctx, "Feature 2", { "feat2.txt": "feat2\n" });

        const rebase = ctx.repo.initRebase("feature", "master");
        try {
          // Get all operations
          const ops = [];
          for (let i = 0; i < rebase.operationCount; i++) {
            const op = rebase.getOperation(i);
            if (op) ops.push(op);
          }
          assertEquals(ops.length, 2, "Should have 2 operations");
          // All operations should be PICK type
          for (const op of ops) {
            assertEquals(op.type, 0, "Operation should be PICK type");
          }
        } finally {
          rebase.abort();
          rebase.free();
        }
      } finally {
        await cleanupTestContext(ctx);
      }
    });

  } finally {
    shutdown();
  }
});
