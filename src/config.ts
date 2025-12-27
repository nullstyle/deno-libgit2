/**
 * @module config
 * Git configuration operations
 */

import { getLibrary } from "./library.ts";
import { checkError } from "./error.ts";
import {
  createOutPointer,
  fromCString,
  POINTER_SIZE,
  ptrOf,
  readPointer,
  readPointerValueFromPtrView,
  toCString,
} from "./utils.ts";
import type { Pointer } from "./types.ts";

/** Config priority levels */
export enum GitConfigLevel {
  PROGRAMDATA = 1,
  SYSTEM = 2,
  XDG = 3,
  GLOBAL = 4,
  LOCAL = 5,
  APP = 6,
  HIGHEST_LEVEL = -1,
}

/** A config entry with metadata */
export interface ConfigEntry {
  name: string;
  value: string;
  includeDepth: number;
  level: GitConfigLevel;
}

/** Callback for config iteration */
export type ConfigForeachCallback = (entry: ConfigEntry) => number;

/**
 * Config class wrapping a git_config pointer
 */
export class Config {
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

  /**
   * Get a string config value
   * @returns The value or null if not found
   */
  getString(name: string): string | null {
    const nameStr = toCString(name);
    const outPtr = createOutPointer();

    const result = this._lib.symbols.git_config_get_string(
      ptrOf(outPtr),
      this._ptr,
      ptrOf(nameStr),
    );

    if (result !== 0) {
      return null;
    }

    const valuePtr = readPointer(outPtr);
    if (!valuePtr) {
      return null;
    }

    return new Deno.UnsafePointerView(valuePtr).getCString();
  }

  /**
   * Get an int32 config value
   * @returns The value or null if not found
   */
  getInt32(name: string): number | null {
    const nameStr = toCString(name);
    const outBuf = new Int32Array(1);

    const result = this._lib.symbols.git_config_get_int32(
      ptrOf(new Uint8Array(outBuf.buffer)),
      this._ptr,
      ptrOf(nameStr),
    );

    if (result !== 0) {
      return null;
    }

    return outBuf[0];
  }

  /**
   * Get an int64 config value
   * @returns The value or null if not found
   */
  getInt64(name: string): bigint | null {
    const nameStr = toCString(name);
    const outBuf = new BigInt64Array(1);

    const result = this._lib.symbols.git_config_get_int64(
      ptrOf(new Uint8Array(outBuf.buffer)),
      this._ptr,
      ptrOf(nameStr),
    );

    if (result !== 0) {
      return null;
    }

    return outBuf[0];
  }

  /**
   * Get a boolean config value
   * @returns The value or null if not found
   */
  getBool(name: string): boolean | null {
    const nameStr = toCString(name);
    const outBuf = new Int32Array(1);

    const result = this._lib.symbols.git_config_get_bool(
      ptrOf(new Uint8Array(outBuf.buffer)),
      this._ptr,
      ptrOf(nameStr),
    );

    if (result !== 0) {
      return null;
    }

    return outBuf[0] !== 0;
  }

  /**
   * Get a config entry with full metadata
   */
  getEntry(name: string): ConfigEntry | null {
    const nameStr = toCString(name);
    const outPtr = createOutPointer();

    const result = this._lib.symbols.git_config_get_entry(
      ptrOf(outPtr),
      this._ptr,
      ptrOf(nameStr),
    );

    if (result !== 0) {
      return null;
    }

    const entryPtr = readPointer(outPtr);
    if (!entryPtr) {
      return null;
    }

    try {
      return readConfigEntry(entryPtr);
    } finally {
      this._lib.symbols.git_config_entry_free(entryPtr);
    }
  }

  /**
   * Set a string config value
   */
  setString(name: string, value: string): void {
    const nameStr = toCString(name);
    const valueStr = toCString(value);

    const result = this._lib.symbols.git_config_set_string(
      this._ptr,
      ptrOf(nameStr),
      ptrOf(valueStr),
    );
    checkError(this._lib, result, "Failed to set config string");
  }

  /**
   * Set an int32 config value
   */
  setInt32(name: string, value: number): void {
    const nameStr = toCString(name);

    const result = this._lib.symbols.git_config_set_int32(
      this._ptr,
      ptrOf(nameStr),
      value,
    );
    checkError(this._lib, result, "Failed to set config int32");
  }

  /**
   * Set an int64 config value
   */
  setInt64(name: string, value: bigint): void {
    const nameStr = toCString(name);

    const result = this._lib.symbols.git_config_set_int64(
      this._ptr,
      ptrOf(nameStr),
      value,
    );
    checkError(this._lib, result, "Failed to set config int64");
  }

  /**
   * Set a boolean config value
   */
  setBool(name: string, value: boolean): void {
    const nameStr = toCString(name);

    const result = this._lib.symbols.git_config_set_bool(
      this._ptr,
      ptrOf(nameStr),
      value ? 1 : 0,
    );
    checkError(this._lib, result, "Failed to set config bool");
  }

  /**
   * Delete a config entry
   */
  deleteEntry(name: string): void {
    const nameStr = toCString(name);

    const result = this._lib.symbols.git_config_delete_entry(
      this._ptr,
      ptrOf(nameStr),
    );
    // Don't throw if entry doesn't exist
    if (result !== 0 && result !== -3) {
      checkError(this._lib, result, "Failed to delete config entry");
    }
  }

  /**
   * Iterate over all config entries
   */
  foreach(callback: ConfigForeachCallback): void {
    const cb = new Deno.UnsafeCallback(
      {
        parameters: ["pointer", "pointer"],
        result: "i32",
      },
      (entryPtr: Deno.PointerValue, _payload: Deno.PointerValue) => {
        if (!entryPtr) return 0;
        const entry = readConfigEntry(entryPtr);
        return callback(entry);
      },
    );

    try {
      const result = this._lib.symbols.git_config_foreach(
        this._ptr,
        cb.pointer,
        null,
      );
      // Don't throw on iteration stop
      if (result !== 0 && result !== -30) {
        checkError(this._lib, result, "Failed to iterate config");
      }
    } finally {
      cb.close();
    }
  }

  /**
   * Iterate over config entries matching a pattern
   */
  foreachMatch(regexp: string, callback: ConfigForeachCallback): void {
    const regexpStr = toCString(regexp);

    const cb = new Deno.UnsafeCallback(
      {
        parameters: ["pointer", "pointer"],
        result: "i32",
      },
      (entryPtr: Deno.PointerValue, _payload: Deno.PointerValue) => {
        if (!entryPtr) return 0;
        const entry = readConfigEntry(entryPtr);
        return callback(entry);
      },
    );

    try {
      const result = this._lib.symbols.git_config_foreach_match(
        this._ptr,
        ptrOf(regexpStr),
        cb.pointer,
        null,
      );
      // Don't throw on iteration stop
      if (result !== 0 && result !== -30) {
        checkError(this._lib, result, "Failed to iterate config");
      }
    } finally {
      cb.close();
    }
  }

  /**
   * Create a read-only snapshot of the config
   */
  snapshot(): Config {
    const outPtr = createOutPointer();

    const result = this._lib.symbols.git_config_snapshot(
      ptrOf(outPtr),
      this._ptr,
    );
    checkError(this._lib, result, "Failed to create config snapshot");

    return new Config(readPointer(outPtr));
  }

  /** Free the config object */
  free(): void {
    if (this._ptr) {
      this._lib.symbols.git_config_free(this._ptr);
      this._ptr = null;
    }
  }

  [Symbol.dispose](): void {
    this.free();
  }
}

/**
 * Read a config entry from a pointer
 */
function readConfigEntry(ptr: Pointer): ConfigEntry {
  if (!ptr) {
    throw new Error("Null config entry pointer");
  }

  const view = new Deno.UnsafePointerView(ptr);

  // git_config_entry struct layout:
  // const char *name (8 bytes)
  // const char *value (8 bytes)
  // unsigned int include_depth (4 bytes)
  // git_config_level_t level (4 bytes)
  // ... (free function and payload)

  const namePtrValue = readPointerValueFromPtrView(view, 0);
  const valuePtrValue = readPointerValueFromPtrView(view, POINTER_SIZE);
  const backendPtrValue = readPointerValueFromPtrView(view, POINTER_SIZE * 2);
  const originPtrValue = readPointerValueFromPtrView(view, POINTER_SIZE * 3);
  void backendPtrValue;
  void originPtrValue;
  const includeDepth = view.getUint32(POINTER_SIZE * 4);
  const level = view.getInt32(POINTER_SIZE * 4 + 4);

  const namePtr = namePtrValue === 0n
    ? null
    : Deno.UnsafePointer.create(namePtrValue);
  const valuePtr = valuePtrValue === 0n
    ? null
    : Deno.UnsafePointer.create(valuePtrValue);
  const name = fromCString(namePtr) ?? "";
  const value = fromCString(valuePtr) ?? "";

  return {
    name,
    value,
    includeDepth,
    level: level as GitConfigLevel,
  };
}

/**
 * Get repository config
 */
export function getRepositoryConfig(repoPtr: Pointer): Config {
  const lib = getLibrary();
  const outPtr = createOutPointer();

  const result = lib.symbols.git_repository_config(ptrOf(outPtr), repoPtr);
  checkError(lib, result, "Failed to get repository config");

  return new Config(readPointer(outPtr));
}
