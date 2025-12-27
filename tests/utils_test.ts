/**
 * Unit tests for utils.ts utility functions
 *
 * These tests validate utility functions including:
 * - Pointer operations (read/write)
 * - String conversions (C strings)
 * - OID handling (hex/bytes)
 * - Buffer operations
 * - Defer class for cleanup
 */

import {
  assert,
  assertEquals,
  assertExists,
  assertNotEquals,
  assertThrows,
} from "@std/assert";
import {
  bytesToHex,
  createGitBuf,
  createOidBuffer,
  createOidHexBuffer,
  createOutPointer,
  createPointerArray,
  createStrarray,
  Defer,
  formatGitTime,
  fromCString,
  fromCStringN,
  hexToBytes,
  isError,
  isSuccess,
  oidFromHex,
  POINTER_SIZE,
  ptrOf,
  readInt32,
  readInt64,
  readOidHex,
  readPointer,
  readPointerArrayValue,
  readPointerValue,
  readSizeValue,
  readUint32,
  readUint64,
  toCString,
  writeInt32,
  writeInt64,
  writePointerArrayValue,
  writePointerValue,
  writeSizeValue,
} from "../src/utils.ts";

Deno.test("Utils Tests", async (t) => {
  // ==================== POINTER_SIZE Tests ====================

  await t.step("POINTER_SIZE is valid", () => {
    // Should be either 4 (32-bit) or 8 (64-bit)
    assert(POINTER_SIZE === 4 || POINTER_SIZE === 8);
  });

  await t.step("POINTER_SIZE matches architecture", () => {
    const arch = Deno.build.arch as string;
    if (arch === "x86" || arch === "arm") {
      assertEquals(POINTER_SIZE, 4);
    } else {
      assertEquals(POINTER_SIZE, 8);
    }
  });

  // ==================== Pointer Value Tests ====================

  await t.step("readPointerValue reads 8-byte value", () => {
    const buffer = new Uint8Array(8);
    const view = new DataView(buffer.buffer);
    view.setBigUint64(0, 0x123456789ABCDEFn, true);

    const value = readPointerValue(view);
    if (POINTER_SIZE === 8) {
      assertEquals(value, 0x123456789ABCDEFn);
    } else {
      assertEquals(value, BigInt(0x9ABCDEF));
    }
  });

  await t.step("readPointerValue with offset", () => {
    const buffer = new Uint8Array(16);
    const view = new DataView(buffer.buffer);
    view.setBigUint64(8, 0xABCDEF0123456789n, true);

    const value = readPointerValue(view, 8);
    if (POINTER_SIZE === 8) {
      assertEquals(value, 0xABCDEF0123456789n);
    }
  });

  await t.step("writePointerValue writes correct value", () => {
    const buffer = new Uint8Array(8);
    const view = new DataView(buffer.buffer);

    writePointerValue(view, 0, 0x1234567890ABCDEFn);

    const readBack = readPointerValue(view);
    if (POINTER_SIZE === 8) {
      assertEquals(readBack, 0x1234567890ABCDEFn);
    }
  });

  await t.step("writePointerValue with offset", () => {
    const buffer = new Uint8Array(16);
    const view = new DataView(buffer.buffer);

    writePointerValue(view, 8, 0xFEDCBA0987654321n);

    const readBack = readPointerValue(view, 8);
    if (POINTER_SIZE === 8) {
      assertEquals(readBack, 0xFEDCBA0987654321n);
    }
  });

  // ==================== Size Value Tests ====================

  await t.step("readSizeValue is alias for readPointerValue", () => {
    const buffer = new Uint8Array(8);
    const view = new DataView(buffer.buffer);
    view.setBigUint64(0, 12345n, true);

    const ptrVal = readPointerValue(view);
    const sizeVal = readSizeValue(view);
    assertEquals(ptrVal, sizeVal);
  });

  await t.step("writeSizeValue writes size value", () => {
    const buffer = new Uint8Array(8);
    const view = new DataView(buffer.buffer);

    writeSizeValue(view, 0, 999n);
    const readBack = readSizeValue(view);
    assertEquals(readBack, 999n);
  });

  // ==================== C String Tests ====================

  await t.step("toCString creates null-terminated string", () => {
    const result = toCString("hello");
    assertEquals(result.length, 6); // 5 chars + null terminator
    assertEquals(result[5], 0);
    assertEquals(new TextDecoder().decode(result.subarray(0, 5)), "hello");
  });

  await t.step("toCString with empty string", () => {
    const result = toCString("");
    assertEquals(result.length, 1);
    assertEquals(result[0], 0);
  });

  await t.step("toCString with unicode", () => {
    const result = toCString("hello 世界");
    assert(result.length > 8); // Unicode chars take multiple bytes
    assertEquals(result[result.length - 1], 0);
  });

  await t.step("toCString with special characters", () => {
    const result = toCString("path/to/file.txt");
    assertEquals(result[result.length - 1], 0);
    assertEquals(
      new TextDecoder().decode(result.subarray(0, result.length - 1)),
      "path/to/file.txt",
    );
  });

  await t.step("fromCString returns null for null pointer", () => {
    const result = fromCString(null);
    assertEquals(result, null);
  });

  await t.step("fromCStringN returns null for null pointer", () => {
    const result = fromCStringN(null, 100);
    assertEquals(result, null);
  });

  // ==================== Out Pointer Tests ====================

  await t.step("createOutPointer creates correct size buffer", () => {
    const outPtr = createOutPointer();
    assertEquals(outPtr.length, POINTER_SIZE);
  });

  await t.step("createOutPointer initializes to zero", () => {
    const outPtr = createOutPointer();
    for (let i = 0; i < outPtr.length; i++) {
      assertEquals(outPtr[i], 0);
    }
  });

  await t.step("readPointer returns null for zero pointer", () => {
    const outPtr = createOutPointer();
    const ptr = readPointer(outPtr);
    assertEquals(ptr, null);
  });

  // ==================== ptrOf Tests ====================

  await t.step("ptrOf returns non-null pointer", () => {
    const buffer = new Uint8Array(8);
    const ptr = ptrOf(buffer);
    assertExists(ptr);
    assertNotEquals(ptr, null);
  });

  await t.step("ptrOf works with different buffer types", () => {
    const uint8 = new Uint8Array(8);
    const uint32 = new Uint32Array(2);
    const bigUint64 = new BigUint64Array(1);

    assertExists(ptrOf(uint8));
    assertExists(ptrOf(uint32));
    assertExists(ptrOf(bigUint64));
  });

  // ==================== Pointer Array Tests ====================

  await t.step("createPointerArray creates correct type", () => {
    const arr = createPointerArray(3);
    assertEquals(arr.length, 3);

    if (POINTER_SIZE === 8) {
      assert(arr instanceof BigUint64Array);
    } else {
      assert(arr instanceof Uint32Array);
    }
  });

  await t.step("writePointerArrayValue and readPointerArrayValue", () => {
    const arr = createPointerArray(3);

    writePointerArrayValue(arr, 0, 111n);
    writePointerArrayValue(arr, 1, 222n);
    writePointerArrayValue(arr, 2, 333n);

    assertEquals(readPointerArrayValue(arr, 0), 111n);
    assertEquals(readPointerArrayValue(arr, 1), 222n);
    assertEquals(readPointerArrayValue(arr, 2), 333n);
  });

  await t.step("pointer array handles large values", () => {
    const arr = createPointerArray(1);

    if (POINTER_SIZE === 8) {
      const largeValue = 0x7FFFFFFFFFFFFFFFn;
      writePointerArrayValue(arr, 0, largeValue);
      assertEquals(readPointerArrayValue(arr, 0), largeValue);
    } else {
      const largeValue = 0x7FFFFFFFn;
      writePointerArrayValue(arr, 0, largeValue);
      assertEquals(readPointerArrayValue(arr, 0), largeValue);
    }
  });

  // ==================== OID Buffer Tests ====================

  await t.step("createOidBuffer creates 20-byte buffer", () => {
    const buf = createOidBuffer();
    assertEquals(buf.length, 20);
  });

  await t.step("createOidHexBuffer creates 41-byte buffer", () => {
    // GIT_OID_HEXSIZE is 41 (40 hex chars + null terminator)
    const buf = createOidHexBuffer();
    assertEquals(buf.length, 41);
  });

  await t.step("readOidHex returns null for null pointer", () => {
    const result = readOidHex(null);
    assertEquals(result, null);
  });

  // ==================== Hex Conversion Tests ====================

  await t.step("bytesToHex converts bytes to hex string", () => {
    const bytes = new Uint8Array([0x00, 0x01, 0x0F, 0xFF, 0xAB]);
    const hex = bytesToHex(bytes);
    assertEquals(hex, "00010fffab");
  });

  await t.step("bytesToHex with empty array", () => {
    const bytes = new Uint8Array(0);
    const hex = bytesToHex(bytes);
    assertEquals(hex, "");
  });

  await t.step("bytesToHex produces lowercase", () => {
    const bytes = new Uint8Array([0xAB, 0xCD, 0xEF]);
    const hex = bytesToHex(bytes);
    assertEquals(hex, "abcdef");
  });

  await t.step("hexToBytes converts hex string to bytes", () => {
    const hex = "00010fffab";
    const bytes = hexToBytes(hex);
    assertEquals(bytes, new Uint8Array([0x00, 0x01, 0x0F, 0xFF, 0xAB]));
  });

  await t.step("hexToBytes with empty string", () => {
    const bytes = hexToBytes("");
    assertEquals(bytes.length, 0);
  });

  await t.step("bytesToHex and hexToBytes are inverse", () => {
    const original = new Uint8Array([0x12, 0x34, 0x56, 0x78, 0x9A, 0xBC, 0xDE]);
    const hex = bytesToHex(original);
    const recovered = hexToBytes(hex);
    assertEquals(recovered, original);
  });

  // ==================== OID Hex Tests ====================

  await t.step("oidFromHex creates 20-byte buffer from hex", () => {
    const hex = "a".repeat(40);
    const oid = oidFromHex(hex);
    assertEquals(oid.length, 20);
    for (const byte of oid) {
      assertEquals(byte, 0xAA);
    }
  });

  await t.step("oidFromHex throws for wrong length", () => {
    assertThrows(
      () => oidFromHex("abc"),
      Error,
      "Invalid OID hex string length",
    );
  });

  await t.step("oidFromHex throws for too long string", () => {
    assertThrows(
      () => oidFromHex("a".repeat(41)),
      Error,
      "Invalid OID hex string length",
    );
  });

  await t.step("oidFromHex with valid SHA-1", () => {
    const hex = "0123456789abcdef0123456789abcdef01234567";
    const oid = oidFromHex(hex);
    assertEquals(oid.length, 20);
    assertEquals(bytesToHex(oid), hex);
  });

  // ==================== Integer Read/Write Tests ====================

  await t.step("readInt32 reads signed 32-bit integer", () => {
    const buffer = new Uint8Array(4);
    const view = new DataView(buffer.buffer);
    view.setInt32(0, -12345, true);

    assertEquals(readInt32(buffer), -12345);
  });

  await t.step("readInt32 with offset", () => {
    const buffer = new Uint8Array(8);
    const view = new DataView(buffer.buffer);
    view.setInt32(4, 99999, true);

    assertEquals(readInt32(buffer, 4), 99999);
  });

  await t.step("readInt64 reads signed 64-bit integer", () => {
    const buffer = new Uint8Array(8);
    const view = new DataView(buffer.buffer);
    view.setBigInt64(0, -9876543210n, true);

    assertEquals(readInt64(buffer), -9876543210n);
  });

  await t.step("readUint32 reads unsigned 32-bit integer", () => {
    const buffer = new Uint8Array(4);
    const view = new DataView(buffer.buffer);
    view.setUint32(0, 0xFFFFFFFF, true);

    assertEquals(readUint32(buffer), 0xFFFFFFFF);
  });

  await t.step("readUint64 reads unsigned 64-bit integer", () => {
    const buffer = new Uint8Array(8);
    const view = new DataView(buffer.buffer);
    view.setBigUint64(0, 0xFFFFFFFFFFFFFFFFn, true);

    assertEquals(readUint64(buffer), 0xFFFFFFFFFFFFFFFFn);
  });

  await t.step("writeInt32 writes signed 32-bit integer", () => {
    const buffer = new Uint8Array(4);
    writeInt32(buffer, -54321);
    assertEquals(readInt32(buffer), -54321);
  });

  await t.step("writeInt32 with offset", () => {
    const buffer = new Uint8Array(8);
    writeInt32(buffer, 12345, 4);
    assertEquals(readInt32(buffer, 4), 12345);
  });

  await t.step("writeInt64 writes signed 64-bit integer", () => {
    const buffer = new Uint8Array(8);
    writeInt64(buffer, -1234567890123456789n);
    assertEquals(readInt64(buffer), -1234567890123456789n);
  });

  await t.step("writeInt64 with offset", () => {
    const buffer = new Uint8Array(16);
    writeInt64(buffer, 9876543210n, 8);
    assertEquals(readInt64(buffer, 8), 9876543210n);
  });

  // ==================== Git Buf Tests ====================

  await t.step("createGitBuf creates correct size buffer", () => {
    const buf = createGitBuf();
    assertEquals(buf.length, POINTER_SIZE * 3);
  });

  await t.step("createGitBuf initializes to zero", () => {
    const buf = createGitBuf();
    for (let i = 0; i < buf.length; i++) {
      assertEquals(buf[i], 0);
    }
  });

  // ==================== Strarray Tests ====================

  await t.step("createStrarray creates structure for strings", () => {
    const strings = ["hello", "world"];
    const result = createStrarray(strings);

    assertExists(result.buffer);
    assertExists(result.stringBuffers);
    assertExists(result.pointerArray);

    assertEquals(result.buffer.length, POINTER_SIZE * 2);
    assertEquals(result.stringBuffers.length, 2);
  });

  await t.step("createStrarray with empty array", () => {
    const strings: string[] = [];
    const result = createStrarray(strings);

    assertEquals(result.stringBuffers.length, 0);
    assertEquals(result.buffer.length, POINTER_SIZE * 2);
  });

  await t.step("createStrarray string buffers are null-terminated", () => {
    const strings = ["test", "string"];
    const result = createStrarray(strings);

    for (const strBuf of result.stringBuffers) {
      assertEquals(strBuf[strBuf.length - 1], 0);
    }
  });

  // ==================== isError/isSuccess Tests ====================

  await t.step("isError returns true for negative codes", () => {
    assertEquals(isError(-1), true);
    assertEquals(isError(-100), true);
    assertEquals(isError(-2147483648), true);
  });

  await t.step("isError returns false for non-negative codes", () => {
    assertEquals(isError(0), false);
    assertEquals(isError(1), false);
    assertEquals(isError(100), false);
  });

  await t.step("isSuccess returns true for non-negative codes", () => {
    assertEquals(isSuccess(0), true);
    assertEquals(isSuccess(1), true);
    assertEquals(isSuccess(100), true);
  });

  await t.step("isSuccess returns false for negative codes", () => {
    assertEquals(isSuccess(-1), false);
    assertEquals(isSuccess(-100), false);
  });

  await t.step("isError and isSuccess are inverse", () => {
    for (const code of [-10, -1, 0, 1, 10]) {
      assertEquals(isError(code), !isSuccess(code));
    }
  });

  // ==================== formatGitTime Tests ====================

  await t.step("formatGitTime formats positive offset", () => {
    const time = BigInt(0); // Unix epoch
    const offset = 60; // +01:00
    const result = formatGitTime(time, offset);
    assert(result.includes("+01:00"));
  });

  await t.step("formatGitTime formats negative offset", () => {
    const time = BigInt(0);
    const offset = -300; // -05:00
    const result = formatGitTime(time, offset);
    assert(result.includes("-05:00"));
  });

  await t.step("formatGitTime formats zero offset", () => {
    const time = BigInt(0);
    const offset = 0;
    const result = formatGitTime(time, offset);
    assert(result.includes("+00:00"));
  });

  await t.step("formatGitTime handles minute offsets", () => {
    const time = BigInt(0);
    const offset = 330; // +05:30 (India)
    const result = formatGitTime(time, offset);
    assert(result.includes("+05:30"));
  });

  await t.step("formatGitTime with actual timestamp", () => {
    const time = BigInt(1700000000); // Approximate date
    const offset = 0;
    const result = formatGitTime(time, offset);
    assert(result.includes("2023")); // Should be in 2023
  });

  // ==================== Defer Class Tests ====================

  await t.step("Defer runs cleanup functions", () => {
    const defer = new Defer();
    let called = false;
    defer.add(() => {
      called = true;
    });
    defer.run();
    assertEquals(called, true);
  });

  await t.step("Defer runs cleanups in reverse order", () => {
    const defer = new Defer();
    const order: number[] = [];

    defer.add(() => order.push(1));
    defer.add(() => order.push(2));
    defer.add(() => order.push(3));

    defer.run();
    assertEquals(order, [3, 2, 1]);
  });

  await t.step("Defer handles empty cleanups", () => {
    const defer = new Defer();
    defer.run(); // Should not throw
  });

  await t.step("Defer ignores errors in cleanup", () => {
    const defer = new Defer();
    let secondCalled = false;

    defer.add(() => {
      secondCalled = true;
    });
    defer.add(() => {
      throw new Error("cleanup error");
    });
    defer.add(() => {});

    // Should not throw
    defer.run();

    // Second cleanup should still be called
    assertEquals(secondCalled, true);
  });

  await t.step("Defer can add multiple cleanups", () => {
    const defer = new Defer();
    let count = 0;

    for (let i = 0; i < 10; i++) {
      defer.add(() => count++);
    }

    defer.run();
    assertEquals(count, 10);
  });

  await t.step("Defer run clears cleanups", () => {
    const defer = new Defer();
    let count = 0;

    defer.add(() => count++);
    defer.run();
    defer.run(); // Second run should be no-op

    assertEquals(count, 1);
  });

  await t.step("Defer can be reused after run", () => {
    const defer = new Defer();
    let count = 0;

    defer.add(() => count++);
    defer.run();

    defer.add(() => count++);
    defer.run();

    assertEquals(count, 2);
  });

  // ==================== Edge Cases ====================

  await t.step("hexToBytes handles uppercase", () => {
    const hex = "ABCDEF";
    const bytes = hexToBytes(hex);
    assertEquals(bytes, new Uint8Array([0xAB, 0xCD, 0xEF]));
  });

  await t.step("hexToBytes handles mixed case", () => {
    const hex = "AbCdEf";
    const bytes = hexToBytes(hex);
    assertEquals(bytes, new Uint8Array([0xAB, 0xCD, 0xEF]));
  });

  await t.step("bytesToHex pads single digits", () => {
    const bytes = new Uint8Array([0x01, 0x02, 0x0A]);
    const hex = bytesToHex(bytes);
    assertEquals(hex, "01020a");
  });

  await t.step("int32 round-trip preserves value", () => {
    const buffer = new Uint8Array(4);
    const values = [0, 1, -1, 2147483647, -2147483648, 12345, -12345];

    for (const val of values) {
      writeInt32(buffer, val);
      assertEquals(readInt32(buffer), val);
    }
  });

  await t.step("int64 round-trip preserves value", () => {
    const buffer = new Uint8Array(8);
    const values = [
      0n,
      1n,
      -1n,
      9223372036854775807n,
      -9223372036854775808n,
      1234567890123456789n,
      -1234567890123456789n,
    ];

    for (const val of values) {
      writeInt64(buffer, val);
      assertEquals(readInt64(buffer), val);
    }
  });

  await t.step("formatGitTime with large timestamp", () => {
    const time = BigInt(2000000000); // Far future
    const result = formatGitTime(time, 0);
    assert(result.includes("2033")); // Should be in 2033
  });
});
