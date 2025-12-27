/**
 * @module odb
 * Object Database operations
 */

import { getLibrary } from "./library.ts";
import { checkError } from "./error.ts";
import {
  bytesToHex,
  createOutPointer,
  createPointerArray,
  oidFromHex,
  ptrOf,
  readOidHex,
  readPointer,
  readPointerArrayValue,
} from "./utils.ts";
import type { GitObjectType, Pointer } from "./types.ts";

/**
 * Object header information
 */
export interface OdbObjectHeader {
  /** Object size in bytes */
  size: number;
  /** Object type */
  type: GitObjectType;
}

/**
 * Represents an object read from the ODB
 */
export class OdbObject {
  private _ptr: Pointer;
  private _lib: ReturnType<typeof getLibrary>;

  constructor(ptr: Pointer) {
    this._ptr = ptr;
    this._lib = getLibrary();
  }

  /**
   * Get the OID of the object
   */
  get oid(): string {
    const oidPtr = this._lib.symbols.git_odb_object_id(this._ptr);
    return readOidHex(oidPtr) ?? "";
  }

  /**
   * Get the type of the object
   */
  get type(): GitObjectType {
    return this._lib.symbols.git_odb_object_type(this._ptr) as GitObjectType;
  }

  /**
   * Get the size of the object data
   */
  get size(): number {
    return Number(this._lib.symbols.git_odb_object_size(this._ptr));
  }

  /**
   * Get the raw data of the object
   */
  get data(): Uint8Array {
    const dataPtr = this._lib.symbols.git_odb_object_data(this._ptr);
    const size = this.size;

    if (dataPtr === null || size === 0) {
      return new Uint8Array(0);
    }

    return new Uint8Array(
      Deno.UnsafePointerView.getArrayBuffer(dataPtr, size),
    );
  }

  /**
   * Free the object
   */
  free(): void {
    if (this._ptr) {
      this._lib.symbols.git_odb_object_free(this._ptr);
      this._ptr = null;
    }
  }

  [Symbol.dispose](): void {
    this.free();
  }
}

/**
 * Represents a Git Object Database
 */
export class Odb {
  private _ptr: Pointer;
  private _lib: ReturnType<typeof getLibrary>;

  constructor(ptr: Pointer) {
    this._ptr = ptr;
    this._lib = getLibrary();
  }

  /**
   * Get the underlying pointer
   */
  get ptr(): Pointer {
    return this._ptr;
  }

  /**
   * Check if an object exists in the database
   * @param oid - Object ID (hex string)
   * @returns true if the object exists
   */
  exists(oid: string): boolean {
    const oidBuf = oidFromHex(oid);
    const result = this._lib.symbols.git_odb_exists(this._ptr, ptrOf(oidBuf));
    return result === 1;
  }

  /**
   * Check if an object exists by prefix and return the full OID
   * @param prefix - OID prefix (at least 4 characters)
   * @returns Full OID if found, null otherwise
   */
  existsPrefix(prefix: string): string | null {
    const prefixLen = prefix.length;
    if (prefixLen < 4) {
      throw new Error("Prefix must be at least 4 characters");
    }

    // Pad the prefix to full OID length for the buffer
    const paddedPrefix = prefix.padEnd(40, "0");
    const oidBuf = oidFromHex(paddedPrefix);
    const outOid = new Uint8Array(20);

    const result = this._lib.symbols.git_odb_exists_prefix(
      ptrOf(outOid),
      this._ptr,
      ptrOf(oidBuf),
      BigInt(prefixLen),
    );

    if (result === 0) {
      return bytesToHex(outOid);
    }

    return null;
  }

  /**
   * Read the header of an object (type and size only)
   * @param oid - Object ID (hex string)
   * @returns Object header information
   */
  readHeader(oid: string): OdbObjectHeader {
    const oidBuf = oidFromHex(oid);
    const sizeOut = createPointerArray(1);
    const typeOut = new Int32Array(1);

    const error = this._lib.symbols.git_odb_read_header(
      ptrOf(sizeOut),
      ptrOf(typeOut),
      this._ptr,
      ptrOf(oidBuf),
    );
    checkError(this._lib, error, "Failed to read object header");

    return {
      size: Number(readPointerArrayValue(sizeOut, 0)),
      type: typeOut[0] as GitObjectType,
    };
  }

  /**
   * Read an object from the database
   * @param oid - Object ID (hex string)
   * @returns The object
   */
  read(oid: string): OdbObject {
    const oidBuf = oidFromHex(oid);
    const outPtr = createOutPointer();

    const error = this._lib.symbols.git_odb_read(
      ptrOf(outPtr),
      this._ptr,
      ptrOf(oidBuf),
    );
    checkError(this._lib, error, "Failed to read object");

    return new OdbObject(readPointer(outPtr));
  }

  /**
   * Write an object to the database
   * @param data - Object data
   * @param type - Object type
   * @returns The OID of the written object
   */
  write(data: Uint8Array, type: GitObjectType): string {
    const outOid = new Uint8Array(20);

    const error = this._lib.symbols.git_odb_write(
      ptrOf(outOid),
      this._ptr,
      ptrOf(data),
      BigInt(data.length),
      type,
    );
    checkError(this._lib, error, "Failed to write object");

    return bytesToHex(outOid);
  }

  /**
   * Hash data without writing to the database
   * @param data - Data to hash
   * @param type - Object type
   * @returns The computed OID
   */
  hash(data: Uint8Array, type: GitObjectType): string {
    const outOid = new Uint8Array(20);

    const error = this._lib.symbols.git_odb_hash(
      ptrOf(outOid),
      ptrOf(data),
      BigInt(data.length),
      type,
    );
    checkError(this._lib, error, "Failed to hash data");

    return bytesToHex(outOid);
  }

  /**
   * Free the ODB
   */
  free(): void {
    if (this._ptr) {
      this._lib.symbols.git_odb_free(this._ptr);
      this._ptr = null;
    }
  }

  [Symbol.dispose](): void {
    this.free();
  }
}

/**
 * Get the object database from a repository
 * @param repoPtr - Repository pointer
 * @returns The ODB
 */
export function getRepositoryOdb(repoPtr: Pointer): Odb {
  const lib = getLibrary();
  const outPtr = createOutPointer();

  const error = lib.symbols.git_repository_odb(ptrOf(outPtr), repoPtr);
  checkError(lib, error, "Failed to get repository ODB");

  return new Odb(readPointer(outPtr));
}
