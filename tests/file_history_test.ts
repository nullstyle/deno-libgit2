/**
 * Tests for Tree, Blob, and File History operations
 */

import { assertEquals, assertExists } from "@std/assert";
import {
  Blob,
  createCommit,
  fileExistsAtCommit,
  fileExistsAtHead,
  findFileCreation,
  findFileDeletion,
  findFileHistory,
  getFileAtHead,
  getFileContent,
  Index,
  init,
  Repository,
  shutdown,
  Tree,
  treeHasPath,
} from "../mod.ts";

// Test setup and teardown
let testRepoPath: string;

async function setup() {
  await init();
  testRepoPath = Deno.makeTempDirSync({ prefix: "libgit2_file_test_" });
}

function teardown() {
  try {
    Deno.removeSync(testRepoPath, { recursive: true });
  } catch {
    // Ignore cleanup errors
  }
  shutdown();
}

/**
 * Helper to create a test repository with some commits
 */
function createTestRepo(): Repository {
  const repo = Repository.init(testRepoPath);
  return repo;
}

/**
 * Helper to create a file and commit it
 */
function createFileAndCommit(
  repo: Repository,
  filePath: string,
  content: string,
  message: string,
): string {
  const fullPath = `${testRepoPath}/${filePath}`;

  // Create directory if needed
  const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
  if (dir && dir !== testRepoPath) {
    Deno.mkdirSync(dir, { recursive: true });
  }

  Deno.writeTextFileSync(fullPath, content);

  const index = Index.fromRepository(repo);
  index.add(filePath);
  index.write();

  const oid = createCommit(repo, {
    message,
    author: { name: "Test", email: "test@example.com" },
  });

  index.close();
  return oid;
}

/**
 * Helper to delete a file and commit
 */
function deleteFileAndCommit(
  repo: Repository,
  filePath: string,
  message: string,
): string {
  const fullPath = `${testRepoPath}/${filePath}`;
  Deno.removeSync(fullPath);

  const index = Index.fromRepository(repo);
  index.remove(filePath);
  index.write();

  const oid = createCommit(repo, {
    message,
    author: { name: "Test", email: "test@example.com" },
  });

  index.close();
  return oid;
}

// ============================================================
// Tree Tests
// ============================================================

Deno.test({
  name: "Tree: lookup tree by OID",
  async fn() {
    await setup();
    try {
      const repo = createTestRepo();
      createFileAndCommit(repo, "test.txt", "Hello", "Initial commit");

      const commit = repo.lookupCommit(repo.headOid());
      const tree = Tree.lookup(repo, commit.treeOid);

      assertExists(tree);
      assertEquals(tree.entryCount, 1);

      tree.close();
      repo.close();
    } finally {
      teardown();
    }
  },
});

Deno.test({
  name: "Tree: entry by name",
  async fn() {
    await setup();
    try {
      const repo = createTestRepo();
      createFileAndCommit(repo, "test.txt", "Hello", "Initial commit");

      const commit = repo.lookupCommit(repo.headOid());
      const tree = Tree.lookup(repo, commit.treeOid);

      const entry = tree.getByName("test.txt");
      assertExists(entry);
      assertEquals(entry.name, "test.txt");
      assertEquals(entry.isBlob, true);

      tree.close();
      repo.close();
    } finally {
      teardown();
    }
  },
});

Deno.test({
  name: "Tree: entry by path (nested)",
  async fn() {
    await setup();
    try {
      const repo = createTestRepo();
      createFileAndCommit(
        repo,
        "src/lib/file.ts",
        "export const x = 1;",
        "Add file",
      );

      const commit = repo.lookupCommit(repo.headOid());
      const tree = Tree.lookup(repo, commit.treeOid);

      const entry = tree.getByPath("src/lib/file.ts");
      assertExists(entry);
      assertEquals(entry.name, "file.ts");
      assertEquals(entry.isBlob, true);

      entry.free(); // byPath returns owned entry
      tree.close();
      repo.close();
    } finally {
      teardown();
    }
  },
});

Deno.test({
  name: "Tree: hasPath",
  async fn() {
    await setup();
    try {
      const repo = createTestRepo();
      createFileAndCommit(repo, "docs/readme.md", "# Docs", "Add docs");

      const commit = repo.lookupCommit(repo.headOid());
      const tree = Tree.lookup(repo, commit.treeOid);

      assertEquals(tree.hasPath("docs/readme.md"), true);
      assertEquals(tree.hasPath("nonexistent.txt"), false);

      tree.close();
      repo.close();
    } finally {
      teardown();
    }
  },
});

Deno.test({
  name: "Tree: treeHasPath function",
  async fn() {
    await setup();
    try {
      const repo = createTestRepo();
      createFileAndCommit(repo, "file.txt", "content", "Add file");

      const commit = repo.lookupCommit(repo.headOid());

      assertEquals(treeHasPath(repo, commit.treeOid, "file.txt"), true);
      assertEquals(treeHasPath(repo, commit.treeOid, "other.txt"), false);

      repo.close();
    } finally {
      teardown();
    }
  },
});

// ============================================================
// Blob Tests
// ============================================================

Deno.test({
  name: "Blob: lookup and content",
  async fn() {
    await setup();
    try {
      const repo = createTestRepo();
      const content = "Hello, World!";
      createFileAndCommit(repo, "test.txt", content, "Add file");

      const commit = repo.lookupCommit(repo.headOid());
      const tree = Tree.lookup(repo, commit.treeOid);
      const entry = tree.getByName("test.txt");

      assertExists(entry);

      const blob = Blob.lookup(repo, entry.oid);
      assertEquals(blob.content(), content);
      assertEquals(blob.size, content.length);
      assertEquals(blob.isBinary, false);

      blob.close();
      tree.close();
      repo.close();
    } finally {
      teardown();
    }
  },
});

Deno.test({
  name: "Blob: getFileContent",
  async fn() {
    await setup();
    try {
      const repo = createTestRepo();
      const content = "File content here";
      createFileAndCommit(repo, "data/file.txt", content, "Add file");

      const commit = repo.lookupCommit(repo.headOid());
      const retrieved = getFileContent(repo, commit.treeOid, "data/file.txt");

      assertEquals(retrieved, content);

      repo.close();
    } finally {
      teardown();
    }
  },
});

Deno.test({
  name: "File History: fileExistsAtCommit",
  async fn() {
    await setup();
    try {
      const repo = createTestRepo();
      const oid1 = createFileAndCommit(repo, "file.txt", "v1", "Add file");

      assertEquals(fileExistsAtCommit(repo, oid1, "file.txt"), true);
      assertEquals(fileExistsAtCommit(repo, oid1, "other.txt"), false);

      repo.close();
    } finally {
      teardown();
    }
  },
});

// ============================================================
// File History Tests
// ============================================================

Deno.test({
  name: "File History: findFileHistory",
  async fn() {
    await setup();
    try {
      const repo = createTestRepo();

      // Create file and modify it
      createFileAndCommit(repo, "doc.md", "Version 1", "Create doc");
      createFileAndCommit(repo, "doc.md", "Version 2", "Update doc");
      createFileAndCommit(repo, "doc.md", "Version 3", "Update doc again");

      const history = findFileHistory(repo, "doc.md");

      assertEquals(history.commits.length, 3);
      assertEquals(history.currentlyExists, true);
      assertExists(history.lastContent);
      assertEquals(history.lastContent, "Version 3");

      repo.close();
    } finally {
      teardown();
    }
  },
});

Deno.test({
  name: "File History: findFileDeletion",
  async fn() {
    await setup();
    try {
      const repo = createTestRepo();

      // Create file, then delete it
      createFileAndCommit(
        repo,
        "temp.txt",
        "Temporary content",
        "Add temp file",
      );
      createFileAndCommit(repo, "other.txt", "Other file", "Add other file");
      deleteFileAndCommit(repo, "temp.txt", "Remove temp file");

      const deletion = findFileDeletion(repo, "temp.txt");

      assertExists(deletion);
      assertEquals(deletion.deletedInCommit.message, "Remove temp file");
      assertEquals(deletion.lastExistedInCommit.message, "Add other file");
      assertEquals(deletion.lastContent, "Temporary content");

      repo.close();
    } finally {
      teardown();
    }
  },
});

Deno.test({
  name: "File History: findFileDeletion returns null for existing file",
  async fn() {
    await setup();
    try {
      const repo = createTestRepo();
      createFileAndCommit(repo, "exists.txt", "I exist", "Add file");

      const deletion = findFileDeletion(repo, "exists.txt");

      assertEquals(deletion, null);

      repo.close();
    } finally {
      teardown();
    }
  },
});

Deno.test({
  name: "File History: findFileCreation",
  async fn() {
    await setup();
    try {
      const repo = createTestRepo();

      createFileAndCommit(repo, "first.txt", "First", "First commit");
      createFileAndCommit(repo, "second.txt", "Second", "Add second file");
      createFileAndCommit(repo, "second.txt", "Updated", "Update second file");

      const creation = findFileCreation(repo, "second.txt");

      assertExists(creation);
      assertEquals(creation.message, "Add second file");

      repo.close();
    } finally {
      teardown();
    }
  },
});

Deno.test({
  name: "File History: fileExistsAtHead",
  async fn() {
    await setup();
    try {
      const repo = createTestRepo();
      createFileAndCommit(repo, "present.txt", "Here", "Add file");

      assertEquals(fileExistsAtHead(repo, "present.txt"), true);
      assertEquals(fileExistsAtHead(repo, "absent.txt"), false);

      repo.close();
    } finally {
      teardown();
    }
  },
});

Deno.test({
  name: "File History: getFileAtHead",
  async fn() {
    await setup();
    try {
      const repo = createTestRepo();
      const content = "Current content";
      createFileAndCommit(repo, "current.txt", content, "Add file");

      assertEquals(getFileAtHead(repo, "current.txt"), content);
      assertEquals(getFileAtHead(repo, "missing.txt"), null);

      repo.close();
    } finally {
      teardown();
    }
  },
});

// ============================================================
// Integration Test: Wiki Block Scenario
// ============================================================

Deno.test({
  name: "Integration: Wiki block lifecycle",
  async fn() {
    await setup();
    try {
      const repo = createTestRepo();

      // Simulate wiki block lifecycle
      const blockId = "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b";
      const blockPath = `.dork/blocks/${blockId}.md`;
      const blockContent =
        `# Block Title\n\nThis is block content.\n\n[[link-to-other-block]]`;

      // Create the block
      createFileAndCommit(repo, blockPath, blockContent, "Create block");

      // Update the block
      const updatedContent = blockContent + "\n\nUpdated content.";
      createFileAndCommit(repo, blockPath, updatedContent, "Update block");

      // Create another file
      createFileAndCommit(
        repo,
        ".dork/blocks/other-block.md",
        "Other block",
        "Add other block",
      );

      // Delete the original block
      deleteFileAndCommit(repo, blockPath, "Delete block");

      // Now find the deletion
      const deletion = findFileDeletion(repo, blockPath);

      assertExists(deletion);
      assertEquals(deletion.deletedInCommit.message, "Delete block");
      assertEquals(deletion.lastContent, updatedContent);

      // Find full history
      const history = findFileHistory(repo, blockPath);
      assertEquals(history.commits.length, 3); // create, update, other (block still existed)
      assertEquals(history.currentlyExists, false);

      repo.close();
    } finally {
      teardown();
    }
  },
});
