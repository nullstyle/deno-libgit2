/**
 * End-to-end tests for notes functionality
 *
 * These tests validate notes functionality including:
 * - Creating, reading, and removing notes
 * - Note properties (message, oid, author, committer)
 * - Iterating notes
 * - Custom namespaces
 * - Symbol.dispose support
 * - Error handling and edge cases
 */

import { assertEquals, assertExists, assertNotEquals } from "@std/assert";
import {
  createCommitWithFiles,
  createTestContext,
  setupLibrary,
} from "./helpers.ts";

Deno.test("E2E Notes Tests", async (t) => {
  using _git = await setupLibrary();
    // ==================== Create Note Tests ====================

    await t.step("create note on commit", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "content\n",
      });

      // Get the HEAD commit OID
      const headOid = ctx.repo.headOid();
      assertExists(headOid, "Should have HEAD");

      // Create a note on the commit
      const noteOid = ctx.repo.createNote(
        headOid,
        "This is a note on the commit",
        { name: "Test User", email: "test@example.com" },
      );

      assertExists(noteOid, "Should return note OID");
      assertEquals(noteOid.length, 40, "Note OID should be 40 characters");
    });

    await t.step("create note with different signature", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Test commit", {
        "file.txt": "content\n",
      });

      const headOid = ctx.repo.headOid()!;

      const noteOid = ctx.repo.createNote(
        headOid,
        "Note with specific author",
        { name: "John Doe", email: "john.doe@example.com" },
      );

      assertExists(noteOid);

      // Verify the note was created with the correct author
      const note = ctx.repo.readNote(headOid);
      assertExists(note);
      assertEquals(note.author?.name, "John Doe");
      assertEquals(note.author?.email, "john.doe@example.com");
      note.free();
    });

    await t.step("create note with empty message", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Test", { "f.txt": "c" });

      const headOid = ctx.repo.headOid()!;

      // Empty message should still work
      const noteOid = ctx.repo.createNote(
        headOid,
        "",
        { name: "Test", email: "test@example.com" },
      );

      assertExists(noteOid);

      const note = ctx.repo.readNote(headOid);
      assertExists(note);
      assertEquals(note.message, "");
      note.free();
    });

    await t.step("create note with multiline message", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Test", { "f.txt": "c" });

      const headOid = ctx.repo.headOid()!;

      const multilineMessage = `This is line 1
This is line 2
This is line 3

With a blank line above`;

      const noteOid = ctx.repo.createNote(
        headOid,
        multilineMessage,
        { name: "Test", email: "test@example.com" },
      );

      assertExists(noteOid);

      const note = ctx.repo.readNote(headOid);
      assertExists(note);
      assertEquals(note.message, multilineMessage);
      note.free();
    });

    // ==================== Read Note Tests ====================

    await t.step("read note from commit", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "content\n",
      });

      const headOid = ctx.repo.headOid();
      assertExists(headOid, "Should have HEAD");

      // Create a note
      ctx.repo.createNote(
        headOid,
        "Test note message",
        { name: "Test User", email: "test@example.com" },
      );

      // Read the note
      const note = ctx.repo.readNote(headOid);
      assertExists(note, "Should find note");
      assertEquals(note.message, "Test note message", "Message should match");

      note.free();
    });

    await t.step("read note that doesn't exist returns null", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "content\n",
      });

      const headOid = ctx.repo.headOid();
      assertExists(headOid, "Should have HEAD");

      // Try to read non-existent note
      const note = ctx.repo.readNote(headOid);
      assertEquals(note, null, "Should return null for non-existent note");
    });

    // ==================== Note Properties Tests ====================

    await t.step("note message property", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Test", { "f.txt": "c" });

      const headOid = ctx.repo.headOid()!;
      const testMessage =
        "This is a test note message with special chars: @#$%";

      ctx.repo.createNote(
        headOid,
        testMessage,
        { name: "Test", email: "test@example.com" },
      );

      const note = ctx.repo.readNote(headOid);
      assertExists(note);
      assertEquals(note.message, testMessage);
      note.free();
    });

    await t.step("note oid property", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Test", { "f.txt": "c" });

      const headOid = ctx.repo.headOid()!;

      const createdNoteOid = ctx.repo.createNote(
        headOid,
        "Test note",
        { name: "Test", email: "test@example.com" },
      );

      const note = ctx.repo.readNote(headOid);
      assertExists(note);

      // The note's OID should match what was returned at creation
      assertEquals(note.oid, createdNoteOid);
      assertEquals(note.oid.length, 40);

      note.free();
    });

    await t.step("note author property", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "content\n",
      });

      const headOid = ctx.repo.headOid();
      assertExists(headOid, "Should have HEAD");

      // Create a note with specific author
      ctx.repo.createNote(
        headOid,
        "Note with author",
        { name: "Note Author", email: "author@example.com" },
      );

      // Read the note
      const note = ctx.repo.readNote(headOid);
      assertExists(note, "Should find note");

      // Check author
      assertExists(note.author, "Should have author");
      assertEquals(
        note.author.name,
        "Note Author",
        "Author name should match",
      );
      assertEquals(
        note.author.email,
        "author@example.com",
        "Author email should match",
      );

      note.free();
    });

    await t.step("note committer property", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Test", { "f.txt": "c" });

      const headOid = ctx.repo.headOid()!;

      ctx.repo.createNote(
        headOid,
        "Test note",
        { name: "Committer Name", email: "committer@example.com" },
      );

      const note = ctx.repo.readNote(headOid);
      assertExists(note);
      assertExists(note.committer, "Should have committer");
      assertEquals(note.committer.name, "Committer Name");
      assertEquals(note.committer.email, "committer@example.com");

      note.free();
    });

    await t.step("note author has timestamp", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Test", { "f.txt": "c" });

      const headOid = ctx.repo.headOid()!;

      ctx.repo.createNote(
        headOid,
        "Note with timestamp",
        { name: "Test", email: "test@example.com" },
      );

      const note = ctx.repo.readNote(headOid);
      assertExists(note);
      assertExists(note.author);
      assertExists(note.author.when, "Author should have timestamp");
      assertEquals(typeof note.author.when.time, "bigint");
      assertEquals(typeof note.author.when.offset, "number");
      assertExists(note.author.when.sign);

      note.free();
    });

    await t.step("note committer has timestamp", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Test", { "f.txt": "c" });

      const headOid = ctx.repo.headOid()!;

      ctx.repo.createNote(
        headOid,
        "Note",
        { name: "Test", email: "test@example.com" },
      );

      const note = ctx.repo.readNote(headOid);
      assertExists(note);
      assertExists(note.committer);
      assertExists(note.committer.when);
      assertEquals(typeof note.committer.when.time, "bigint");
      assertEquals(typeof note.committer.when.offset, "number");

      note.free();
    });

    // ==================== Remove Note Tests ====================

    await t.step("remove note from commit", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "content\n",
      });

      const headOid = ctx.repo.headOid();
      assertExists(headOid, "Should have HEAD");

      // Create a note
      ctx.repo.createNote(
        headOid,
        "Note to remove",
        { name: "Test User", email: "test@example.com" },
      );

      // Verify it exists
      const note = ctx.repo.readNote(headOid);
      assertExists(note, "Should find note");
      note.free();

      // Remove the note
      ctx.repo.removeNote(
        headOid,
        { name: "Test User", email: "test@example.com" },
      );

      // Verify it's gone
      const removedNote = ctx.repo.readNote(headOid);
      assertEquals(removedNote, null, "Note should be removed");
    });

    await t.step("remove note with different signature", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Test", { "f.txt": "c" });

      const headOid = ctx.repo.headOid()!;

      // Create note with one author
      ctx.repo.createNote(
        headOid,
        "Test note",
        { name: "Creator", email: "creator@example.com" },
      );

      // Remove with different author (this is allowed in git)
      ctx.repo.removeNote(
        headOid,
        { name: "Remover", email: "remover@example.com" },
      );

      const note = ctx.repo.readNote(headOid);
      assertEquals(note, null);
    });

    // ==================== List Notes Tests ====================

    await t.step("iterate notes", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      // Create multiple commits with notes
      await createCommitWithFiles(ctx, "Commit 1", {
        "file1.txt": "content1\n",
      });
      const oid1 = ctx.repo.headOid()!;

      await createCommitWithFiles(ctx, "Commit 2", {
        "file2.txt": "content2\n",
      });
      const oid2 = ctx.repo.headOid()!;

      // Create notes on both commits
      ctx.repo.createNote(
        oid1,
        "Note on commit 1",
        { name: "Test User", email: "test@example.com" },
      );
      ctx.repo.createNote(
        oid2,
        "Note on commit 2",
        { name: "Test User", email: "test@example.com" },
      );

      // Iterate notes
      const notes = ctx.repo.listNotes();
      assertEquals(notes.length, 2, "Should have two notes");
    });

    await t.step("list notes returns note and annotated OIDs", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Test", { "f.txt": "c" });

      const headOid = ctx.repo.headOid()!;

      const createdNoteOid = ctx.repo.createNote(
        headOid,
        "Test note",
        { name: "Test", email: "test@example.com" },
      );

      const notes = ctx.repo.listNotes();
      assertEquals(notes.length, 1);

      // Check structure of note entry
      assertEquals(notes[0].noteOid, createdNoteOid);
      assertEquals(notes[0].annotatedOid, headOid);
    });

    await t.step("list notes on empty repository", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Test", { "f.txt": "c" });

      // Don't create any notes
      const notes = ctx.repo.listNotes();
      assertEquals(notes.length, 0);
    });

    await t.step("list multiple notes", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });

      // Create several commits
      await createCommitWithFiles(ctx, "C1", { "1.txt": "1" });
      const c1 = ctx.repo.headOid()!;

      await createCommitWithFiles(ctx, "C2", { "2.txt": "2" });
      const c2 = ctx.repo.headOid()!;

      await createCommitWithFiles(ctx, "C3", { "3.txt": "3" });
      const c3 = ctx.repo.headOid()!;

      // Create notes on all three
      ctx.repo.createNote(c1, "Note 1", { name: "T", email: "t@e.c" });
      ctx.repo.createNote(c2, "Note 2", { name: "T", email: "t@e.c" });
      ctx.repo.createNote(c3, "Note 3", { name: "T", email: "t@e.c" });

      const notes = ctx.repo.listNotes();
      assertEquals(notes.length, 3);

      // All annotated OIDs should be in our commit list
      const annotatedOids = notes.map((n) => n.annotatedOid);
      assertEquals(annotatedOids.includes(c1), true);
      assertEquals(annotatedOids.includes(c2), true);
      assertEquals(annotatedOids.includes(c3), true);
    });

    // ==================== Overwrite Tests ====================

    await t.step("overwrite note with force", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "content\n",
      });

      const headOid = ctx.repo.headOid();
      assertExists(headOid, "Should have HEAD");

      // Create initial note
      ctx.repo.createNote(
        headOid,
        "Original note",
        { name: "Test User", email: "test@example.com" },
      );

      // Overwrite with force
      ctx.repo.createNote(
        headOid,
        "Updated note",
        { name: "Test User", email: "test@example.com" },
        { force: true },
      );

      // Read the note
      const note = ctx.repo.readNote(headOid);
      assertExists(note, "Should find note");
      assertEquals(note.message, "Updated note", "Message should be updated");

      note.free();
    });

    await t.step("overwrite note changes OID", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Test", { "f.txt": "c" });

      const headOid = ctx.repo.headOid()!;

      const firstNoteOid = ctx.repo.createNote(
        headOid,
        "First note",
        { name: "Test", email: "test@example.com" },
      );

      const secondNoteOid = ctx.repo.createNote(
        headOid,
        "Second note with different content",
        { name: "Test", email: "test@example.com" },
        { force: true },
      );

      // OIDs should be different since content changed
      assertNotEquals(firstNoteOid, secondNoteOid);
    });

    // ==================== Default Notes Ref Tests ====================

    await t.step("get default notes reference", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      const defaultRef = ctx.repo.defaultNotesRef();
      assertEquals(
        defaultRef,
        "refs/notes/commits",
        "Default ref should be refs/notes/commits",
      );
    });

    // ==================== Custom Namespace Tests ====================

    await t.step("create note with custom namespace", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Initial", {
        "file.txt": "content\n",
      });

      const headOid = ctx.repo.headOid();
      assertExists(headOid, "Should have HEAD");

      // Create a note in custom namespace
      ctx.repo.createNote(
        headOid,
        "Note in custom namespace",
        { name: "Test User", email: "test@example.com" },
        { notesRef: "refs/notes/custom" },
      );

      // Read from custom namespace
      const note = ctx.repo.readNote(headOid, {
        notesRef: "refs/notes/custom",
      });
      assertExists(note, "Should find note in custom namespace");
      assertEquals(
        note.message,
        "Note in custom namespace",
        "Message should match",
      );

      note.free();

      // Should not find in default namespace
      const defaultNote = ctx.repo.readNote(headOid);
      assertEquals(defaultNote, null, "Should not find in default namespace");
    });

    await t.step("multiple notes in different namespaces", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Test", { "f.txt": "c" });

      const headOid = ctx.repo.headOid()!;

      // Create notes in different namespaces
      ctx.repo.createNote(
        headOid,
        "Default note",
        { name: "Test", email: "test@example.com" },
      );

      ctx.repo.createNote(
        headOid,
        "Review note",
        { name: "Test", email: "test@example.com" },
        { notesRef: "refs/notes/reviews" },
      );

      ctx.repo.createNote(
        headOid,
        "CI note",
        { name: "Test", email: "test@example.com" },
        { notesRef: "refs/notes/ci" },
      );

      // Read from each namespace
      const defaultNote = ctx.repo.readNote(headOid);
      assertExists(defaultNote);
      assertEquals(defaultNote.message, "Default note");
      defaultNote.free();

      const reviewNote = ctx.repo.readNote(headOid, {
        notesRef: "refs/notes/reviews",
      });
      assertExists(reviewNote);
      assertEquals(reviewNote.message, "Review note");
      reviewNote.free();

      const ciNote = ctx.repo.readNote(headOid, { notesRef: "refs/notes/ci" });
      assertExists(ciNote);
      assertEquals(ciNote.message, "CI note");
      ciNote.free();
    });

    await t.step("list notes in custom namespace", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "C1", { "1.txt": "1" });
      const c1 = ctx.repo.headOid()!;

      await createCommitWithFiles(ctx, "C2", { "2.txt": "2" });
      const c2 = ctx.repo.headOid()!;

      // Create notes in custom namespace
      ctx.repo.createNote(c1, "Note 1", { name: "T", email: "t@e.c" }, {
        notesRef: "refs/notes/custom",
      });
      ctx.repo.createNote(c2, "Note 2", { name: "T", email: "t@e.c" }, {
        notesRef: "refs/notes/custom",
      });

      // Also create one in default namespace
      ctx.repo.createNote(c1, "Default note", { name: "T", email: "t@e.c" });

      // List custom namespace
      const customNotes = ctx.repo.listNotes({
        notesRef: "refs/notes/custom",
      });
      assertEquals(customNotes.length, 2);

      // List default namespace
      const defaultNotes = ctx.repo.listNotes();
      assertEquals(defaultNotes.length, 1);
    });

    await t.step("remove note from custom namespace", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Test", { "f.txt": "c" });

      const headOid = ctx.repo.headOid()!;

      // Create in custom namespace
      ctx.repo.createNote(
        headOid,
        "Custom note",
        { name: "Test", email: "test@example.com" },
        { notesRef: "refs/notes/custom" },
      );

      // Verify it exists
      const note = ctx.repo.readNote(headOid, {
        notesRef: "refs/notes/custom",
      });
      assertExists(note);
      note.free();

      // Remove from custom namespace
      ctx.repo.removeNote(
        headOid,
        { name: "Test", email: "test@example.com" },
        { notesRef: "refs/notes/custom" },
      );

      // Verify it's gone
      const removed = ctx.repo.readNote(headOid, {
        notesRef: "refs/notes/custom",
      });
      assertEquals(removed, null);
    });

    // ==================== Symbol.dispose Tests ====================

    await t.step("Note supports Symbol.dispose", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Test", { "f.txt": "c" });

      const headOid = ctx.repo.headOid()!;

      ctx.repo.createNote(
        headOid,
        "Test note",
        { name: "Test", email: "test@example.com" },
      );

      {
        using note = ctx.repo.readNote(headOid)!;
        assertEquals(note.message, "Test note");
        // Note will be disposed when scope exits
      }
      // If we get here without error, Symbol.dispose worked
    });

    await t.step("Note free is idempotent", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Test", { "f.txt": "c" });

      const headOid = ctx.repo.headOid()!;

      ctx.repo.createNote(
        headOid,
        "Test",
        { name: "Test", email: "test@example.com" },
      );

      const note = ctx.repo.readNote(headOid)!;

      // Multiple frees should be safe
      note.free();
      note.free();
      note.free();
    });

    await t.step("Note throws when accessed after free", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Test", { "f.txt": "c" });

      const headOid = ctx.repo.headOid()!;

      ctx.repo.createNote(
        headOid,
        "Test note",
        { name: "Test", email: "test@example.com" },
      );

      const note = ctx.repo.readNote(headOid)!;

      // Verify note works before free
      assertEquals(note.message, "Test note");

      // Free the note
      note.free();

      // Accessing properties after free should throw
      let threw = false;
      try {
        const _msg = note.message;
      } catch (e) {
        threw = true;
        assertEquals((e as Error).message, "Note has been freed");
      }
      assertEquals(
        threw,
        true,
        "Should have thrown when accessing message after free",
      );

      // Test oid property throws too
      threw = false;
      try {
        const _oid = note.oid;
      } catch (e) {
        threw = true;
        assertEquals((e as Error).message, "Note has been freed");
      }
      assertEquals(
        threw,
        true,
        "Should have thrown when accessing oid after free",
      );

      // Test author property throws too
      threw = false;
      try {
        const _author = note.author;
      } catch (e) {
        threw = true;
        assertEquals((e as Error).message, "Note has been freed");
      }
      assertEquals(
        threw,
        true,
        "Should have thrown when accessing author after free",
      );

      // Test committer property throws too
      threw = false;
      try {
        const _committer = note.committer;
      } catch (e) {
        threw = true;
        assertEquals((e as Error).message, "Note has been freed");
      }
      assertEquals(
        threw,
        true,
        "Should have thrown when accessing committer after free",
      );
    });

    // ==================== Edge Cases ====================

    await t.step("create note with unicode message", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Test", { "f.txt": "c" });

      const headOid = ctx.repo.headOid()!;
      const unicodeMessage = "こんにちは世界 🌍 émojis: 🎉🚀";

      ctx.repo.createNote(
        headOid,
        unicodeMessage,
        { name: "Test", email: "test@example.com" },
      );

      const note = ctx.repo.readNote(headOid);
      assertExists(note);
      assertEquals(note.message, unicodeMessage);
      note.free();
    });

    await t.step("create note with very long message", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });
      await createCommitWithFiles(ctx, "Test", { "f.txt": "c" });

      const headOid = ctx.repo.headOid()!;
      const longMessage = "A".repeat(10000);

      ctx.repo.createNote(
        headOid,
        longMessage,
        { name: "Test", email: "test@example.com" },
      );

      const note = ctx.repo.readNote(headOid);
      assertExists(note);
      assertEquals(note.message.length, 10000);
      note.free();
    });

    await t.step("note on different commits are independent", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });

      await createCommitWithFiles(ctx, "C1", { "1.txt": "1" });
      const c1 = ctx.repo.headOid()!;

      await createCommitWithFiles(ctx, "C2", { "2.txt": "2" });
      const c2 = ctx.repo.headOid()!;

      ctx.repo.createNote(c1, "Note for C1", { name: "T", email: "t@e.c" });
      ctx.repo.createNote(c2, "Note for C2", { name: "T", email: "t@e.c" });

      // Each note should be independent
      const note1 = ctx.repo.readNote(c1);
      const note2 = ctx.repo.readNote(c2);

      assertExists(note1);
      assertExists(note2);
      assertEquals(note1.message, "Note for C1");
      assertEquals(note2.message, "Note for C2");
      assertNotEquals(note1.oid, note2.oid);

      note1.free();
      note2.free();
    });

    await t.step("removing one note doesn't affect others", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });

      await createCommitWithFiles(ctx, "C1", { "1.txt": "1" });
      const c1 = ctx.repo.headOid()!;

      await createCommitWithFiles(ctx, "C2", { "2.txt": "2" });
      const c2 = ctx.repo.headOid()!;

      ctx.repo.createNote(c1, "Note 1", { name: "T", email: "t@e.c" });
      ctx.repo.createNote(c2, "Note 2", { name: "T", email: "t@e.c" });

      // Remove note from c1
      ctx.repo.removeNote(c1, { name: "T", email: "t@e.c" });

      // c2's note should still exist
      const note2 = ctx.repo.readNote(c2);
      assertExists(note2);
      assertEquals(note2.message, "Note 2");
      note2.free();

      // c1's note should be gone
      const note1 = ctx.repo.readNote(c1);
      assertEquals(note1, null);
    });

    await t.step(
      "note author and committer can differ from signature",
      async () => {
        await using ctx = await createTestContext({ withInitialCommit: true });
        await createCommitWithFiles(ctx, "Test", { "f.txt": "c" });

        const headOid = ctx.repo.headOid()!;

        // In this implementation, author and committer are the same
        ctx.repo.createNote(
          headOid,
          "Test",
          { name: "Author Name", email: "author@example.com" },
        );

        const note = ctx.repo.readNote(headOid);
        assertExists(note);
        assertExists(note.author);
        assertExists(note.committer);

        // Both should match the provided signature
        assertEquals(note.author.name, "Author Name");
        assertEquals(note.author.email, "author@example.com");
        assertEquals(note.committer.name, "Author Name");
        assertEquals(note.committer.email, "author@example.com");

        note.free();
      },
    );

    await t.step("list notes after some removed", async () => {
      await using ctx = await createTestContext({ withInitialCommit: true });

      await createCommitWithFiles(ctx, "C1", { "1.txt": "1" });
      const c1 = ctx.repo.headOid()!;

      await createCommitWithFiles(ctx, "C2", { "2.txt": "2" });
      const c2 = ctx.repo.headOid()!;

      await createCommitWithFiles(ctx, "C3", { "3.txt": "3" });
      const c3 = ctx.repo.headOid()!;

      // Create notes on all
      ctx.repo.createNote(c1, "N1", { name: "T", email: "t@e.c" });
      ctx.repo.createNote(c2, "N2", { name: "T", email: "t@e.c" });
      ctx.repo.createNote(c3, "N3", { name: "T", email: "t@e.c" });

      assertEquals(ctx.repo.listNotes().length, 3);

      // Remove middle note
      ctx.repo.removeNote(c2, { name: "T", email: "t@e.c" });

      const remaining = ctx.repo.listNotes();
      assertEquals(remaining.length, 2);

      const remainingOids = remaining.map((n) => n.annotatedOid);
      assertEquals(remainingOids.includes(c1), true);
      assertEquals(remainingOids.includes(c2), false);
      assertEquals(remainingOids.includes(c3), true);
    });
});
