/**
 * @module mailmap
 * Mailmap operations for resolving author/committer identities
 */

import { getLibrary } from "./library.ts";
import { checkError } from "./error.ts";
import {
  createOutPointer,
  fromCString,
  ptrOf,
  readPointer,
  toCString,
} from "./utils.ts";

/**
 * Result of resolving a name/email through a mailmap
 */
export interface ResolvedIdentity {
  name: string;
  email: string;
}

/**
 * Mailmap class for resolving author/committer identities
 */
export class Mailmap {
  private ptr: Deno.PointerValue;
  private lib: ReturnType<typeof getLibrary>;

  private constructor(ptr: Deno.PointerValue) {
    this.ptr = ptr;
    this.lib = getLibrary();
  }

  /**
   * Get the raw pointer to the mailmap
   */
  get pointer(): Deno.PointerValue {
    return this.ptr;
  }

  /**
   * Create a new empty mailmap
   */
  static create(): Mailmap {
    const lib = getLibrary();
    const outPtr = createOutPointer();
    const error = lib.symbols.git_mailmap_new(ptrOf(outPtr));
    checkError(lib, error, "Failed to create mailmap");
    return new Mailmap(readPointer(outPtr));
  }

  /**
   * Create a mailmap from a buffer containing mailmap content
   * @param content The mailmap file content
   */
  static fromBuffer(content: string): Mailmap {
    const lib = getLibrary();
    const outPtr = createOutPointer();
    const contentBytes = new TextEncoder().encode(content);
    const error = lib.symbols.git_mailmap_from_buffer(
      ptrOf(outPtr),
      ptrOf(contentBytes),
      BigInt(contentBytes.length),
    );
    checkError(lib, error, "Failed to create mailmap from buffer");
    return new Mailmap(readPointer(outPtr));
  }

  /**
   * Create a mailmap from a repository
   * @param repoPtr Pointer to the repository
   */
  static fromRepository(repoPtr: Deno.PointerValue): Mailmap {
    const lib = getLibrary();
    const outPtr = createOutPointer();
    const error = lib.symbols.git_mailmap_from_repository(
      ptrOf(outPtr),
      repoPtr,
    );
    checkError(lib, error, "Failed to create mailmap from repository");
    return new Mailmap(readPointer(outPtr));
  }

  /**
   * Add an entry to the mailmap
   * @param realName The real name to use (or null)
   * @param realEmail The real email to use (or null)
   * @param replaceName The name to replace (or null)
   * @param replaceEmail The email to replace
   */
  addEntry(
    realName: string | null,
    realEmail: string | null,
    replaceName: string | null,
    replaceEmail: string,
  ): void {
    const realNamePtr = realName ? ptrOf(toCString(realName)) : null;
    const realEmailPtr = realEmail ? ptrOf(toCString(realEmail)) : null;
    const replaceNamePtr = replaceName ? ptrOf(toCString(replaceName)) : null;
    const replaceEmailPtr = ptrOf(toCString(replaceEmail));

    const error = this.lib.symbols.git_mailmap_add_entry(
      this.ptr,
      realNamePtr,
      realEmailPtr,
      replaceNamePtr,
      replaceEmailPtr,
    );
    checkError(this.lib, error, "Failed to add mailmap entry");
  }

  /**
   * Resolve a name and email using the mailmap
   * @param name The name to resolve
   * @param email The email to resolve
   * @returns The resolved name and email
   */
  resolve(name: string, email: string): ResolvedIdentity {
    const realNameOutPtr = createOutPointer();
    const realEmailOutPtr = createOutPointer();
    const namePtr = ptrOf(toCString(name));
    const emailPtr = ptrOf(toCString(email));

    const error = this.lib.symbols.git_mailmap_resolve(
      ptrOf(realNameOutPtr),
      ptrOf(realEmailOutPtr),
      this.ptr,
      namePtr,
      emailPtr,
    );
    checkError(this.lib, error, "Failed to resolve mailmap entry");

    const realNamePtr = readPointer(realNameOutPtr);
    const realEmailPtr = readPointer(realEmailOutPtr);

    return {
      name: (realNamePtr ? fromCString(realNamePtr) : name) ?? name,
      email: (realEmailPtr ? fromCString(realEmailPtr) : email) ?? email,
    };
  }

  /**
   * Free the mailmap
   */
  free(): void {
    if (this.ptr) {
      this.lib.symbols.git_mailmap_free(this.ptr);
      this.ptr = null;
    }
  }

  [Symbol.dispose](): void {
    this.free();
  }
}
