/**
 * Stash module - Git stash management routines
 */

import { getLibrary } from "./library.ts";
import { checkError } from "./error.ts";
import {
  bytesToHex,
  createOutPointer,
  ptrOf,
  readOidHex,
  toCString,
} from "./utils.ts";
import { Signature } from "./signature.ts";

/**
 * Stash flags
 */
export enum StashFlags {
  /** No option, default */
  DEFAULT = 0,
  /** All changes already added to the index are left intact in the working directory */
  KEEP_INDEX = 1 << 0,
  /** All untracked files are also stashed and then cleaned up from the working directory */
  INCLUDE_UNTRACKED = 1 << 1,
  /** All ignored files are also stashed and then cleaned up from the working directory */
  INCLUDE_IGNORED = 1 << 2,
}

/**
 * Stash apply flags
 */
export enum StashApplyFlags {
  /** Default behavior */
  DEFAULT = 0,
  /** Try to reinstate not only the working tree's changes, but also the index's changes */
  REINSTATE_INDEX = 1 << 0,
}

/**
 * Information about a stash entry
 */
export interface StashEntry {
  /** Index in the stash list (0 = most recent) */
  index: number;
  /** Stash message */
  message: string;
  /** OID of the stash commit */
  oid: string;
}

/**
 * Options for stash save
 */
export interface StashSaveOptions {
  /** The identity of the person performing the stashing */
  stasher: { name: string; email: string };
  /** Optional description along with the stashed state */
  message?: string;
  /** Flags to control the stashing process */
  flags?: StashFlags;
}

/**
 * Options for stash apply/pop
 */
export interface StashApplyOptions {
  /** Flags to control the apply process */
  flags?: StashApplyFlags;
}

/**
 * Save the local modifications to a new stash
 * @param repoPtr Pointer to the repository
 * @param options Stash save options
 * @returns OID of the stash commit, or null if nothing to stash
 */
export function stashSave(
  repoPtr: Deno.PointerValue,
  options: StashSaveOptions,
): string | null {
  const lib = getLibrary();

  // Create output OID buffer
  const oidOut = new Uint8Array(20);

  // Create signature
  const sig = Signature.now(options.stasher.name, options.stasher.email);

  try {
    const messagePtr = options.message
      ? ptrOf(toCString(options.message))
      : null;

    const result = lib.symbols.git_stash_save(
      ptrOf(oidOut),
      repoPtr,
      sig.ptr,
      messagePtr,
      options.flags ?? StashFlags.DEFAULT,
    );

    // GIT_ENOTFOUND (-3) means nothing to stash
    if (result === -3) {
      return null;
    }

    checkError(lib, result, "Failed to save stash");
    return bytesToHex(oidOut);
  } finally {
    sig.free();
  }
}

/**
 * Apply a stashed state from the stash list
 * @param repoPtr Pointer to the repository
 * @param index Position in the stash list (0 = most recent)
 * @param options Apply options
 */
export function stashApply(
  repoPtr: Deno.PointerValue,
  index: number,
  options?: StashApplyOptions,
): void {
  const lib = getLibrary();

  // For now, pass null for options (use defaults)
  // Full options support would require implementing git_stash_apply_options struct
  const result = lib.symbols.git_stash_apply(repoPtr, BigInt(index), null);
  checkError(lib, result, "Failed to apply stash");
}

/**
 * Apply a stashed state and remove it from the stash list
 * @param repoPtr Pointer to the repository
 * @param index Position in the stash list (0 = most recent)
 * @param options Apply options
 */
export function stashPop(
  repoPtr: Deno.PointerValue,
  index: number,
  options?: StashApplyOptions,
): void {
  const lib = getLibrary();

  // For now, pass null for options (use defaults)
  const result = lib.symbols.git_stash_pop(repoPtr, BigInt(index), null);
  checkError(lib, result, "Failed to pop stash");
}

/**
 * Remove a stashed state from the stash list
 * @param repoPtr Pointer to the repository
 * @param index Position in the stash list (0 = most recent)
 */
export function stashDrop(repoPtr: Deno.PointerValue, index: number): void {
  const lib = getLibrary();

  const result = lib.symbols.git_stash_drop(repoPtr, BigInt(index));
  checkError(lib, result, "Failed to drop stash");
}

/**
 * List all stashed states
 * @param repoPtr Pointer to the repository
 * @returns Array of stash entries
 */
export function listStashes(repoPtr: Deno.PointerValue): StashEntry[] {
  const lib = getLibrary();
  const stashes: StashEntry[] = [];

  // Create callback function
  const callback = new Deno.UnsafeCallback(
    {
      parameters: ["usize", "pointer", "pointer", "pointer"],
      result: "i32",
    },
    (
      index: number | bigint,
      messagePtr: Deno.PointerValue,
      oidPtr: Deno.PointerValue,
      _payload: Deno.PointerValue,
    ) => {
      const message = messagePtr
        ? new Deno.UnsafePointerView(messagePtr).getCString()
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

      stashes.push({
        index: Number(index),
        message,
        oid,
      });

      return 0; // Continue iteration
    },
  );

  try {
    const result = lib.symbols.git_stash_foreach(
      repoPtr,
      callback.pointer,
      null,
    );
    checkError(lib, result, "Failed to list stashes");
    return stashes;
  } finally {
    callback.close();
  }
}
