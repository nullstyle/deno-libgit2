/**
 * @module utils
 * Utility functions for FFI operations
 */

import { GIT_OID_HEXSIZE, GIT_OID_SIZE, type Pointer } from "./types.ts";

/**
 * Text encoder for converting strings to bytes
 */
const encoder = new TextEncoder();

/**
 * Text decoder for converting bytes to strings
 */
const decoder = new TextDecoder();

/**
 * Pointer/size_t width for the current runtime
 */
const runtimeArch = Deno.build.arch as string;
export const POINTER_SIZE = runtimeArch === "x86" || runtimeArch === "arm"
  ? 4
  : 8;

/**
 * Read a pointer-sized value from a DataView
 */
export function readPointerValue(view: DataView, offset = 0): bigint {
  return POINTER_SIZE === 8
    ? view.getBigUint64(offset, true)
    : BigInt(view.getUint32(offset, true));
}

/**
 * Read a pointer-sized value from an UnsafePointerView
 */
export function readPointerValueFromPtrView(
  view: Deno.UnsafePointerView,
  offset = 0,
): bigint {
  return POINTER_SIZE === 8
    ? view.getBigUint64(offset)
    : BigInt(view.getUint32(offset));
}

/**
 * Read a size_t value from an UnsafePointerView
 */
export function readSizeValueFromPtrView(
  view: Deno.UnsafePointerView,
  offset = 0,
): bigint {
  return readPointerValueFromPtrView(view, offset);
}

/**
 * Write a pointer-sized value to a DataView
 */
export function writePointerValue(
  view: DataView,
  offset: number,
  value: bigint,
): void {
  if (POINTER_SIZE === 8) {
    view.setBigUint64(offset, value, true);
  } else {
    view.setUint32(offset, Number(value), true);
  }
}

/**
 * Read a size_t value from a DataView
 */
export function readSizeValue(view: DataView, offset = 0): bigint {
  return readPointerValue(view, offset);
}

/**
 * Write a size_t value to a DataView
 */
export function writeSizeValue(
  view: DataView,
  offset: number,
  value: bigint,
): void {
  writePointerValue(view, offset, value);
}

/**
 * Encode a string to a null-terminated C string buffer
 */
export function toCString(str: string): Uint8Array {
  const bytes = encoder.encode(str);
  const buffer = new Uint8Array(bytes.length + 1);
  buffer.set(bytes);
  buffer[bytes.length] = 0; // null terminator
  return buffer;
}

/**
 * Read a C string from a pointer
 */
export function fromCString(ptr: Pointer): string | null {
  if (ptr === null) {
    return null;
  }
  const view = new Deno.UnsafePointerView(ptr);
  return view.getCString();
}

/**
 * Read a C string from a pointer with a maximum length
 */
export function fromCStringN(ptr: Pointer, maxLen: number): string | null {
  if (ptr === null) {
    return null;
  }
  const view = new Deno.UnsafePointerView(ptr);
  const bytes = new Uint8Array(maxLen);
  view.copyInto(bytes);
  const nullIndex = bytes.indexOf(0);
  const actualBytes = nullIndex >= 0 ? bytes.subarray(0, nullIndex) : bytes;
  return decoder.decode(actualBytes);
}

/**
 * Create a pointer-to-pointer buffer for output parameters
 */
export function createOutPointer(): Uint8Array {
  return new Uint8Array(POINTER_SIZE);
}

/**
 * Read a pointer from a pointer-to-pointer buffer
 */
export function readPointer(buffer: Uint8Array): Pointer {
  const view = new DataView(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength,
  );
  const value = readPointerValue(view);
  if (value === 0n) {
    return null;
  }
  return Deno.UnsafePointer.create(value);
}

/**
 * Get a pointer to a Uint8Array buffer
 * This helper ensures proper typing for Deno.UnsafePointer.of()
 */
export function ptrOf(buffer: ArrayBufferView): Deno.PointerObject {
  const ptr = Deno.UnsafePointer.of(buffer as unknown as BufferSource);
  if (ptr === null) {
    throw new Error("Failed to get pointer for buffer");
  }
  return ptr;
}

export type PointerArray = BigUint64Array | Uint32Array;

/**
 * Create an array for storing pointer values.
 */
export function createPointerArray(length: number): PointerArray {
  return POINTER_SIZE === 8
    ? new BigUint64Array(length)
    : new Uint32Array(length);
}

/**
 * Write a pointer value into a pointer array.
 */
export function writePointerArrayValue(
  array: PointerArray,
  index: number,
  value: bigint,
): void {
  if (POINTER_SIZE === 8) {
    (array as BigUint64Array)[index] = value;
  } else {
    (array as Uint32Array)[index] = Number(value);
  }
}

/**
 * Read a pointer value from a pointer array.
 */
export function readPointerArrayValue(
  array: PointerArray,
  index: number,
): bigint {
  return POINTER_SIZE === 8
    ? (array as BigUint64Array)[index]
    : BigInt((array as Uint32Array)[index]);
}

/**
 * Create a buffer for an OID
 */
export function createOidBuffer(): Uint8Array {
  return new Uint8Array(GIT_OID_SIZE);
}

/**
 * Create a buffer for an OID hex string
 */
export function createOidHexBuffer(): Uint8Array {
  return new Uint8Array(GIT_OID_HEXSIZE);
}

/**
 * Read an OID from a pointer as a hex string
 */
export function readOidHex(ptr: Pointer): string | null {
  if (ptr === null) {
    return null;
  }
  const view = new Deno.UnsafePointerView(ptr);
  const bytes = new Uint8Array(GIT_OID_SIZE);
  view.copyInto(bytes);
  return bytesToHex(bytes);
}

/**
 * Convert bytes to hex string
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Convert hex string to bytes
 */
export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Create an OID buffer from a hex string
 */
export function oidFromHex(hex: string): Uint8Array {
  if (hex.length !== GIT_OID_SIZE * 2) {
    throw new Error(
      `Invalid OID hex string length: ${hex.length}, expected ${
        GIT_OID_SIZE * 2
      }`,
    );
  }
  return hexToBytes(hex);
}

/**
 * Read a 32-bit integer from a buffer
 */
export function readInt32(buffer: Uint8Array, offset = 0): number {
  const view = new DataView(buffer.buffer, buffer.byteOffset + offset, 4);
  return view.getInt32(0, true);
}

/**
 * Read a 64-bit integer from a buffer
 */
export function readInt64(buffer: Uint8Array, offset = 0): bigint {
  const view = new DataView(buffer.buffer, buffer.byteOffset + offset, 8);
  return view.getBigInt64(0, true);
}

/**
 * Read a 32-bit unsigned integer from a buffer
 */
export function readUint32(buffer: Uint8Array, offset = 0): number {
  const view = new DataView(buffer.buffer, buffer.byteOffset + offset, 4);
  return view.getUint32(0, true);
}

/**
 * Read a 64-bit unsigned integer from a buffer
 */
export function readUint64(buffer: Uint8Array, offset = 0): bigint {
  const view = new DataView(buffer.buffer, buffer.byteOffset + offset, 8);
  return view.getBigUint64(0, true);
}

/**
 * Write a 32-bit integer to a buffer
 */
export function writeInt32(
  buffer: Uint8Array,
  value: number,
  offset = 0,
): void {
  const view = new DataView(buffer.buffer, buffer.byteOffset + offset, 4);
  view.setInt32(0, value, true);
}

/**
 * Write a 64-bit integer to a buffer
 */
export function writeInt64(
  buffer: Uint8Array,
  value: bigint,
  offset = 0,
): void {
  const view = new DataView(buffer.buffer, buffer.byteOffset + offset, 8);
  view.setBigInt64(0, value, true);
}

/**
 * Create a strarray structure for passing to libgit2
 * Layout: { char **strings; size_t count; }
 */
export function createStrarray(strings: string[]): {
  buffer: Uint8Array;
  stringBuffers: Uint8Array[];
  pointerArray: ArrayBufferView;
} {
  // Create null-terminated string buffers
  const stringBuffers = strings.map(toCString);

  // Create array of pointers to strings
  const pointerArray = createPointerArray(strings.length);
  for (let i = 0; i < strings.length; i++) {
    const value = Deno.UnsafePointer.value(ptrOf(stringBuffers[i]));
    writePointerArrayValue(pointerArray, i, value);
  }

  // Create strarray structure (pointer + size_t)
  const buffer = new Uint8Array(POINTER_SIZE * 2);
  const view = new DataView(buffer.buffer);

  if (strings.length === 0) {
    writePointerValue(view, 0, 0n);
    writeSizeValue(view, POINTER_SIZE, 0n);
    return { buffer, stringBuffers, pointerArray };
  }

  // Set pointer to string array
  const ptrArrayPtr = ptrOf(pointerArray);
  writePointerValue(view, 0, Deno.UnsafePointer.value(ptrArrayPtr));

  // Set count
  writeSizeValue(view, POINTER_SIZE, BigInt(strings.length));

  return { buffer, stringBuffers, pointerArray };
}

/**
 * Read a strarray from a pointer
 */
export function readStrarray(ptr: Pointer): string[] {
  if (ptr === null) {
    return [];
  }

  const view = new Deno.UnsafePointerView(ptr);
  const stringsPtrValue = readPointerValueFromPtrView(view, 0);
  const stringsPtr = stringsPtrValue === 0n
    ? null
    : Deno.UnsafePointer.create(stringsPtrValue);
  const count = Number(readSizeValueFromPtrView(view, POINTER_SIZE));

  if (stringsPtr === null || count === 0) {
    return [];
  }

  const result: string[] = [];
  const stringsView = new Deno.UnsafePointerView(stringsPtr);

  for (let i = 0; i < count; i++) {
    const strPtrValue = readPointerValueFromPtrView(
      stringsView,
      i * POINTER_SIZE,
    );
    const strPtr = strPtrValue === 0n
      ? null
      : Deno.UnsafePointer.create(strPtrValue);
    if (strPtr !== null) {
      const str = fromCString(strPtr);
      if (str !== null) {
        result.push(str);
      }
    }
  }

  return result;
}

/**
 * Create a git_buf structure
 * Layout: { char *ptr; size_t reserved; size_t size; }
 */
export function createGitBuf(): Uint8Array {
  return new Uint8Array(POINTER_SIZE * 3);
}

/**
 * Read content from a git_buf structure
 */
export function readGitBuf(buffer: Uint8Array): string | null {
  const view = new DataView(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength,
  );
  const ptrValue = readPointerValue(view, 0);
  const size = Number(readSizeValue(view, POINTER_SIZE * 2));
  const ptr = ptrValue === 0n ? null : Deno.UnsafePointer.create(ptrValue);

  if (ptr === null || size === 0) {
    return null;
  }

  return fromCStringN(ptr, size);
}

/**
 * Check if a result code indicates an error
 */
export function isError(code: number): boolean {
  return code < 0;
}

/**
 * Check if a result code indicates success
 */
export function isSuccess(code: number): boolean {
  return code >= 0;
}

/**
 * Parse a signature structure from a pointer
 * Layout: { char *name; char *email; git_time when; }
 * git_time: { git_time_t time; int offset; char sign; }
 */
export function readSignature(ptr: Pointer): {
  name: string;
  email: string;
  when: { time: bigint; offset: number; sign: string };
} | null {
  if (ptr === null) {
    return null;
  }

  const view = new Deno.UnsafePointerView(ptr);

  // Read name pointer
  const namePtrValue = readPointerValueFromPtrView(view, 0);
  const namePtr = namePtrValue === 0n
    ? null
    : Deno.UnsafePointer.create(namePtrValue);
  const name = fromCString(namePtr) ?? "";

  // Read email pointer
  const emailPtrValue = readPointerValueFromPtrView(view, POINTER_SIZE);
  const emailPtr = emailPtrValue === 0n
    ? null
    : Deno.UnsafePointer.create(emailPtrValue);
  const email = fromCString(emailPtr) ?? "";

  // Read git_time structure (after the two pointers)
  const timeOffset = POINTER_SIZE * 2;
  const time = view.getBigInt64(timeOffset);
  const offset = view.getInt32(timeOffset + 8);
  const signByte = view.getUint8(timeOffset + 12);
  const sign = signByte === 43 ? "+" : "-"; // 43 is ASCII for '+'

  return { name, email, when: { time, offset, sign } };
}

/**
 * Format a timestamp with offset to an ISO date string
 */
export function formatGitTime(time: bigint, offset: number): string {
  const date = new Date(Number(time) * 1000);
  const offsetHours = Math.floor(Math.abs(offset) / 60);
  const offsetMinutes = Math.abs(offset) % 60;
  const offsetSign = offset >= 0 ? "+" : "-";
  const offsetStr = `${offsetSign}${offsetHours.toString().padStart(2, "0")}:${
    offsetMinutes.toString().padStart(2, "0")
  }`;

  return date.toISOString().replace("Z", offsetStr);
}

/**
 * Defer cleanup of resources
 */
export class Defer {
  private cleanups: (() => void)[] = [];

  /**
   * Add a cleanup function to be called later
   */
  add(cleanup: () => void): void {
    this.cleanups.push(cleanup);
  }

  /**
   * Run all cleanup functions in reverse order
   */
  run(): void {
    while (this.cleanups.length > 0) {
      const cleanup = this.cleanups.pop();
      if (cleanup) {
        try {
          cleanup();
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }
}
