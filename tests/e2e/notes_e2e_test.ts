/**
 * End-to-end tests for notes functionality
 * Tests use real file operations in temporary directories
 */

import {
  assert,
  assertEquals,
  assertExists,
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

Deno.test("E2E Notes Tests", async (t) => {
  init();

  try {
    await t.step("create note on commit", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        await createCommitWithFiles(ctx, "Initial", { "file.txt": "content\n" });

        // Get the HEAD commit OID
        const headOid = ctx.repo.headOid();
        assertExists(headOid, "Should have HEAD");

        // Create a note on the commit
        const noteOid = ctx.repo.createNote(
          headOid,
          "This is a note on the commit",
          { name: "Test User", email: "test@example.com" }
        );

        assertExists(noteOid, "Should return note OID");
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("read note from commit", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        await createCommitWithFiles(ctx, "Initial", { "file.txt": "content\n" });

        const headOid = ctx.repo.headOid();
        assertExists(headOid, "Should have HEAD");

        // Create a note
        ctx.repo.createNote(
          headOid,
          "Test note message",
          { name: "Test User", email: "test@example.com" }
        );

        // Read the note
        const note = ctx.repo.readNote(headOid);
        assertExists(note, "Should find note");
        assertEquals(note.message, "Test note message", "Message should match");

        note.free();
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("note author and committer", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        await createCommitWithFiles(ctx, "Initial", { "file.txt": "content\n" });

        const headOid = ctx.repo.headOid();
        assertExists(headOid, "Should have HEAD");

        // Create a note with specific author
        ctx.repo.createNote(
          headOid,
          "Note with author",
          { name: "Note Author", email: "author@example.com" }
        );

        // Read the note
        const note = ctx.repo.readNote(headOid);
        assertExists(note, "Should find note");

        // Check author
        assertExists(note.author, "Should have author");
        assertEquals(note.author.name, "Note Author", "Author name should match");
        assertEquals(note.author.email, "author@example.com", "Author email should match");

        note.free();
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("remove note from commit", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        await createCommitWithFiles(ctx, "Initial", { "file.txt": "content\n" });

        const headOid = ctx.repo.headOid();
        assertExists(headOid, "Should have HEAD");

        // Create a note
        ctx.repo.createNote(
          headOid,
          "Note to remove",
          { name: "Test User", email: "test@example.com" }
        );

        // Verify it exists
        const note = ctx.repo.readNote(headOid);
        assertExists(note, "Should find note");
        note.free();

        // Remove the note
        ctx.repo.removeNote(
          headOid,
          { name: "Test User", email: "test@example.com" }
        );

        // Verify it's gone
        const removedNote = ctx.repo.readNote(headOid);
        assertEquals(removedNote, null, "Note should be removed");
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("iterate notes", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        // Create multiple commits with notes
        await createCommitWithFiles(ctx, "Commit 1", { "file1.txt": "content1\n" });
        const oid1 = ctx.repo.headOid()!;

        await createCommitWithFiles(ctx, "Commit 2", { "file2.txt": "content2\n" });
        const oid2 = ctx.repo.headOid()!;

        // Create notes on both commits
        ctx.repo.createNote(
          oid1,
          "Note on commit 1",
          { name: "Test User", email: "test@example.com" }
        );
        ctx.repo.createNote(
          oid2,
          "Note on commit 2",
          { name: "Test User", email: "test@example.com" }
        );

        // Iterate notes
        const notes = ctx.repo.listNotes();
        assertEquals(notes.length, 2, "Should have two notes");
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("overwrite note with force", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        await createCommitWithFiles(ctx, "Initial", { "file.txt": "content\n" });

        const headOid = ctx.repo.headOid();
        assertExists(headOid, "Should have HEAD");

        // Create initial note
        ctx.repo.createNote(
          headOid,
          "Original note",
          { name: "Test User", email: "test@example.com" }
        );

        // Overwrite with force
        ctx.repo.createNote(
          headOid,
          "Updated note",
          { name: "Test User", email: "test@example.com" },
          { force: true }
        );

        // Read the note
        const note = ctx.repo.readNote(headOid);
        assertExists(note, "Should find note");
        assertEquals(note.message, "Updated note", "Message should be updated");

        note.free();
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("read note that doesn't exist returns null", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        await createCommitWithFiles(ctx, "Initial", { "file.txt": "content\n" });

        const headOid = ctx.repo.headOid();
        assertExists(headOid, "Should have HEAD");

        // Try to read non-existent note
        const note = ctx.repo.readNote(headOid);
        assertEquals(note, null, "Should return null for non-existent note");
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("get default notes reference", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        const defaultRef = ctx.repo.defaultNotesRef();
        assertEquals(defaultRef, "refs/notes/commits", "Default ref should be refs/notes/commits");
      } finally {
        await cleanupTestContext(ctx);
      }
    });

    await t.step("create note with custom namespace", async () => {
      const ctx = await createTestContext({ withInitialCommit: true });
      try {
        await createCommitWithFiles(ctx, "Initial", { "file.txt": "content\n" });

        const headOid = ctx.repo.headOid();
        assertExists(headOid, "Should have HEAD");

        // Create a note in custom namespace
        ctx.repo.createNote(
          headOid,
          "Note in custom namespace",
          { name: "Test User", email: "test@example.com" },
          { notesRef: "refs/notes/custom" }
        );

        // Read from custom namespace
        const note = ctx.repo.readNote(headOid, { notesRef: "refs/notes/custom" });
        assertExists(note, "Should find note in custom namespace");
        assertEquals(note.message, "Note in custom namespace", "Message should match");

        note.free();

        // Should not find in default namespace
        const defaultNote = ctx.repo.readNote(headOid);
        assertEquals(defaultNote, null, "Should not find in default namespace");
      } finally {
        await cleanupTestContext(ctx);
      }
    });
  } finally {
    shutdown();
  }
});
