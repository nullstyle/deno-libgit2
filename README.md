# Deno Libgit2

[![JSR](https://jsr.io/badges/@manus/libgit2)](https://jsr.io/@manus/libgit2)

A Deno FFI binding for the [libgit2](https://libgit2.org/) library, providing a
powerful and flexible way to interact with Git repositories directly from Deno.

This package offers a modern, type-safe, and object-oriented API for common Git
operations, built on top of the performance and reliability of libgit2.

## Features

- **Comprehensive Git Operations**: Open, create, and inspect repositories;
  manage branches, commits, and the index (staging area).
- **High-Level API**: An intuitive, class-based API (`Repository`, `Index`,
  `Commit`) that simplifies complex libgit2 functions.
- **Type-Safe**: Full TypeScript support with detailed type definitions for
  libgit2 structures and enums.
- **Cross-Platform**: Works on any platform supported by Deno and libgit2
  (Linux, macOS, Windows).
- **No Dependencies**: Relies only on the Deno runtime and a system installation
  of libgit2.
- **JSR Published**: Easy to import and use in any Deno project.

## Requirements

- **Deno**: Version 2.6 or later.
- **libgit2**: A shared library installation of libgit2 is required on your
  system.

### Installing libgit2

- **Ubuntu/Debian**: `sudo apt-get install libgit2-dev`
- **macOS (Homebrew)**: `brew install libgit2`
- **Windows (vcpkg)**: `vcpkg install libgit2`

## Installation

Import the package from JSR in your Deno project:

```typescript
import * as git from "jsr:@manus/libgit2";
```

## Implemented Features

### High-Priority APIs

- **Merge**: `merge`, `mergeBase`, `mergeAnalysis`
- **Blame**: `blameFile`
- **Reflog**: `readReflog`, `deleteReflog`, `renameReflog`
- **Submodule**: `listSubmodules`, `lookupSubmodule`, `submoduleStatus`
- **Rebase**: `initRebase`, `openRebase`, `next`, `abort`, `commit`, `finish`

### Medium-Priority APIs

- **Cherry-pick**: `cherrypick`, `cherrypickCommit`
- **Revert**: `revert`, `revertCommit`
- **Diff**: `diffTreeToTree`, `diffTreeToWorkdir`, `diffIndexToWorkdir`
- **Patch**: `patchFromDiff`, `patch.toString()`, `patch.lineStats`
- **Apply**: `apply`, `applyToTree`
- **Worktree**: `addWorktree`, `listWorktrees`, `lookupWorktree`, `lock`,
  `unlock`, `prune`
- **Notes**: `createNote`, `readNote`, `removeNote`, `listNotes`
- **Describe**: `describeCommit`, `describeWorkdir`
- **Graph**: `aheadBehind`, `isDescendantOf`

### Low-Priority APIs

- **Stash**: `stashSave`, `stashApply`, `stashPop`, `stashDrop`, `listStashes`
- **Tag**: `createTag`, `createLightweightTag`, `listTags`, `deleteTag`
- **Config**: `getConfig`, `setConfig`
- **Attr**: `getAttr`, `addMacro`
- **Ignore**: `addIgnoreRule`, `clearIgnoreRules`, `pathIsIgnored`
- **Pathspec**: `createPathspec`, `matchesPath`
- **Mailmap**: `getMailmap`, `resolveSignature`
- **Message**: `prettifyMessage`, `parseTrailers`
- **ODB**: `odb`, `read`, `write`, `exists`, `hash`

### Core Functionality

- **Repository Operations**: `init`, `open`, `discover`, `close`
- **Branch Management**: `listBranches`, `createBranch`, `deleteBranch`
- **Commit Operations**: `createCommit`, `lookupCommit`, `walkHistory`
- **Index/Staging Area**: `add`, `remove`, `write`, `writeTree`
- **Reference Handling**: `listReferences`, `lookupReference`,
  `resolveReference`
- **Working Directory Status**: `status`
- **File History Tracking**: `findFileDeletion`, `findFileHistory`,
  `findFileModifications`
- **Full TypeScript type definitions**

## Usage

All libgit2 operations must be wrapped in `init()` and `shutdown()` calls to
manage the library's global state.

### Resource Management

Classes that wrap native resources implement `Symbol.dispose` and can be used
with `using` for automatic cleanup. You can still call `close()`/`free()`
directly when needed.

```typescript
import { init, Repository, shutdown } from "jsr:@manus/libgit2";

init();
try {
  using repo = Repository.open(".");
  console.log(repo.headOid());
} finally {
  shutdown();
}
```

### Finding Deleted File History

A common use case is tracking the history of deleted files. This library
provides specialized functions for this:

```typescript
import {
  findFileDeletion,
  findFileHistory,
  init,
  Repository,
  shutdown,
} from "jsr:@manus/libgit2";

init();

try {
  using repo = Repository.open("/path/to/repo");

  // Find when a file was deleted and get its last content
  const deletion = findFileDeletion(repo, ".dork/blocks/some-uuid.md");
  if (deletion) {
    console.log("Deleted in:", deletion.deletedInCommit.commitOid);
    console.log("Last existed in:", deletion.lastExistedInCommit.commitOid);
    console.log("Content at deletion:", deletion.lastContent);
  }

  // Find all commits where a file existed
  const history = findFileHistory(repo, "path/to/file.md");
  console.log(`File appeared in ${history.commits.length} commits`);
} finally {
  shutdown();
}
```

### Basic Example: Opening a Repository

```typescript
import { init, Repository, shutdown } from "jsr:@manus/libgit2";

// Initialize the library
init();

try {
  // Open a repository from the current directory
  using repo = Repository.open(".");

  console.log(`Repository path: ${repo.path}`);
  console.log(`Is bare: ${repo.isBare}`);

  // Get the current HEAD commit
  if (!repo.isEmpty) {
    const head = repo.head();
    console.log(`HEAD is at: ${head.target}`);
  }
} finally {
  // Always shut down the library
  shutdown();
}
```

### Creating a Commit

```typescript
import {
  createCommit,
  Index,
  init,
  Repository,
  shutdown,
} from "jsr:@manus/libgit2";

init();

try {
  using repo = Repository.open("/path/to/your/repo");

  // Get the index (staging area)
  using index = Index.fromRepository(repo);

  // Add a file to the index
  index.add("README.md");
  index.write(); // Write changes to the index file

  // Create the commit
  const oid = createCommit(repo, {
    message: "Add README file",
    author: { name: "Your Name", email: "you@example.com" },
  });

  console.log(`New commit created: ${oid}`);
} finally {
  shutdown();
}
```

### Listing Branches and Commits

```typescript
import { Repository, withLibrary } from "jsr:@manus/libgit2";

// Use the withLibrary helper for automatic init/shutdown
await withLibrary(async () => {
  await Repository.useAsync(".", async (repo) => {
    // List local branches
    console.log("Branches:");
    for (const branch of repo.listBranches()) {
      console.log(`- ${branch.name}`);
    }

    // List the last 5 commits
    console.log("\nRecent Commits:");
    for (const commit of repo.walkCommits(undefined, 5)) {
      const shortOid = commit.oid.slice(0, 7);
      const summary = commit.message.split("\n")[0];
      console.log(`- ${shortOid}: ${summary}`);
    }
  });
});
```

## API

The main entry points for the API are:

- `init()` / `shutdown()`: Global setup and teardown for the libgit2 library.
- `withLibrary()` / `withLibrarySync()`: Helper functions to automatically
  manage library initialization.
- `Repository`: The primary class for interacting with a Git repository.
- `Index`: Represents the staging area, used for adding and removing files.
- `createCommit()`: A function to create new commits.

### `Repository` Class

Provides methods for most repository-level operations.

| Method                  | Description                                  |
| ----------------------- | -------------------------------------------- |
| `Repository.open(path)` | Open an existing repository.                 |
| `Repository.init(path)` | Create a new repository.                     |
| `close()`               | Close the repository and free memory.        |
| `head()`                | Get the current HEAD reference.              |
| `headOid()`             | Get the OID of the commit HEAD points to.    |
| `listBranches()`        | Get a list of all local and remote branches. |
| `lookupCommit(oid)`     | Find a commit by its OID.                    |
| `status()`              | Get the status of the working directory.     |
| `walkCommits()`         | Get a generator to walk the commit history.  |

### `Index` Class

Manages the Git index (staging area).

| Method                       | Description                             |
| ---------------------------- | --------------------------------------- |
| `Index.fromRepository(repo)` | Get the index for a repository.         |
| `add(path)`                  | Stage a file.                           |
| `remove(path)`               | Unstage a file.                         |
| `write()`                    | Write index changes to disk.            |
| `writeTree()`                | Create a tree object from the index.    |
| `entries()`                  | Get a list of all entries in the index. |

## Contributing

Contributions are welcome! Please feel free to open an issue or submit a pull
request.

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE)
file for details.
