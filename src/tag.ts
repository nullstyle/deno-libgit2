/**
 * @module tag
 * Git tag operations
 */

import { getLibrary } from "./library.ts";
import { checkError } from "./error.ts";
import {
  bytesToHex,
  createOutPointer,
  fromCString,
  oidFromHex,
  POINTER_SIZE,
  ptrOf,
  readOidHex,
  readPointer,
  readPointerValueFromPtrView,
  readStrarray,
  toCString,
} from "./utils.ts";
import { Signature, type SignatureInfo } from "./signature.ts";
import type { Pointer } from "./types.ts";

/** Git object types */
export enum GitObjectType {
  ANY = -2,
  INVALID = -1,
  COMMIT = 1,
  TREE = 2,
  BLOB = 3,
  TAG = 4,
  OFS_DELTA = 6,
  REF_DELTA = 7,
}

/** Options for creating an annotated tag */
export interface CreateTagOptions {
  /** Tag name */
  name: string;
  /** OID of the target object (usually a commit) */
  targetOid: string;
  /** Tagger signature */
  tagger: SignatureInfo;
  /** Tag message */
  message: string;
  /** Force overwrite if tag exists */
  force?: boolean;
}

/** Options for creating a lightweight tag */
export interface CreateLightweightTagOptions {
  /** Tag name */
  name: string;
  /** OID of the target object (usually a commit) */
  targetOid: string;
  /** Force overwrite if tag exists */
  force?: boolean;
}

/** Information about a tag from foreach iteration */
export interface TagForeachInfo {
  /** Tag reference name (e.g., "refs/tags/v1.0.0") */
  name: string;
  /** Tag OID */
  oid: string;
}

/**
 * Tag class wrapping a git_tag pointer
 */
export class Tag {
  private _ptr: Pointer;
  private _lib: ReturnType<typeof getLibrary>;

  constructor(ptr: Pointer) {
    this._ptr = ptr;
    this._lib = getLibrary();
  }

  /** Get the raw pointer */
  get ptr(): Pointer {
    return this._ptr;
  }

  /** Get the tag's OID */
  get oid(): string {
    const oidPtr = this._lib.symbols.git_tag_id(this._ptr);
    return readOidHex(oidPtr) ?? "";
  }

  /** Get the tag name */
  get name(): string {
    const namePtr = this._lib.symbols.git_tag_name(this._ptr);
    if (!namePtr) return "";
    return new Deno.UnsafePointerView(namePtr).getCString();
  }

  /** Get the tag message */
  get message(): string {
    const msgPtr = this._lib.symbols.git_tag_message(this._ptr);
    if (!msgPtr) return "";
    return new Deno.UnsafePointerView(msgPtr).getCString();
  }

  /** Get the target object's OID */
  get targetOid(): string {
    const oidPtr = this._lib.symbols.git_tag_target_id(this._ptr);
    return readOidHex(oidPtr) ?? "";
  }

  /** Get the target object's type */
  get targetType(): string {
    const typeNum = this._lib.symbols.git_tag_target_type(this._ptr);
    switch (typeNum) {
      case GitObjectType.COMMIT:
        return "commit";
      case GitObjectType.TREE:
        return "tree";
      case GitObjectType.BLOB:
        return "blob";
      case GitObjectType.TAG:
        return "tag";
      default:
        return "unknown";
    }
  }

  /** Get the tagger signature */
  get tagger(): SignatureInfo | null {
    const sigPtr = this._lib.symbols.git_tag_tagger(this._ptr);
    if (!sigPtr) return null;

    // Read signature struct: name (pointer), email (pointer), when (git_time)
    const view = new Deno.UnsafePointerView(sigPtr);
    const namePtrValue = readPointerValueFromPtrView(view, 0);
    const emailPtrValue = readPointerValueFromPtrView(view, POINTER_SIZE);
    const time = view.getBigInt64(POINTER_SIZE * 2);
    const offset = view.getInt32(POINTER_SIZE * 2 + 8);

    const namePtr = namePtrValue === 0n
      ? null
      : Deno.UnsafePointer.create(namePtrValue);
    const emailPtr = emailPtrValue === 0n
      ? null
      : Deno.UnsafePointer.create(emailPtrValue);
    const name = fromCString(namePtr) ?? "";
    const email = fromCString(emailPtr) ?? "";

    return {
      name,
      email,
      time: Number(time),
      offset,
    };
  }

  /**
   * Peel the tag to its target object
   * @returns OID of the target object
   */
  peel(): string {
    const outPtr = createOutPointer();
    const result = this._lib.symbols.git_tag_peel(ptrOf(outPtr), this._ptr);
    checkError(this._lib, result, "Failed to peel tag");

    const objectPtr = readPointer(outPtr);
    const oidPtr = this._lib.symbols.git_object_id(objectPtr);
    const oid = readOidHex(oidPtr) ?? "";

    this._lib.symbols.git_object_free(objectPtr);
    return oid;
  }

  /** Free the tag object */
  free(): void {
    if (this._ptr) {
      this._lib.symbols.git_tag_free(this._ptr);
      this._ptr = null;
    }
  }

  [Symbol.dispose](): void {
    this.free();
  }
}

/**
 * Create an annotated tag
 */
export function createTag(
  repoPtr: Pointer,
  options: CreateTagOptions,
): string {
  const lib = getLibrary();

  // Create output OID buffer
  const oidOut = new Uint8Array(20);

  // Create signature
  const sig = Signature.fromInfo(options.tagger, lib);

  // Lookup target object
  const targetOid = oidFromHex(options.targetOid);
  const objectOutPtr = createOutPointer();
  let result = lib.symbols.git_object_lookup(
    ptrOf(objectOutPtr),
    repoPtr,
    ptrOf(targetOid),
    GitObjectType.ANY,
  );
  checkError(lib, result, "Failed to lookup target object");
  const objectPtr = readPointer(objectOutPtr);

  try {
    // Create tag
    const nameStr = toCString(options.name);
    const messageStr = toCString(options.message);

    result = lib.symbols.git_tag_create(
      ptrOf(oidOut),
      repoPtr,
      ptrOf(nameStr),
      objectPtr,
      sig.ptr,
      ptrOf(messageStr),
      options.force ? 1 : 0,
    );
    checkError(lib, result, "Failed to create tag");

    return bytesToHex(oidOut);
  } finally {
    lib.symbols.git_object_free(objectPtr);
    sig.free();
  }
}

/**
 * Create a lightweight tag
 */
export function createLightweightTag(
  repoPtr: Pointer,
  options: CreateLightweightTagOptions,
): string {
  const lib = getLibrary();

  // Create output OID buffer
  const oidOut = new Uint8Array(20);

  // Lookup target object
  const targetOid = oidFromHex(options.targetOid);
  const objectOutPtr = createOutPointer();
  let result = lib.symbols.git_object_lookup(
    ptrOf(objectOutPtr),
    repoPtr,
    ptrOf(targetOid),
    GitObjectType.ANY,
  );
  checkError(lib, result, "Failed to lookup target object");
  const objectPtr = readPointer(objectOutPtr);

  try {
    // Create lightweight tag
    const nameStr = toCString(options.name);

    result = lib.symbols.git_tag_create_lightweight(
      ptrOf(oidOut),
      repoPtr,
      ptrOf(nameStr),
      objectPtr,
      options.force ? 1 : 0,
    );
    checkError(lib, result, "Failed to create lightweight tag");

    return bytesToHex(oidOut);
  } finally {
    lib.symbols.git_object_free(objectPtr);
  }
}

/**
 * List all tags in the repository
 */
export function listTags(repoPtr: Pointer, pattern?: string): string[] {
  const lib = getLibrary();

  // git_strarray struct: char **strings, size_t count
  const strarray = new Uint8Array(POINTER_SIZE * 2);

  let result: number;
  if (pattern) {
    const patternStr = toCString(pattern);
    result = lib.symbols.git_tag_list_match(
      ptrOf(strarray),
      ptrOf(patternStr),
      repoPtr,
    );
  } else {
    result = lib.symbols.git_tag_list(ptrOf(strarray), repoPtr);
  }
  checkError(lib, result, "Failed to list tags");

  const tags = readStrarray(ptrOf(strarray));

  // Free strarray
  lib.symbols.git_strarray_free(ptrOf(strarray));

  return tags;
}

/**
 * Lookup a tag by OID
 */
export function lookupTag(repoPtr: Pointer, oid: string): Tag {
  const lib = getLibrary();

  const oidBytes = oidFromHex(oid);
  const outPtr = createOutPointer();

  const result = lib.symbols.git_tag_lookup(
    ptrOf(outPtr),
    repoPtr,
    ptrOf(oidBytes),
  );
  checkError(lib, result, "Failed to lookup tag");

  return new Tag(readPointer(outPtr));
}

/**
 * Delete a tag by name
 */
export function deleteTag(repoPtr: Pointer, name: string): void {
  const lib = getLibrary();

  const nameStr = toCString(name);
  const result = lib.symbols.git_tag_delete(repoPtr, ptrOf(nameStr));
  checkError(lib, result, "Failed to delete tag");
}

/**
 * Iterate over all tags in the repository
 */
export function foreachTag(repoPtr: Pointer): TagForeachInfo[] {
  const lib = getLibrary();

  const tags: TagForeachInfo[] = [];

  const callback = new Deno.UnsafeCallback(
    {
      parameters: ["pointer", "pointer", "pointer"],
      result: "i32",
    },
    (
      namePtr: Deno.PointerValue,
      oidPtr: Deno.PointerValue,
      _payload: Deno.PointerValue,
    ) => {
      const name = namePtr
        ? new Deno.UnsafePointerView(namePtr).getCString()
        : "";

      // Read OID from pointer
      let oid = "";
      if (oidPtr) {
        const oidView = new Deno.UnsafePointerView(oidPtr);
        const oidBytes = new Uint8Array(20);
        for (let i = 0; i < 20; i++) {
          oidBytes[i] = oidView.getUint8(i);
        }
        oid = bytesToHex(oidBytes);
      }

      tags.push({ name, oid });
      return 0; // Continue iteration
    },
  );

  try {
    const result = lib.symbols.git_tag_foreach(repoPtr, callback.pointer, null);
    checkError(lib, result, "Failed to iterate tags");
    return tags;
  } finally {
    callback.close();
  }
}
