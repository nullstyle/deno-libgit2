/**
 * End-to-end tests for File History Tracking
 *
 * These tests validate the file history tracking functionality,
 * specifically designed for the wiki/dork blocks use case where
 * we need to track deleted files and retrieve their history.
 */

import {
  setupLibrary,
  teardownLibrary,
  withTestContext,
  createCommitWithFiles,
  createCommitWithDeletions,
} from "./helpers.ts";
import {
  Tree,
  Blob,
  getFileContent,
  fileExistsAtCommit,
  findFileHistory,
  findFileDeletion,
  findFileCreation,
  findFileModifications,
  fileExistsAtHead,
  getFileAtHead,
} from "../../mod.ts";
import { assertEquals, assertExists } from "@std/assert";

Deno.test({
  name: "E2E File History Tests",
  async fn(t) {
    setupLibrary();

    await t.step("Tree.hasPath detects existing file", async () => {
      await withTestContext({}, async (ctx) => {
        await createCommitWithFiles(ctx, "Add file", {
          "docs/readme.md": "# Documentation",
        });

        const commits = Array.from(ctx.repo.walkCommits());
        const tree = Tree.lookup(ctx.repo, commits[0].treeOid);

        assertEquals(tree.hasPath("docs/readme.md"), true);
        assertEquals(tree.hasPath("docs/nonexistent.md"), false);

        tree.close();
      });
    });

    await t.step("Tree.getByPath retrieves nested entry", async () => {
      await withTestContext({}, async (ctx) => {
        await createCommitWithFiles(ctx, "Add nested file", {
          "src/lib/utils.ts": "export function helper() {}",
        });

        const commits = Array.from(ctx.repo.walkCommits());
        const tree = Tree.lookup(ctx.repo, commits[0].treeOid);

        const entry = tree.getByPath("src/lib/utils.ts");
        assertExists(entry);
        assertEquals(entry.name, "utils.ts");

        entry.free();
        tree.close();
      });
    });

    await t.step("Blob.lookup retrieves file content", async () => {
      await withTestContext({}, async (ctx) => {
        const content = "Hello, World!\nThis is test content.";
        await createCommitWithFiles(ctx, "Add file", {
          "test.txt": content,
        });

        const commits = Array.from(ctx.repo.walkCommits());
        const tree = Tree.lookup(ctx.repo, commits[0].treeOid);
        const entry = tree.getByPath("test.txt");
        assertExists(entry);

        const blob = Blob.lookup(ctx.repo, entry.oid);
        assertEquals(blob.content(), content);
        assertEquals(blob.size, content.length);
        assertEquals(blob.isBinary, false);

        blob.close();
        entry.free();
        tree.close();
      });
    });

    await t.step("getFileContent retrieves file from tree OID", async () => {
      await withTestContext({}, async (ctx) => {
        const content = "File content for testing";
        await createCommitWithFiles(ctx, "Add file", {
          "data/file.txt": content,
        });

        const commits = Array.from(ctx.repo.walkCommits());
        const fileContent = getFileContent(ctx.repo, commits[0].treeOid, "data/file.txt");

        assertEquals(fileContent, content);
      });
    });

    await t.step("fileExistsAtCommit checks file existence at specific commit", async () => {
      await withTestContext({}, async (ctx) => {
        // Commit 1: Add file
        const commit1 = await createCommitWithFiles(ctx, "Add file", {
          "file.txt": "content",
        });

        // Commit 2: Add another file
        const commit2 = await createCommitWithFiles(ctx, "Add another", {
          "other.txt": "other content",
        });

        // Check file existence at both commits
        assertEquals(fileExistsAtCommit(ctx.repo, commit1, "file.txt"), true);
        assertEquals(fileExistsAtCommit(ctx.repo, commit1, "other.txt"), false);
        assertEquals(fileExistsAtCommit(ctx.repo, commit2, "file.txt"), true);
        assertEquals(fileExistsAtCommit(ctx.repo, commit2, "other.txt"), true);
      });
    });

    await t.step("findFileHistory returns all commits containing file", async () => {
      await withTestContext({}, async (ctx) => {
        // Commit 1: Add file
        await createCommitWithFiles(ctx, "Add file", {
          "tracked.txt": "version 1",
        });

        // Commit 2: Modify file
        await createCommitWithFiles(ctx, "Modify file", {
          "tracked.txt": "version 2",
        });

        // Commit 3: Add unrelated file
        await createCommitWithFiles(ctx, "Add other", {
          "other.txt": "other",
        });

        // Commit 4: Modify tracked file again
        await createCommitWithFiles(ctx, "Modify again", {
          "tracked.txt": "version 3",
        });

        const history = findFileHistory(ctx.repo, "tracked.txt");

        assertEquals(history.commits.length, 4, "File should appear in all 4 commits");
        assertEquals(history.currentlyExists, true);
      });
    });

    await t.step("findFileDeletion detects when file was deleted", async () => {
      await withTestContext({}, async (ctx) => {
        // Commit 1: Add file
        await createCommitWithFiles(ctx, "Add file", {
          "to-delete.txt": "this will be deleted",
        });

        // Commit 2: Modify file
        await createCommitWithFiles(ctx, "Modify file", {
          "to-delete.txt": "modified content",
        });

        // Commit 3: Delete file
        await createCommitWithDeletions(ctx, "Delete file", ["to-delete.txt"]);

        const deletion = findFileDeletion(ctx.repo, "to-delete.txt");

        assertExists(deletion, "Should find deletion");
        assertEquals(deletion.deletedInCommit.message.includes("Delete file"), true);
        assertEquals(deletion.lastExistedInCommit.message.includes("Modify file"), true);
        assertEquals(deletion.lastContent, "modified content");
      });
    });

    await t.step("findFileDeletion returns null for existing file", async () => {
      await withTestContext({}, async (ctx) => {
        await createCommitWithFiles(ctx, "Add file", {
          "existing.txt": "content",
        });

        const deletion = findFileDeletion(ctx.repo, "existing.txt");
        assertEquals(deletion, null, "Should return null for existing file");
      });
    });

    await t.step("findFileCreation finds when file was first added", async () => {
      await withTestContext({}, async (ctx) => {
        // Commit 1: Add other file
        await createCommitWithFiles(ctx, "Add other", {
          "other.txt": "other",
        });

        // Commit 2: Add tracked file
        await createCommitWithFiles(ctx, "Add tracked", {
          "tracked.txt": "initial content",
        });

        // Commit 3: Modify tracked file
        await createCommitWithFiles(ctx, "Modify tracked", {
          "tracked.txt": "modified content",
        });

        const creation = findFileCreation(ctx.repo, "tracked.txt");

        assertExists(creation, "Should find creation");
        assertEquals(creation.message.includes("Add tracked"), true);
      });
    });

    await t.step("fileExistsAtHead checks current file existence", async () => {
      await withTestContext({}, async (ctx) => {
        await createCommitWithFiles(ctx, "Add file", {
          "exists.txt": "content",
        });

        assertEquals(fileExistsAtHead(ctx.repo, "exists.txt"), true);
        assertEquals(fileExistsAtHead(ctx.repo, "nonexistent.txt"), false);
      });
    });

    await t.step("getFileAtHead retrieves current file content", async () => {
      await withTestContext({}, async (ctx) => {
        await createCommitWithFiles(ctx, "Add file", {
          "current.txt": "current content",
        });

        const content = getFileAtHead(ctx.repo, "current.txt");
        assertEquals(content, "current content");

        const missing = getFileAtHead(ctx.repo, "missing.txt");
        assertEquals(missing, null);
      });
    });

    // Wiki/Dork Blocks Scenario Tests
    await t.step("Wiki scenario: Track block file through lifecycle", async () => {
      await withTestContext({}, async (ctx) => {
        const blockId = "01234567-89ab-cdef-0123-456789abcdef";
        const blockPath = `.dork/blocks/${blockId}.md`;

        // Step 1: Create the block
        await createCommitWithFiles(ctx, "Create block", {
          [blockPath]: "# My Block\n\nInitial content.",
        });

        // Step 2: Edit the block
        await createCommitWithFiles(ctx, "Edit block", {
          [blockPath]: "# My Block\n\nEdited content with more details.",
        });

        // Step 3: Add a reference to this block from another block
        const otherBlockPath = `.dork/blocks/other-block.md`;
        await createCommitWithFiles(ctx, "Add reference", {
          [otherBlockPath]: `# Other Block\n\nSee also: [[${blockId}]]`,
        });

        // Step 4: Delete the original block (orphaning the reference)
        await createCommitWithDeletions(ctx, "Delete block", [blockPath]);

        // Now verify we can track the deleted block's history
        const history = findFileHistory(ctx.repo, blockPath);
        assertEquals(history.commits.length, 3, "Block should appear in 3 commits before deletion");
        assertEquals(history.currentlyExists, false, "Block should no longer exist");

        // Find when it was deleted and get last content
        const deletion = findFileDeletion(ctx.repo, blockPath);
        assertExists(deletion);
        assertEquals(deletion.lastContent?.includes("Edited content"), true);

        // Find when it was created
        const creation = findFileCreation(ctx.repo, blockPath);
        assertExists(creation);
        assertEquals(creation.message.includes("Create block"), true);

        // Verify the referencing block still exists
        assertEquals(fileExistsAtHead(ctx.repo, otherBlockPath), true);
        const refContent = getFileAtHead(ctx.repo, otherBlockPath);
        assertEquals(refContent?.includes(blockId), true, "Reference should still contain block ID");
      });
    });

    await t.step("Wiki scenario: Find all commits where deleted block existed", async () => {
      await withTestContext({}, async (ctx) => {
        const blockPath = ".dork/blocks/tracked-block.md";

        // Create multiple versions of the block
        const versions = [
          "Version 1: Initial draft",
          "Version 2: Added more content",
          "Version 3: Refined the text",
          "Version 4: Final version before deletion",
        ];

        for (const content of versions) {
          await createCommitWithFiles(ctx, `Update: ${content.split(":")[0]}`, {
            [blockPath]: content,
          });
        }

        // Delete the block
        await createCommitWithDeletions(ctx, "Remove outdated block", [blockPath]);

        // Get full history
        const history = findFileHistory(ctx.repo, blockPath);

        assertEquals(history.commits.length, 4, "Should have 4 commits with the file");
        assertEquals(history.currentlyExists, false);

        // Verify we can get content at each commit
        for (let i = 0; i < history.commits.length; i++) {
          const commitInfo = history.commits[i];
          // Get the full commit to access treeOid
          const commit = ctx.repo.lookupCommit(commitInfo.commitOid);
          const content = getFileContent(ctx.repo, commit.treeOid, blockPath);
          assertExists(content, `Content should exist at commit ${i}`);
          assertEquals(content.includes(`Version ${4 - i}`), true, `Should be version ${4 - i}`);
        }
      });
    });

    await t.step("Wiki scenario: Detect orphaned references", async () => {
      await withTestContext({}, async (ctx) => {
        // Create several blocks with references
        const block1 = ".dork/blocks/block1.md";
        const block2 = ".dork/blocks/block2.md";
        const block3 = ".dork/blocks/block3.md";

        await createCommitWithFiles(ctx, "Create blocks", {
          [block1]: "# Block 1\n\nReferences: [[block2]] [[block3]]",
          [block2]: "# Block 2\n\nContent here",
          [block3]: "# Block 3\n\nMore content",
        });

        // Delete block2, creating an orphaned reference in block1
        await createCommitWithDeletions(ctx, "Delete block2", [block2]);

        // Verify block2 was deleted
        assertEquals(fileExistsAtHead(ctx.repo, block2), false);

        // Verify we can recover block2's content
        const deletion = findFileDeletion(ctx.repo, block2);
        assertExists(deletion);
        assertEquals(deletion.lastContent?.includes("Block 2"), true);

        // Verify block1 still references block2
        const block1Content = getFileAtHead(ctx.repo, block1);
        assertEquals(block1Content?.includes("[[block2]]"), true);
      });
    });

    await t.step("findFileModifications tracks content changes", async () => {
      await withTestContext({}, async (ctx) => {
        const filePath = "tracked.md";

        // Create file
        await createCommitWithFiles(ctx, "Create file", {
          [filePath]: "Initial",
        });

        // Modify file
        await createCommitWithFiles(ctx, "First edit", {
          [filePath]: "Modified once",
        });

        // Modify tracked file again
        await createCommitWithFiles(ctx, "Second edit", {
          [filePath]: "Modified twice",
        });

        const modifications = findFileModifications(ctx.repo, filePath);

        // Should have 3 modifications: create, first edit, second edit
        assertEquals(modifications.length, 3, "Should have exactly 3 modifications");

        // Verify messages contain expected content (in reverse chronological order)
        const messages = modifications.map((m) => m.message);
        assertEquals(messages[0].includes("Second edit"), true);
        assertEquals(messages[1].includes("First edit"), true);
        assertEquals(messages[2].includes("Create"), true);
      });
    });

    teardownLibrary();
  },
});
