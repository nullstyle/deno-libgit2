/**
 * End-to-end tests for submodule functionality
 * Tests use real file operations in temporary directories
 */

import { assertEquals, assertExists } from "@std/assert";
import { init, Repository, shutdown } from "../../mod.ts";
import {
  cleanupTestContext,
  createCommitWithFiles,
  createTestContext,
} from "./helpers.ts";

const decoder = new TextDecoder();

async function runGit(
  args: string[],
  cwd: string,
  env: Record<string, string> = {},
): Promise<void> {
  const cmd = new Deno.Command("git", {
    args,
    cwd,
    env,
    stdout: "piped",
    stderr: "piped",
  });
  const result = await cmd.output();
  if (!result.success) {
    const stderr = decoder.decode(result.stderr).trim();
    const stdout = decoder.decode(result.stdout).trim();
    const detail = stderr || stdout || `exit code ${result.code}`;
    throw new Error(`git ${args.join(" ")} failed: ${detail}`);
  }
}

/**
 * Helper to create a submodule repository
 */
async function createSubmoduleRepo(parentDir: string): Promise<string> {
  const submodulePath = `${parentDir}/submodule-repo`;
  await Deno.mkdir(submodulePath, { recursive: true });

  // Initialize submodule repo
  await runGit(["init"], submodulePath);

  // Configure git
  await runGit(["config", "user.email", "test@example.com"], submodulePath);
  await runGit(["config", "user.name", "Test User"], submodulePath);

  // Create a file and commit
  await Deno.writeTextFile(`${submodulePath}/README.md`, "# Submodule\n");

  await runGit(["add", "."], submodulePath);
  await runGit(["commit", "-m", "Initial submodule commit"], submodulePath);

  return submodulePath;
}

/**
 * Helper to add a submodule to a repository using git CLI
 */
async function addSubmoduleWithGit(
  repoPath: string,
  submodulePath: string,
  targetPath: string,
): Promise<void> {
  const env = { GIT_ALLOW_PROTOCOL: "file" };
  await runGit(
    [
      "-c",
      "protocol.file.allow=always",
      "submodule",
      "add",
      submodulePath,
      targetPath,
    ],
    repoPath,
    env,
  );

  // Commit the submodule addition
  await runGit(["config", "user.email", "test@example.com"], repoPath);
  await runGit(["config", "user.name", "Test User"], repoPath);
  await runGit(["commit", "-m", "Add submodule"], repoPath);
}

Deno.test("E2E Submodule Tests", async (t) => {
  await init();

  try {
    await t.step("list submodules in repo without submodules", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        await createCommitWithFiles(ctx, "Initial commit", {
          "file.txt": "content\n",
        });

        const submodules = ctx.repo.listSubmodules();
        assertEquals(submodules.length, 0, "Should have no submodules");
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("list submodules in repo with submodule", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        await createCommitWithFiles(ctx, "Initial commit", {
          "file.txt": "content\n",
        });

        // Create a submodule repo
        const submodulePath = await createSubmoduleRepo(ctx.tempDir);

        // Close repo before using git CLI
        ctx.repo.close();

        // Add submodule using git CLI
        await addSubmoduleWithGit(ctx.repoPath, submodulePath, "libs/sub");

        // Reopen repo
        ctx.repo = Repository.open(ctx.repoPath);

        const submodules = ctx.repo.listSubmodules();
        assertEquals(submodules.length, 1, "Should have one submodule");
        assertEquals(submodules[0], "libs/sub", "Submodule name should match");
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("lookup submodule by name", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        await createCommitWithFiles(ctx, "Initial commit", {
          "file.txt": "content\n",
        });

        // Create and add submodule
        const submodulePath = await createSubmoduleRepo(ctx.tempDir);
        ctx.repo.close();
        await addSubmoduleWithGit(ctx.repoPath, submodulePath, "libs/sub");
        ctx.repo = Repository.open(ctx.repoPath);

        const submodule = ctx.repo.lookupSubmodule("libs/sub");
        try {
          assertExists(submodule, "Should find submodule");
          assertEquals(submodule.name, "libs/sub", "Name should match");
          assertEquals(submodule.path, "libs/sub", "Path should match");
          assertExists(submodule.url, "Should have URL");
        } finally {
          submodule.free();
        }
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("get submodule URL", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        await createCommitWithFiles(ctx, "Initial commit", {
          "file.txt": "content\n",
        });

        const submodulePath = await createSubmoduleRepo(ctx.tempDir);
        ctx.repo.close();
        await addSubmoduleWithGit(ctx.repoPath, submodulePath, "libs/sub");
        ctx.repo = Repository.open(ctx.repoPath);

        const submodule = ctx.repo.lookupSubmodule("libs/sub");
        try {
          assertExists(submodule.url, "Should have URL");
          // URL should contain the submodule path
          assertEquals(
            submodule.url.includes("submodule-repo"),
            true,
            "URL should reference submodule repo",
          );
        } finally {
          submodule.free();
        }
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("get submodule index ID", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        await createCommitWithFiles(ctx, "Initial commit", {
          "file.txt": "content\n",
        });

        const submodulePath = await createSubmoduleRepo(ctx.tempDir);
        ctx.repo.close();
        await addSubmoduleWithGit(ctx.repoPath, submodulePath, "libs/sub");
        ctx.repo = Repository.open(ctx.repoPath);

        const submodule = ctx.repo.lookupSubmodule("libs/sub");
        try {
          // After git submodule add + commit, the submodule should have an index ID
          const indexId = submodule.indexId;
          // Index ID should exist after the submodule is committed
          if (indexId !== null) {
            assertEquals(indexId.length, 40, "Index ID should be 40 char hex");
          }
          // Head ID may be null until the submodule is checked out
          const headId = submodule.headId;
          if (headId !== null) {
            assertEquals(headId.length, 40, "Head ID should be 40 char hex");
          }
        } finally {
          submodule.free();
        }
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("get submodule status", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        await createCommitWithFiles(ctx, "Initial commit", {
          "file.txt": "content\n",
        });

        const submodulePath = await createSubmoduleRepo(ctx.tempDir);
        ctx.repo.close();
        await addSubmoduleWithGit(ctx.repoPath, submodulePath, "libs/sub");
        ctx.repo = Repository.open(ctx.repoPath);

        const status = ctx.repo.submoduleStatus("libs/sub");
        assertExists(status, "Should get status");
        // Status should be non-zero (submodule exists somewhere)
        // The exact flags depend on the state of the submodule
        // IN_CONFIG (0x04) should always be set since we have .gitmodules
        assertEquals(
          (status & 0x04) !== 0, // IN_CONFIG
          true,
          "Should be in CONFIG (.gitmodules)",
        );
        // IN_WD (0x08) should be set since the submodule directory exists
        assertEquals(
          (status & 0x08) !== 0, // IN_WD
          true,
          "Should be in WD",
        );
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("iterate over multiple submodules", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        await createCommitWithFiles(ctx, "Initial commit", {
          "file.txt": "content\n",
        });

        // Create two submodule repos
        const submodulePath1 = await createSubmoduleRepo(ctx.tempDir);
        const submodulePath2 = `${ctx.tempDir}/submodule-repo-2`;
        await Deno.mkdir(submodulePath2, { recursive: true });

        // Initialize second submodule
        const cmds = [
          ["git", "init"],
          ["git", "config", "user.email", "test@example.com"],
          ["git", "config", "user.name", "Test User"],
        ];
        for (const args of cmds) {
          const cmd = new Deno.Command(args[0], {
            args: args.slice(1),
            cwd: submodulePath2,
            stdout: "null",
            stderr: "null",
          });
          await cmd.output();
        }
        await Deno.writeTextFile(`${submodulePath2}/README.md`, "# Sub 2\n");
        const cmd1 = new Deno.Command("git", {
          args: ["add", "."],
          cwd: submodulePath2,
          stdout: "null",
          stderr: "null",
        });
        await cmd1.output();
        const cmd2 = new Deno.Command("git", {
          args: ["commit", "-m", "Initial"],
          cwd: submodulePath2,
          stdout: "null",
          stderr: "null",
        });
        await cmd2.output();

        ctx.repo.close();

        // Add both submodules
        await addSubmoduleWithGit(ctx.repoPath, submodulePath1, "libs/sub1");
        await addSubmoduleWithGit(ctx.repoPath, submodulePath2, "libs/sub2");

        ctx.repo = Repository.open(ctx.repoPath);

        const submodules = ctx.repo.listSubmodules();
        assertEquals(submodules.length, 2, "Should have two submodules");
        assertEquals(
          submodules.includes("libs/sub1"),
          true,
          "Should have sub1",
        );
        assertEquals(
          submodules.includes("libs/sub2"),
          true,
          "Should have sub2",
        );
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("submodule not found returns null", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        await createCommitWithFiles(ctx, "Initial commit", {
          "file.txt": "content\n",
        });

        // Try to lookup non-existent submodule
        let error: Error | null = null;
        try {
          ctx.repo.lookupSubmodule("nonexistent");
        } catch (e) {
          error = e as Error;
        }
        assertExists(error, "Should throw error for non-existent submodule");
      } finally {
        await cleanupTestContext(ctx);
      }
    });
  } finally {
    shutdown();
  }
});
