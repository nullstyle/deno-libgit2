/**
 * @module error
 * Error handling for libgit2 operations
 */

import { GitErrorClass, GitErrorCode, type Pointer } from "./types.ts";
import {
  fromCString,
  POINTER_SIZE,
  readPointerValueFromPtrView,
} from "./utils.ts";

/**
 * Git error with detailed information from libgit2
 */
export class GitError extends Error {
  /** Error code from libgit2 */
  readonly code: GitErrorCode;
  /** Error class from libgit2 */
  readonly errorClass: GitErrorClass;

  constructor(
    message: string,
    code: GitErrorCode,
    errorClass: GitErrorClass = GitErrorClass.NONE,
  ) {
    super(message);
    this.name = "GitError";
    this.code = code;
    this.errorClass = errorClass;
  }

  /**
   * Get a human-readable error code name
   */
  get codeName(): string {
    return GitErrorCode[this.code] ?? `UNKNOWN(${this.code})`;
  }

  /**
   * Get a human-readable error class name
   */
  get className(): string {
    return GitErrorClass[this.errorClass] ?? `UNKNOWN(${this.errorClass})`;
  }

  /**
   * Format the error as a detailed string
   */
  override toString(): string {
    return `GitError [${this.codeName}/${this.className}]: ${this.message}`;
  }
}

/**
 * Get the last error from libgit2 and create a GitError
 * @param lib - The loaded libgit2 library
 * @param defaultMessage - Default message if no error is available
 * @param code - Error code (if known)
 */
export function getLastError(
  lib: { symbols: { git_error_last: () => Pointer } },
  defaultMessage: string,
  code: number = GitErrorCode.ERROR,
): GitError {
  const errorPtr = lib.symbols.git_error_last();

  if (errorPtr === null) {
    return new GitError(defaultMessage, code as GitErrorCode);
  }

  // git_error structure: { char *message; int klass; }
  const view = new Deno.UnsafePointerView(errorPtr);
  const messagePtrValue = readPointerValueFromPtrView(view, 0);
  const messagePtr = messagePtrValue === 0n
    ? null
    : Deno.UnsafePointer.create(messagePtrValue);
  const errorClass = view.getInt32(POINTER_SIZE) as GitErrorClass;

  const message = fromCString(messagePtr) ?? defaultMessage;

  return new GitError(message, code as GitErrorCode, errorClass);
}

type ErrorSource = { symbols: { git_error_last: () => Pointer } };

/**
 * Check a libgit2 result code and throw if it indicates an error
 * @param lib - The loaded libgit2 library
 * @param code - The result code to check
 * @param operation - Description of the operation for error messages
 */
export function checkError(
  lib: ErrorSource,
  code: number,
  operation: string,
): void;
/**
 * Check a libgit2 result code without a library instance
 * @param code - The result code to check
 * @param operation - Description of the operation for error messages
 * @param context - Optional context (e.g., function name)
 */
export function checkError(
  code: number,
  operation: string,
  context?: string,
): void;
export function checkError(
  libOrCode: ErrorSource | number,
  codeOrOperation: number | string,
  operationOrContext?: string,
): void {
  if (typeof libOrCode === "number") {
    const code = libOrCode;
    if (code < 0) {
      const operation = typeof codeOrOperation === "string"
        ? codeOrOperation
        : "libgit2 operation failed";
      const contextSuffix = operationOrContext
        ? ` (${operationOrContext})`
        : "";
      throw new GitError(
        `${operation}${contextSuffix} (code ${code})`,
        code as GitErrorCode,
      );
    }
    return;
  }

  const code = codeOrOperation as number;
  const operation = operationOrContext ?? "libgit2 operation failed";
  if (code < 0) {
    throw getLastError(
      libOrCode,
      `${operation} failed with code ${code}`,
      code,
    );
  }
}

/**
 * Wrap a libgit2 operation and convert errors to GitError
 * @param lib - The loaded libgit2 library
 * @param operation - Description of the operation
 * @param fn - The function to execute
 */
export function wrapError<T>(
  _lib: { symbols: { git_error_last: () => Pointer } },
  operation: string,
  fn: () => T,
): T {
  try {
    return fn();
  } catch (error) {
    if (error instanceof GitError) {
      throw error;
    }
    throw new GitError(
      `${operation}: ${error instanceof Error ? error.message : String(error)}`,
      GitErrorCode.ERROR,
    );
  }
}

/**
 * Error messages for common error codes
 */
export const errorMessages: Record<GitErrorCode, string> = {
  [GitErrorCode.OK]: "No error",
  [GitErrorCode.ERROR]: "Generic error",
  [GitErrorCode.ENOTFOUND]: "Object not found",
  [GitErrorCode.EEXISTS]: "Object already exists",
  [GitErrorCode.EAMBIGUOUS]: "Ambiguous reference",
  [GitErrorCode.EBUFS]: "Buffer too short",
  [GitErrorCode.EUSER]: "User-defined error",
  [GitErrorCode.EBAREREPO]: "Operation not allowed on bare repository",
  [GitErrorCode.EUNBORNBRANCH]: "Branch has no commits",
  [GitErrorCode.EUNMERGED]: "Merge in progress",
  [GitErrorCode.ENONFASTFORWARD]: "Not a fast-forward",
  [GitErrorCode.EINVALIDSPEC]: "Invalid specification",
  [GitErrorCode.ECONFLICT]: "Checkout conflicts",
  [GitErrorCode.ELOCKED]: "Resource is locked",
  [GitErrorCode.EMODIFIED]: "Reference was modified",
  [GitErrorCode.EAUTH]: "Authentication failed",
  [GitErrorCode.ECERTIFICATE]: "Invalid certificate",
  [GitErrorCode.EAPPLIED]: "Patch already applied",
  [GitErrorCode.EPEEL]: "Cannot peel object",
  [GitErrorCode.EEOF]: "Unexpected end of file",
  [GitErrorCode.EINVALID]: "Invalid operation or input",
  [GitErrorCode.EUNCOMMITTED]: "Uncommitted changes",
  [GitErrorCode.EDIRECTORY]: "Invalid for directory",
  [GitErrorCode.EMERGECONFLICT]: "Merge conflict",
  [GitErrorCode.PASSTHROUGH]: "Callback refused",
  [GitErrorCode.ITEROVER]: "Iteration complete",
  [GitErrorCode.RETRY]: "Internal retry",
  [GitErrorCode.EMISMATCH]: "Hashsum mismatch",
  [GitErrorCode.EINDEXDIRTY]: "Index has unsaved changes",
  [GitErrorCode.EAPPLYFAIL]: "Patch application failed",
  [GitErrorCode.EOWNER]: "Object not owned by user",
  [GitErrorCode.TIMEOUT]: "Operation timed out",
};

/**
 * Get a human-readable message for an error code
 */
export function getErrorMessage(code: GitErrorCode): string {
  return errorMessages[code] ?? `Unknown error (${code})`;
}
