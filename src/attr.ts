/**
 * @module attr
 * Git attribute operations
 */

import type { LibGit2 } from "./library.ts";
import type { Pointer } from "./types.ts";
import {
  createOutPointer,
  createPointerArray,
  ptrOf,
  readPointer,
  readPointerArrayValue,
  toCString,
  writePointerArrayValue,
} from "./utils.ts";
import { checkError } from "./error.ts";

/**
 * Possible states for an attribute
 */
export enum GitAttrValue {
  /** The attribute has been left unspecified */
  UNSPECIFIED = 0,
  /** The attribute has been set (e.g., `*.c foo`) */
  TRUE = 1,
  /** The attribute has been unset (e.g., `*.h -foo`) */
  FALSE = 2,
  /** This attribute has a value (e.g., `*.txt eol=lf`) */
  STRING = 3,
}

/**
 * Attribute check flags
 */
export const GitAttrCheckFlags = {
  /** Check working directory then index (default) */
  FILE_THEN_INDEX: 0,
  /** Check index then working directory */
  INDEX_THEN_FILE: 1,
  /** Only check index */
  INDEX_ONLY: 2,
  /** Ignore system gitattributes */
  NO_SYSTEM: 1 << 2,
  /** Include HEAD .gitattributes */
  INCLUDE_HEAD: 1 << 3,
} as const;

/**
 * Result of an attribute lookup
 */
export interface AttrResult {
  /** The type of the attribute value */
  type: GitAttrValue;
  /** The string value if type is STRING, otherwise undefined */
  value?: string;
}

/**
 * Get the value type for a given attribute string
 */
export function getAttrValueType(
  lib: LibGit2,
  attrValue: string | null,
): GitAttrValue {
  if (attrValue === null) {
    return GitAttrValue.UNSPECIFIED;
  }

  const attrStr = toCString(attrValue);
  const result = lib.symbols.git_attr_value(ptrOf(attrStr)) as number;
  return result as GitAttrValue;
}

/**
 * Get a single attribute for a path
 */
export function getAttr(
  lib: LibGit2,
  repoPtr: Pointer,
  path: string,
  name: string,
  flags: number = GitAttrCheckFlags.FILE_THEN_INDEX,
): AttrResult {
  const pathStr = toCString(path);
  const nameStr = toCString(name);
  const outPtr = createOutPointer();

  const result = lib.symbols.git_attr_get(
    ptrOf(outPtr),
    repoPtr,
    flags,
    ptrOf(pathStr),
    ptrOf(nameStr),
  ) as number;

  checkError(lib, result, "Failed to get attribute");

  const valuePtr = readPointer(outPtr);

  if (!valuePtr) {
    return { type: GitAttrValue.UNSPECIFIED };
  }

  // Get the value type
  const valueType = lib.symbols.git_attr_value(valuePtr) as number;

  if (valueType === GitAttrValue.STRING) {
    const valueStr = new Deno.UnsafePointerView(valuePtr).getCString();
    return { type: GitAttrValue.STRING, value: valueStr };
  }

  return { type: valueType as GitAttrValue };
}

/**
 * Get multiple attributes for a path at once
 */
export function getAttrMany(
  lib: LibGit2,
  repoPtr: Pointer,
  path: string,
  names: string[],
  flags: number = GitAttrCheckFlags.FILE_THEN_INDEX,
): AttrResult[] {
  const pathStr = toCString(path);
  const numAttrs = names.length;

  // Create array of name pointers
  const nameStrs = names.map((n) => toCString(n));
  const namePtrs = createPointerArray(numAttrs);
  for (let i = 0; i < numAttrs; i++) {
    writePointerArrayValue(
      namePtrs,
      i,
      Deno.UnsafePointer.value(ptrOf(nameStrs[i])),
    );
  }

  // Output array for value pointers
  const outPtrs = createPointerArray(numAttrs);

  const result = lib.symbols.git_attr_get_many(
    ptrOf(outPtrs),
    repoPtr,
    flags,
    ptrOf(pathStr),
    BigInt(numAttrs),
    ptrOf(namePtrs),
  ) as number;

  checkError(lib, result, "Failed to get attributes");

  // Convert results
  const results: AttrResult[] = [];
  for (let i = 0; i < numAttrs; i++) {
    const ptrValue = readPointerArrayValue(outPtrs, i);

    if (ptrValue === 0n) {
      results.push({ type: GitAttrValue.UNSPECIFIED });
      continue;
    }

    const valuePtr = Deno.UnsafePointer.create(ptrValue);
    const valueType = lib.symbols.git_attr_value(valuePtr) as number;

    if (valueType === GitAttrValue.STRING) {
      const valueStr = new Deno.UnsafePointerView(valuePtr!).getCString();
      results.push({ type: GitAttrValue.STRING, value: valueStr });
    } else {
      results.push({ type: valueType as GitAttrValue });
    }
  }

  return results;
}

/**
 * Callback type for foreachAttr
 */
export type AttrForeachCallback = (
  name: string,
  value: string | null,
) => number;

/**
 * Iterate over all attributes for a path
 */
export function foreachAttr(
  lib: LibGit2,
  repoPtr: Pointer,
  path: string,
  callback: AttrForeachCallback,
  flags: number = GitAttrCheckFlags.FILE_THEN_INDEX,
): void {
  const pathStr = toCString(path);

  // Create callback function
  const cb = new Deno.UnsafeCallback(
    {
      parameters: ["pointer", "pointer", "pointer"],
      result: "i32",
    } as const,
    (
      namePtr: Deno.PointerValue,
      valuePtr: Deno.PointerValue,
      _payload: Deno.PointerValue,
    ) => {
      const name = namePtr
        ? new Deno.UnsafePointerView(namePtr).getCString()
        : "";
      const value = valuePtr
        ? new Deno.UnsafePointerView(valuePtr).getCString()
        : null;
      return callback(name, value);
    },
  );

  try {
    const result = lib.symbols.git_attr_foreach(
      repoPtr,
      flags,
      ptrOf(pathStr),
      cb.pointer,
      null,
    ) as number;

    if (result !== 0 && result !== -31) { // -31 is GIT_EUSER (callback returned non-zero)
      checkError(lib, result, "Failed to iterate attributes");
    }
  } finally {
    cb.close();
  }
}

/**
 * Flush the gitattributes cache
 */
export function attrCacheFlush(lib: LibGit2, repoPtr: Pointer): void {
  const result = lib.symbols.git_attr_cache_flush(repoPtr) as number;
  checkError(lib, result, "Failed to flush attribute cache");
}

/**
 * Add a macro definition
 */
export function addAttrMacro(
  lib: LibGit2,
  repoPtr: Pointer,
  name: string,
  values: string,
): void {
  const nameStr = toCString(name);
  const valuesStr = toCString(values);

  const result = lib.symbols.git_attr_add_macro(
    repoPtr,
    ptrOf(nameStr),
    ptrOf(valuesStr),
  ) as number;

  checkError(lib, result, "Failed to add attribute macro");
}
