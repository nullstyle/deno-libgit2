/**
 * @module describe
 * Git describe operations for libgit2
 */

import type { LibGit2 } from "./library.ts";
import { checkError } from "./error.ts";
import type { Pointer } from "./types.ts";
import {
  createGitBuf,
  createOutPointer,
  oidFromHex,
  POINTER_SIZE,
  ptrOf,
  readGitBuf,
  readPointer,
  toCString,
  writePointerValue,
} from "./utils.ts";

/**
 * Describe strategy enum
 */
export enum DescribeStrategy {
  /** Only look for annotated tags */
  DEFAULT = 0,
  /** Look for any reference in refs/tags/ */
  TAGS = 1,
  /** Look for any reference in refs/ */
  ALL = 2,
}

/**
 * Options for describe operations
 */
export interface DescribeOptions {
  /** Maximum number of candidate tags to consider (default: 10) */
  maxCandidatesTags?: number;
  /** Reference lookup strategy (default: DEFAULT) */
  strategy?: DescribeStrategy;
  /** Only consider tags matching this pattern */
  pattern?: string;
  /** Only follow first parent when calculating distance */
  onlyFollowFirstParent?: boolean;
  /** Show commit OID as fallback if no tag found */
  showCommitOidAsFallback?: boolean;
  /** Format options */
  formatOptions?: DescribeFormatOptions;
}

/**
 * Options for formatting describe results
 */
export interface DescribeFormatOptions {
  /** Size of abbreviated commit ID (default: 7) */
  abbreviatedSize?: number;
  /** Always use long format even when shorter name could be used */
  alwaysUseLongFormat?: boolean;
  /** Suffix to append if workdir is dirty */
  dirtySuffix?: string;
}

function alignOffset(value: number, alignment: number): number {
  const remainder = value % alignment;
  return remainder === 0 ? value : value + (alignment - remainder);
}

// Struct sizes and offsets
const DESCRIBE_OPTIONS_VERSION = 1;
const DESCRIBE_PATTERN_OFFSET = alignOffset(12, POINTER_SIZE);
const DESCRIBE_ONLY_FOLLOW_OFFSET = DESCRIBE_PATTERN_OFFSET + POINTER_SIZE;
const DESCRIBE_SHOW_COMMIT_OFFSET = DESCRIBE_ONLY_FOLLOW_OFFSET + 4;
const DESCRIBE_OPTIONS_SIZE = alignOffset(
  DESCRIBE_SHOW_COMMIT_OFFSET + 4,
  POINTER_SIZE,
);
const DESCRIBE_FORMAT_OPTIONS_VERSION = 1;
const DESCRIBE_FORMAT_DIRTY_SUFFIX_OFFSET = alignOffset(12, POINTER_SIZE);
const DESCRIBE_FORMAT_OPTIONS_SIZE = alignOffset(
  DESCRIBE_FORMAT_DIRTY_SUFFIX_OFFSET + POINTER_SIZE,
  POINTER_SIZE,
);

/**
 * Create a git_describe_options struct
 */
function createDescribeOptions(
  lib: LibGit2,
  options?: DescribeOptions,
): Uint8Array {
  const opts = new Uint8Array(DESCRIBE_OPTIONS_SIZE);
  const view = new DataView(opts.buffer);

  // Initialize with defaults
  const result = lib.symbols.git_describe_options_init(
    ptrOf(opts),
    DESCRIBE_OPTIONS_VERSION,
  );
  checkError(lib, result, "Failed to initialize describe options");

  // Apply custom options
  if (options?.maxCandidatesTags !== undefined) {
    view.setUint32(4, options.maxCandidatesTags, true);
  }
  if (options?.strategy !== undefined) {
    view.setUint32(8, options.strategy, true);
  }
  if (options?.onlyFollowFirstParent !== undefined) {
    view.setInt32(
      DESCRIBE_ONLY_FOLLOW_OFFSET,
      options.onlyFollowFirstParent ? 1 : 0,
      true,
    );
  }
  if (options?.showCommitOidAsFallback !== undefined) {
    view.setInt32(
      DESCRIBE_SHOW_COMMIT_OFFSET,
      options.showCommitOidAsFallback ? 1 : 0,
      true,
    );
  }

  return opts;
}

/**
 * Create a git_describe_format_options struct
 */
function createDescribeFormatOptions(
  lib: LibGit2,
  options?: DescribeFormatOptions,
): Uint8Array {
  const opts = new Uint8Array(DESCRIBE_FORMAT_OPTIONS_SIZE);
  const view = new DataView(opts.buffer);

  // Initialize with defaults
  const result = lib.symbols.git_describe_format_options_init(
    ptrOf(opts),
    DESCRIBE_FORMAT_OPTIONS_VERSION,
  );
  checkError(lib, result, "Failed to initialize describe format options");

  // Apply custom options
  if (options?.abbreviatedSize !== undefined) {
    view.setUint32(4, options.abbreviatedSize, true);
  }
  if (options?.alwaysUseLongFormat !== undefined) {
    view.setInt32(8, options.alwaysUseLongFormat ? 1 : 0, true);
  }

  return opts;
}

/**
 * Describe a commit
 * @param lib - LibGit2 library instance
 * @param repoPtr - Repository pointer
 * @param oid - Commit OID (hex string)
 * @param options - Describe options
 * @returns Description string
 */
export function describeCommit(
  lib: LibGit2,
  repoPtr: Pointer,
  oid: string,
  options?: DescribeOptions,
): string {
  // First, we need to get the commit object
  const commitOutPtr = createOutPointer();
  const oidBytes = oidFromHex(oid);

  const lookupResult = lib.symbols.git_commit_lookup(
    ptrOf(commitOutPtr),
    repoPtr,
    ptrOf(oidBytes),
  );
  checkError(lib, lookupResult, "Failed to lookup commit");

  const commitPtr = readPointer(commitOutPtr);

  try {
    // Create describe options
    const descOpts = createDescribeOptions(lib, options);

    // Handle pattern option (needs to be a pointer in the struct)
    let patternBytes: Uint8Array | null = null;
    if (options?.pattern) {
      patternBytes = toCString(options.pattern);
      const view = new DataView(descOpts.buffer);
      writePointerValue(
        view,
        DESCRIBE_PATTERN_OFFSET,
        BigInt(Deno.UnsafePointer.value(ptrOf(patternBytes))),
      );
    }

    // Describe the commit
    const resultOutPtr = createOutPointer();
    const descResult = lib.symbols.git_describe_commit(
      ptrOf(resultOutPtr),
      commitPtr,
      ptrOf(descOpts),
    );
    checkError(lib, descResult, "Failed to describe commit");

    const descResultPtr = readPointer(resultOutPtr);

    try {
      // Format the result
      return formatDescribeResult(lib, descResultPtr, options?.formatOptions);
    } finally {
      lib.symbols.git_describe_result_free(descResultPtr);
    }
  } finally {
    lib.symbols.git_commit_free(commitPtr);
  }
}

/**
 * Describe the workdir
 * @param lib - LibGit2 library instance
 * @param repoPtr - Repository pointer
 * @param options - Describe options
 * @returns Description string
 */
export function describeWorkdir(
  lib: LibGit2,
  repoPtr: Pointer,
  options?: DescribeOptions,
): string {
  // Create describe options
  const descOpts = createDescribeOptions(lib, options);

  // Handle pattern option
  let patternBytes: Uint8Array | null = null;
  if (options?.pattern) {
    patternBytes = toCString(options.pattern);
    const view = new DataView(descOpts.buffer);
    writePointerValue(
      view,
      DESCRIBE_PATTERN_OFFSET,
      BigInt(Deno.UnsafePointer.value(ptrOf(patternBytes))),
    );
  }

  // Describe workdir
  const resultOutPtr = createOutPointer();
  const descResult = lib.symbols.git_describe_workdir(
    ptrOf(resultOutPtr),
    repoPtr,
    ptrOf(descOpts),
  );
  checkError(lib, descResult, "Failed to describe workdir");

  const descResultPtr = readPointer(resultOutPtr);

  try {
    // Format the result
    return formatDescribeResult(lib, descResultPtr, options?.formatOptions);
  } finally {
    lib.symbols.git_describe_result_free(descResultPtr);
  }
}

/**
 * Format a describe result to string
 */
function formatDescribeResult(
  lib: LibGit2,
  resultPtr: Pointer,
  options?: DescribeFormatOptions,
): string {
  // Create format options
  const formatOpts = createDescribeFormatOptions(lib, options);

  // Handle dirty suffix option
  let dirtySuffixBytes: Uint8Array | null = null;
  if (options?.dirtySuffix) {
    dirtySuffixBytes = toCString(options.dirtySuffix);
    const view = new DataView(formatOpts.buffer);
    writePointerValue(
      view,
      DESCRIBE_FORMAT_DIRTY_SUFFIX_OFFSET,
      BigInt(Deno.UnsafePointer.value(ptrOf(dirtySuffixBytes))),
    );
  }

  const buf = createGitBuf();
  try {
    const formatResult = lib.symbols.git_describe_format(
      ptrOf(buf),
      resultPtr,
      ptrOf(formatOpts),
    );
    checkError(lib, formatResult, "Failed to format describe result");
    return readGitBuf(buf) ?? "";
  } finally {
    lib.symbols.git_buf_dispose(ptrOf(buf));
  }
}
