/**
 * Tests for Repository operations
 */

import { assertEquals, assertExists, assertThrows } from "@std/assert";
import { GitError, type GitLibrary, initGit, Repository } from "../mod.ts";

// Test setup and teardown
let testRepoPath: string;
let _git: GitLibrary;

async function setup() {
  _git = await initGit();
  // Create a temporary directory for test repository
  testRepoPath = Deno.makeTempDirSync({ prefix: "libgit2_test_" });
}

function teardown() {
  try {
    Deno.removeSync(testRepoPath, { recursive: true });
  } catch {
    // Ignore cleanup errors
  }
  _git.shutdown();
}

Deno.test({
  name: "Repository.init creates a new repository",
  async fn() {
    await setup();
    try {
      const repo = Repository.init(testRepoPath);
      assertExists(repo);
      assertEquals(repo.isBare, false);
      assertEquals(repo.isEmpty, true);
      assertExists(repo.path);
      repo.close();
    } finally {
      teardown();
    }
  },
});

Deno.test({
  name: "Repository.init creates a bare repository",
  async fn() {
    await setup();
    try {
      const repo = Repository.init(testRepoPath, true);
      assertExists(repo);
      assertEquals(repo.isBare, true);
      repo.close();
    } finally {
      teardown();
    }
  },
});

Deno.test({
  name: "Repository.open opens an existing repository",
  async fn() {
    await setup();
    try {
      // First create a repository
      const repo1 = Repository.init(testRepoPath);
      repo1.close();

      // Then open it
      const repo2 = Repository.open(testRepoPath);
      assertExists(repo2);
      assertEquals(repo2.isEmpty, true);
      repo2.close();
    } finally {
      teardown();
    }
  },
});

Deno.test({
  name: "Repository.open throws for non-existent path",
  async fn() {
    await setup();
    try {
      assertThrows(
        () => Repository.open("/non/existent/path"),
        GitError,
      );
    } finally {
      teardown();
    }
  },
});

Deno.test({
  name: "Repository.discover finds repository from subdirectory",
  async fn() {
    await setup();
    try {
      // Create repository
      const repo = Repository.init(testRepoPath);
      repo.close();

      // Create subdirectory
      const subdir = `${testRepoPath}/subdir/nested`;
      Deno.mkdirSync(subdir, { recursive: true });

      // Discover from subdirectory
      const discovered = Repository.discover(subdir);
      assertExists(discovered);
    } finally {
      teardown();
    }
  },
});

Deno.test({
  name: "Repository.path returns the .git directory path",
  async fn() {
    await setup();
    try {
      const repo = Repository.init(testRepoPath);
      const path = repo.path;
      assertExists(path);
      assertEquals(path.endsWith(".git/") || path.endsWith(".git"), true);
      repo.close();
    } finally {
      teardown();
    }
  },
});

Deno.test({
  name: "Repository.workdir returns working directory for non-bare repo",
  async fn() {
    await setup();
    try {
      const repo = Repository.init(testRepoPath);
      const workdir = repo.workdir;
      assertExists(workdir);
      repo.close();
    } finally {
      teardown();
    }
  },
});

Deno.test({
  name: "Repository.workdir returns null for bare repo",
  async fn() {
    await setup();
    try {
      const repo = Repository.init(testRepoPath, true);
      const workdir = repo.workdir;
      assertEquals(workdir, null);
      repo.close();
    } finally {
      teardown();
    }
  },
});

Deno.test({
  name: "Repository.listReferences returns empty array for new repo",
  async fn() {
    await setup();
    try {
      const repo = Repository.init(testRepoPath);
      const refs = repo.listReferences();
      assertEquals(refs.length, 0);
      repo.close();
    } finally {
      teardown();
    }
  },
});

Deno.test({
  name: "Repository.listBranches returns empty array for new repo",
  async fn() {
    await setup();
    try {
      const repo = Repository.init(testRepoPath);
      const branches = repo.listBranches();
      assertEquals(branches.length, 0);
      repo.close();
    } finally {
      teardown();
    }
  },
});

Deno.test({
  name: "Repository.status returns empty array for new repo",
  async fn() {
    await setup();
    try {
      const repo = Repository.init(testRepoPath);
      const status = repo.status();
      assertEquals(status.length, 0);
      repo.close();
    } finally {
      teardown();
    }
  },
});

Deno.test({
  name: "Repository.close prevents further operations",
  async fn() {
    await setup();
    try {
      const repo = Repository.init(testRepoPath);
      repo.close();
      assertEquals(repo.isClosed, true);
      assertThrows(() => repo.path, GitError);
    } finally {
      teardown();
    }
  },
});

Deno.test({
  name: "Repository.use provides automatic cleanup",
  async fn() {
    await setup();
    try {
      // Create repository first
      const repo1 = Repository.init(testRepoPath);
      repo1.close();

      // Use with automatic cleanup
      const result = Repository.use(testRepoPath, (repo) => {
        return repo.isEmpty;
      });
      assertEquals(result, true);
    } finally {
      teardown();
    }
  },
});
