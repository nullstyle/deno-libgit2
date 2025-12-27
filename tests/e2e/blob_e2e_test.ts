/**
 * End-to-end tests for blob operations
 * Tests use real file operations in temporary directories
 */

import {
  assertEquals,
  assertExists,
  assertFalse,
  assertGreater,
  assertThrows,
} from "@std/assert";

import {
  cleanupTestContext,
  createCommitWithFiles,
  createTestContext,
} from "./helpers.ts";

import {
  Blob,
  fileExistsAtCommit,
  getBlobContent,
  getBlobRawContent,
  getFileAtCommit,
  getFileContent,
  getFileRawAtCommit,
  getFileRawContent,
  init,
  shutdown,
  Tree,
} from "../../mod.ts";

Deno.test({
  name: "E2E Blob Tests",
  async fn(t) {
    await init();

    await t.step("Blob.lookup retrieves blob by OID", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        const content = "Hello, World!";
        await createCommitWithFiles(ctx, "Add test file", {
          "test.txt": content,
        });

        const headOid = ctx.repo.headOid();
        const commit = ctx.repo.lookupCommit(headOid);
        using tree = Tree.lookup(ctx.repo, commit.treeOid);
        using entry = tree.getByName("test.txt");
        assertExists(entry);

        using blob = Blob.lookup(ctx.repo, entry.oid);
        assertExists(blob);
        assertEquals(blob.content(), content);
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("Blob.content returns text content", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        const content = "Line 1\nLine 2\nLine 3\n";
        await createCommitWithFiles(ctx, "Add multi-line file", {
          "multiline.txt": content,
        });

        const headOid = ctx.repo.headOid();
        const commit = ctx.repo.lookupCommit(headOid);
        using tree = Tree.lookup(ctx.repo, commit.treeOid);
        using entry = tree.getByName("multiline.txt");
        assertExists(entry);

        using blob = Blob.lookup(ctx.repo, entry.oid);
        assertEquals(blob.content(), content);
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("Blob.rawContent returns Uint8Array", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        const content = "Binary test content";
        await createCommitWithFiles(ctx, "Add file", {
          "test.txt": content,
        });

        const headOid = ctx.repo.headOid();
        const commit = ctx.repo.lookupCommit(headOid);
        using tree = Tree.lookup(ctx.repo, commit.treeOid);
        using entry = tree.getByName("test.txt");
        assertExists(entry);

        using blob = Blob.lookup(ctx.repo, entry.oid);
        const raw = blob.rawContent();
        assertExists(raw);
        assertEquals(raw instanceof Uint8Array, true);
        assertEquals(raw.length, content.length);

        // Verify content matches
        const decoded = new TextDecoder().decode(raw);
        assertEquals(decoded, content);
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("Blob.size returns correct size", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        const content = "0123456789"; // 10 bytes
        await createCommitWithFiles(ctx, "Add file", {
          "test.txt": content,
        });

        const headOid = ctx.repo.headOid();
        const commit = ctx.repo.lookupCommit(headOid);
        using tree = Tree.lookup(ctx.repo, commit.treeOid);
        using entry = tree.getByName("test.txt");
        assertExists(entry);

        using blob = Blob.lookup(ctx.repo, entry.oid);
        assertEquals(blob.size, 10);
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("Blob.oid returns valid OID", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        await createCommitWithFiles(ctx, "Add file", {
          "test.txt": "content",
        });

        const headOid = ctx.repo.headOid();
        const commit = ctx.repo.lookupCommit(headOid);
        using tree = Tree.lookup(ctx.repo, commit.treeOid);
        using entry = tree.getByName("test.txt");
        assertExists(entry);

        using blob = Blob.lookup(ctx.repo, entry.oid);
        const oid = blob.oid;
        assertExists(oid);
        assertEquals(oid.length, 40, "OID should be 40 hex characters");
        assertEquals(oid, entry.oid, "OID should match entry OID");
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("Blob.isBinary returns false for text files", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        await createCommitWithFiles(ctx, "Add text file", {
          "text.txt": "This is plain text content.\nWith multiple lines.\n",
        });

        const headOid = ctx.repo.headOid();
        const commit = ctx.repo.lookupCommit(headOid);
        using tree = Tree.lookup(ctx.repo, commit.treeOid);
        using entry = tree.getByName("text.txt");
        assertExists(entry);

        using blob = Blob.lookup(ctx.repo, entry.oid);
        assertEquals(blob.isBinary, false);
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("Blob.isClosed reflects closed state", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        await createCommitWithFiles(ctx, "Add file", {
          "test.txt": "content",
        });

        const headOid = ctx.repo.headOid();
        const commit = ctx.repo.lookupCommit(headOid);
        using tree = Tree.lookup(ctx.repo, commit.treeOid);
        using entry = tree.getByName("test.txt");
        assertExists(entry);

        const blob = Blob.lookup(ctx.repo, entry.oid);
        assertEquals(blob.isClosed, false, "New blob should not be closed");

        blob.close();
        assertEquals(blob.isClosed, true, "Closed blob should report closed");
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("Closed blob throws on access", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        await createCommitWithFiles(ctx, "Add file", {
          "test.txt": "content",
        });

        const headOid = ctx.repo.headOid();
        const commit = ctx.repo.lookupCommit(headOid);
        using tree = Tree.lookup(ctx.repo, commit.treeOid);
        using entry = tree.getByName("test.txt");
        assertExists(entry);

        const blob = Blob.lookup(ctx.repo, entry.oid);
        blob.close();

        assertThrows(() => blob.content(), Error, "Blob is closed");
        assertThrows(() => blob.rawContent(), Error, "Blob is closed");
        assertThrows(() => blob.size, Error, "Blob is closed");
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("Blob.use provides automatic cleanup", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        const content = "Auto cleanup content";
        await createCommitWithFiles(ctx, "Add file", {
          "test.txt": content,
        });

        const headOid = ctx.repo.headOid();
        const commit = ctx.repo.lookupCommit(headOid);
        using tree = Tree.lookup(ctx.repo, commit.treeOid);
        using entry = tree.getByName("test.txt");
        assertExists(entry);

        const result = Blob.use(ctx.repo, entry.oid, (blob) => {
          assertFalse(blob.isClosed);
          return blob.content();
        });

        assertEquals(result, content);
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("Empty blob has size 0 and empty content", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        await createCommitWithFiles(ctx, "Add empty file", {
          "empty.txt": "",
        });

        const headOid = ctx.repo.headOid();
        const commit = ctx.repo.lookupCommit(headOid);
        using tree = Tree.lookup(ctx.repo, commit.treeOid);
        using entry = tree.getByName("empty.txt");
        assertExists(entry);

        using blob = Blob.lookup(ctx.repo, entry.oid);
        assertEquals(blob.size, 0);
        assertEquals(blob.content(), "");
        assertEquals(blob.rawContent().length, 0);
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("getBlobContent returns text content", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        const content = "Blob content via helper";
        await createCommitWithFiles(ctx, "Add file", {
          "test.txt": content,
        });

        const headOid = ctx.repo.headOid();
        const commit = ctx.repo.lookupCommit(headOid);
        using tree = Tree.lookup(ctx.repo, commit.treeOid);
        using entry = tree.getByName("test.txt");
        assertExists(entry);

        const result = getBlobContent(ctx.repo, entry.oid);
        assertEquals(result, content);
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("getBlobRawContent returns Uint8Array", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        const content = "Raw content";
        await createCommitWithFiles(ctx, "Add file", {
          "test.txt": content,
        });

        const headOid = ctx.repo.headOid();
        const commit = ctx.repo.lookupCommit(headOid);
        using tree = Tree.lookup(ctx.repo, commit.treeOid);
        using entry = tree.getByName("test.txt");
        assertExists(entry);

        const raw = getBlobRawContent(ctx.repo, entry.oid);
        assertEquals(raw instanceof Uint8Array, true);
        assertEquals(new TextDecoder().decode(raw), content);
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("getFileContent retrieves file from tree OID", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        const content = "File content in subdirectory";
        await createCommitWithFiles(ctx, "Add file in subdir", {
          "src/utils/helper.ts": content,
        });

        const headOid = ctx.repo.headOid();
        const commit = ctx.repo.lookupCommit(headOid);
        const result = getFileContent(
          ctx.repo,
          commit.treeOid,
          "src/utils/helper.ts",
        );

        assertEquals(result, content);
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step(
      "getFileContent returns null for non-existent file",
      async () => {
        const ctx = await createTestContext({ withInitialCommit: true });
        try {
          await createCommitWithFiles(ctx, "Add file", {
            "exists.txt": "content",
          });

          const headOid = ctx.repo.headOid();
          const commit = ctx.repo.lookupCommit(headOid);
          const result = getFileContent(
            ctx.repo,
            commit.treeOid,
            "does-not-exist.txt",
          );

          assertEquals(result, null);
        } finally {
          await cleanupTestContext(ctx);
        }
      },
    );

    await t.step(
      "getFileRawContent retrieves raw content from tree",
      async () => {
        const ctx = await createTestContext({ withInitialCommit: true });
        try {
          const content = "Raw file content";
          await createCommitWithFiles(ctx, "Add file", {
            "data.bin": content,
          });

          const headOid = ctx.repo.headOid();
          const commit = ctx.repo.lookupCommit(headOid);
          const result = getFileRawContent(
            ctx.repo,
            commit.treeOid,
            "data.bin",
          );

          assertExists(result);
          assertEquals(result instanceof Uint8Array, true);
          assertEquals(new TextDecoder().decode(result), content);
        } finally {
          await cleanupTestContext(ctx);
        }
      },
    );

    await t.step(
      "getFileRawContent returns null for non-existent file",
      async () => {
        const ctx = await createTestContext({ withInitialCommit: true });
        try {
          await createCommitWithFiles(ctx, "Add file", {
            "exists.txt": "content",
          });

          const headOid = ctx.repo.headOid();
          const commit = ctx.repo.lookupCommit(headOid);
          const result = getFileRawContent(
            ctx.repo,
            commit.treeOid,
            "missing.bin",
          );

          assertEquals(result, null);
        } finally {
          await cleanupTestContext(ctx);
        }
      },
    );

    await t.step(
      "getFileAtCommit retrieves file at specific commit",
      async () => {
        const ctx = await createTestContext({ withInitialCommit: true });
        try {
          await createCommitWithFiles(ctx, "Version 1", {
            "file.txt": "version 1 content",
          });
          const commit1 = ctx.repo.headOid();

          await createCommitWithFiles(ctx, "Version 2", {
            "file.txt": "version 2 content",
          });
          const commit2 = ctx.repo.headOid();

          // Get content at each commit
          const content1 = getFileAtCommit(ctx.repo, commit1, "file.txt");
          const content2 = getFileAtCommit(ctx.repo, commit2, "file.txt");

          assertEquals(content1, "version 1 content");
          assertEquals(content2, "version 2 content");
        } finally {
          await cleanupTestContext(ctx);
        }
      },
    );

    await t.step(
      "getFileAtCommit returns null for file not in commit",
      async () => {
        const ctx = await createTestContext({ withInitialCommit: true });
        try {
          await createCommitWithFiles(ctx, "Add file", {
            "exists.txt": "content",
          });
          const commitOid = ctx.repo.headOid();

          const result = getFileAtCommit(ctx.repo, commitOid, "missing.txt");
          assertEquals(result, null);
        } finally {
          await cleanupTestContext(ctx);
        }
      },
    );

    await t.step(
      "getFileRawAtCommit retrieves raw content at commit",
      async () => {
        const ctx = await createTestContext({ withInitialCommit: true });
        try {
          const content = "Binary-like content";
          await createCommitWithFiles(ctx, "Add file", {
            "data.bin": content,
          });
          const commitOid = ctx.repo.headOid();

          const result = getFileRawAtCommit(ctx.repo, commitOid, "data.bin");

          assertExists(result);
          assertEquals(result instanceof Uint8Array, true);
          assertEquals(new TextDecoder().decode(result), content);
        } finally {
          await cleanupTestContext(ctx);
        }
      },
    );

    await t.step(
      "getFileRawAtCommit returns null for missing file",
      async () => {
        const ctx = await createTestContext({ withInitialCommit: true });
        try {
          await createCommitWithFiles(ctx, "Add file", {
            "exists.txt": "content",
          });
          const commitOid = ctx.repo.headOid();

          const result = getFileRawAtCommit(ctx.repo, commitOid, "missing.txt");
          assertEquals(result, null);
        } finally {
          await cleanupTestContext(ctx);
        }
      },
    );

    await t.step(
      "fileExistsAtCommit returns true for existing file",
      async () => {
        const ctx = await createTestContext({ withInitialCommit: true });
        try {
          await createCommitWithFiles(ctx, "Add files", {
            "exists.txt": "content",
            "src/main.ts": "console.log('hello');",
          });
          const commitOid = ctx.repo.headOid();

          assertEquals(
            fileExistsAtCommit(ctx.repo, commitOid, "exists.txt"),
            true,
          );
          assertEquals(
            fileExistsAtCommit(ctx.repo, commitOid, "src/main.ts"),
            true,
          );
        } finally {
          await cleanupTestContext(ctx);
        }
      },
    );

    await t.step(
      "fileExistsAtCommit returns false for non-existent file",
      async () => {
        const ctx = await createTestContext({ withInitialCommit: true });
        try {
          await createCommitWithFiles(ctx, "Add file", {
            "exists.txt": "content",
          });
          const commitOid = ctx.repo.headOid();

          assertEquals(
            fileExistsAtCommit(ctx.repo, commitOid, "missing.txt"),
            false,
          );
          assertEquals(
            fileExistsAtCommit(ctx.repo, commitOid, "src/missing.ts"),
            false,
          );
        } finally {
          await cleanupTestContext(ctx);
        }
      },
    );

    await t.step(
      "fileExistsAtCommit tracks file presence across commits",
      async () => {
        const ctx = await createTestContext({ withInitialCommit: true });
        try {
          // First commit: create file
          await createCommitWithFiles(ctx, "Add file", {
            "feature.txt": "initial content",
          });
          const commit1 = ctx.repo.headOid();

          // Second commit: add another file (feature.txt still exists)
          await createCommitWithFiles(ctx, "Add another file", {
            "other.txt": "other content",
          });
          const commit2 = ctx.repo.headOid();

          // Verify files at each commit
          assertEquals(
            fileExistsAtCommit(ctx.repo, commit1, "feature.txt"),
            true,
          );
          assertEquals(
            fileExistsAtCommit(ctx.repo, commit1, "other.txt"),
            false,
          );

          assertEquals(
            fileExistsAtCommit(ctx.repo, commit2, "feature.txt"),
            true,
          );
          assertEquals(
            fileExistsAtCommit(ctx.repo, commit2, "other.txt"),
            true,
          );
        } finally {
          await cleanupTestContext(ctx);
        }
      },
    );

    await t.step("Large blob content is handled correctly", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        // Create a large file (100KB)
        const largeContent = "x".repeat(100 * 1024);
        await createCommitWithFiles(ctx, "Add large file", {
          "large.txt": largeContent,
        });

        const headOid = ctx.repo.headOid();
        const commit = ctx.repo.lookupCommit(headOid);
        using tree = Tree.lookup(ctx.repo, commit.treeOid);
        using entry = tree.getByName("large.txt");
        assertExists(entry);

        using blob = Blob.lookup(ctx.repo, entry.oid);
        assertEquals(blob.size, 100 * 1024);
        assertGreater(blob.rawContent().length, 0);
        assertEquals(blob.content().length, 100 * 1024);
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("Blob with special characters in content", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        const content = "Special chars: äöü ñ 日本語 emoji: 🎉\n\ttab\n";
        await createCommitWithFiles(ctx, "Add file with unicode", {
          "unicode.txt": content,
        });

        const headOid = ctx.repo.headOid();
        const commit = ctx.repo.lookupCommit(headOid);
        using tree = Tree.lookup(ctx.repo, commit.treeOid);
        using entry = tree.getByName("unicode.txt");
        assertExists(entry);

        using blob = Blob.lookup(ctx.repo, entry.oid);
        assertEquals(blob.content(), content);
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("Blob close is idempotent", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        await createCommitWithFiles(ctx, "Add file", {
          "test.txt": "content",
        });

        const headOid = ctx.repo.headOid();
        const commit = ctx.repo.lookupCommit(headOid);
        using tree = Tree.lookup(ctx.repo, commit.treeOid);
        using entry = tree.getByName("test.txt");
        assertExists(entry);

        const blob = Blob.lookup(ctx.repo, entry.oid);

        // Close multiple times should not throw
        blob.close();
        blob.close();
        blob.close();

        assertEquals(blob.isClosed, true);
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("Same content produces same blob OID", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        const content = "Identical content";

        // Create two files with same content
        await createCommitWithFiles(ctx, "Add files", {
          "file1.txt": content,
          "file2.txt": content,
        });

        const headOid = ctx.repo.headOid();
        const commit = ctx.repo.lookupCommit(headOid);
        using tree = Tree.lookup(ctx.repo, commit.treeOid);

        using entry1 = tree.getByName("file1.txt");
        using entry2 = tree.getByName("file2.txt");
        assertExists(entry1);
        assertExists(entry2);

        // Git content-addresses blobs, so same content = same OID
        assertEquals(
          entry1.oid,
          entry2.oid,
          "Same content should have same OID",
        );
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    shutdown();
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
