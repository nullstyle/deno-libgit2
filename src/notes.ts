/**
 * @module notes
 * Git notes operations for libgit2
 */

import { getLibrary, type LibGit2 } from "./library.ts";
import { checkError } from "./error.ts";
import type { GitSignature, Pointer } from "./types.ts";
import {
  createGitBuf,
  createOutPointer,
  fromCString,
  oidFromHex,
  POINTER_SIZE,
  ptrOf,
  readGitBuf,
  readOidHex,
  readPointer,
  readPointerValueFromPtrView,
  toCString,
} from "./utils.ts";
import { Signature, type SignatureInfo } from "./signature.ts";

/**
 * Options for creating a note
 */
export interface NoteCreateOptions {
  /** Notes reference (default: refs/notes/commits) */
  notesRef?: string;
  /** Force overwrite existing note */
  force?: boolean;
}

/**
 * Options for reading a note
 */
export interface NoteReadOptions {
  /** Notes reference (default: refs/notes/commits) */
  notesRef?: string;
}

/**
 * Note entry from iteration
 */
export interface NoteEntry {
  /** OID of the note blob */
  noteOid: string;
  /** OID of the annotated object */
  annotatedOid: string;
}

/**
 * Represents a Git note
 */
export class Note {
  private _ptr: Pointer;
  private _lib: LibGit2;
  private _freed = false;

  constructor(ptr: Pointer, lib?: LibGit2) {
    this._ptr = ptr;
    this._lib = lib ?? getLibrary();
  }

  /**
   * Get the note message
   */
  get message(): string {
    this.ensureNotFreed();
    const msgPtr = this._lib.symbols.git_note_message(this._ptr);
    return fromCString(msgPtr) ?? "";
  }

  /**
   * Get the note OID
   */
  get oid(): string {
    this.ensureNotFreed();
    const oidPtr = this._lib.symbols.git_note_id(this._ptr);
    return readOidHex(oidPtr) ?? "";
  }

  /**
   * Get the note author
   */
  get author(): GitSignature | null {
    this.ensureNotFreed();
    const sigPtr = this._lib.symbols.git_note_author(this._ptr);
    if (!sigPtr) return null;
    return readSignature(sigPtr);
  }

  /**
   * Get the note committer
   */
  get committer(): GitSignature | null {
    this.ensureNotFreed();
    const sigPtr = this._lib.symbols.git_note_committer(this._ptr);
    if (!sigPtr) return null;
    return readSignature(sigPtr);
  }

  /**
   * Free the note object
   */
  free(): void {
    if (!this._freed) {
      this._lib.symbols.git_note_free(this._ptr);
      this._freed = true;
    }
  }

  [Symbol.dispose](): void {
    this.free();
  }

  private ensureNotFreed(): void {
    if (this._freed) {
      throw new Error("Note has been freed");
    }
  }
}

/**
 * Read a git_signature from a pointer
 */
function readSignature(ptr: Pointer): GitSignature {
  if (!ptr) {
    return {
      name: "",
      email: "",
      when: { time: 0n, offset: 0, sign: "+" },
    };
  }
  const view = new Deno.UnsafePointerView(ptr);

  // git_signature struct layout:
  // char *name (pointer)
  // char *email (pointer)
  // git_time when { git_time_t time, int offset, char sign }

  const namePtrValue = readPointerValueFromPtrView(view, 0);
  const emailPtrValue = readPointerValueFromPtrView(view, POINTER_SIZE);
  const time = view.getBigInt64(POINTER_SIZE * 2);
  const offset = view.getInt32(POINTER_SIZE * 2 + 8);
  const signByte = view.getUint8(POINTER_SIZE * 2 + 12);
  const sign = signByte === 43 ? "+" : "-";

  return {
    name: namePtrValue !== 0n
      ? (fromCString(Deno.UnsafePointer.create(namePtrValue)) ?? "")
      : "",
    email: emailPtrValue !== 0n
      ? (fromCString(Deno.UnsafePointer.create(emailPtrValue)) ?? "")
      : "",
    when: { time, offset, sign },
  };
}

/**
 * Create a note on an object
 * @param lib - LibGit2 library instance
 * @param repoPtr - Repository pointer
 * @param oid - OID of the object to annotate
 * @param message - Note message
 * @param signature - Author/committer signature
 * @param options - Create options
 * @returns OID of the created note
 */
export function createNote(
  lib: LibGit2,
  repoPtr: Pointer,
  oid: string,
  message: string,
  signature: SignatureInfo,
  options?: NoteCreateOptions,
): string {
  const outOid = new Uint8Array(20);
  const notesRefBytes = options?.notesRef ? toCString(options.notesRef) : null;
  const notesRefPtr = notesRefBytes ? ptrOf(notesRefBytes) : null;
  const messageBytes = toCString(message);
  const targetOid = oidFromHex(oid);
  const force = options?.force ? 1 : 0;

  // Create signature
  const sig = Signature.fromInfo(signature, lib);

  try {
    const result = lib.symbols.git_note_create(
      ptrOf(outOid),
      repoPtr,
      notesRefPtr,
      sig.ptr,
      sig.ptr, // Use same signature for author and committer
      ptrOf(targetOid),
      ptrOf(messageBytes),
      force,
    );

    checkError(lib, result, "Failed to create note");

    return readOidHex(ptrOf(outOid)) ?? "";
  } finally {
    sig.free();
  }
}

/**
 * Read a note from an object
 * @param lib - LibGit2 library instance
 * @param repoPtr - Repository pointer
 * @param oid - OID of the annotated object
 * @param options - Read options
 * @returns Note object or null if not found
 */
export function readNote(
  lib: LibGit2,
  repoPtr: Pointer,
  oid: string,
  options?: NoteReadOptions,
): Note | null {
  const outPtr = createOutPointer();
  const notesRefBytes = options?.notesRef ? toCString(options.notesRef) : null;
  const notesRefPtr = notesRefBytes ? ptrOf(notesRefBytes) : null;
  const targetOid = oidFromHex(oid);

  const result = lib.symbols.git_note_read(
    ptrOf(outPtr),
    repoPtr,
    notesRefPtr,
    ptrOf(targetOid),
  );

  if (result < 0) {
    // Note not found
    return null;
  }

  return new Note(readPointer(outPtr), lib);
}

/**
 * Remove a note from an object
 * @param lib - LibGit2 library instance
 * @param repoPtr - Repository pointer
 * @param oid - OID of the annotated object
 * @param signature - Author/committer signature
 * @param options - Options including notes reference
 */
export function removeNote(
  lib: LibGit2,
  repoPtr: Pointer,
  oid: string,
  signature: SignatureInfo,
  options?: NoteReadOptions,
): void {
  const notesRefBytes = options?.notesRef ? toCString(options.notesRef) : null;
  const notesRefPtr = notesRefBytes ? ptrOf(notesRefBytes) : null;
  const targetOid = oidFromHex(oid);

  // Create signature
  const sig = Signature.fromInfo(signature, lib);

  try {
    const result = lib.symbols.git_note_remove(
      repoPtr,
      notesRefPtr,
      sig.ptr,
      sig.ptr, // Use same signature for author and committer
      ptrOf(targetOid),
    );

    checkError(lib, result, "Failed to remove note");
  } finally {
    sig.free();
  }
}

/**
 * List all notes in a repository
 * @param lib - LibGit2 library instance
 * @param repoPtr - Repository pointer
 * @param options - Options including notes reference
 * @returns Array of note entries
 */
export function listNotes(
  lib: LibGit2,
  repoPtr: Pointer,
  options?: NoteReadOptions,
): NoteEntry[] {
  const iterPtr = createOutPointer();
  const notesRefBytes = options?.notesRef ? toCString(options.notesRef) : null;
  const notesRefPtr = notesRefBytes ? ptrOf(notesRefBytes) : null;

  const result = lib.symbols.git_note_iterator_new(
    ptrOf(iterPtr),
    repoPtr,
    notesRefPtr,
  );

  if (result < 0) {
    // No notes or error
    return [];
  }

  const iterator = readPointer(iterPtr);
  const notes: NoteEntry[] = [];

  try {
    const noteOid = new Uint8Array(20);
    const annotatedOid = new Uint8Array(20);

    while (true) {
      const nextResult = lib.symbols.git_note_next(
        ptrOf(noteOid),
        ptrOf(annotatedOid),
        iterator,
      );

      if (nextResult < 0) {
        // End of iteration or error
        break;
      }

      notes.push({
        noteOid: readOidHex(ptrOf(noteOid)) ?? "",
        annotatedOid: readOidHex(ptrOf(annotatedOid)) ?? "",
      });
    }
  } finally {
    lib.symbols.git_note_iterator_free(iterator);
  }

  return notes;
}

/**
 * Get the default notes reference for a repository
 * @param lib - LibGit2 library instance
 * @param repoPtr - Repository pointer
 * @returns Default notes reference
 */
export function defaultNotesRef(lib: LibGit2, repoPtr: Pointer): string {
  const buf = createGitBuf();
  try {
    const result = lib.symbols.git_note_default_ref(ptrOf(buf), repoPtr);
    checkError(lib, result, "Failed to get default notes reference");
    return readGitBuf(buf) ?? "refs/notes/commits";
  } finally {
    lib.symbols.git_buf_dispose(ptrOf(buf));
  }
}
