# Deno Libgit2

[![JSR](https://jsr.io/badges/@nullstyle/libgit2)](https://jsr.io/@nullstyle/libgit2)

**WARNING:  This code has been vibed.  you probably don't want to depend upon it, but I'm a dork like that**

A comprehensive Deno FFI binding for [libgit2](https://libgit2.org/), providing
a powerful and flexible way to interact with Git repositories directly from Deno.

This package offers a modern, type-safe, and object-oriented API for Git
operations, built on top of the performance and reliability of libgit2.

## Features

- **Comprehensive Git Operations**: Full support for repositories, branches,
  commits, trees, blobs, diffs, merges, rebases, and more.
- **High-Level API**: Intuitive, class-based API (`Repository`, `Index`,
  `Commit`, `Diff`, `Blame`, etc.) that simplifies complex libgit2 functions.
- **Type-Safe**: Full TypeScript support with detailed type definitions for all
  libgit2 structures and enums.
- **Cross-Platform**: Automatic library resolution for Linux, macOS, Windows,
  and other platforms via [@denosaurs/plug](https://jsr.io/@denosaurs/plug).
- **Resource Management**: Classes implement `Symbol.dispose` for use with
  `using` statements for automatic cleanup.
- **No External Dependencies**: Relies only on Deno runtime and a system
  installation of libgit2.

## Requirements

- **Deno**: Version 2.6 or later
- **libgit2**: A shared library installation of libgit2 (v1.1.0 or later
  recommended)

### Installing libgit2

- **Ubuntu/Debian**: `sudo apt-get install libgit2-dev`
- **macOS (Homebrew)**: `brew install libgit2`
- **Windows (vcpkg)**: `vcpkg install libgit2`
- **Fedora**: `sudo dnf install libgit2-devel`

## Installation

Import the package from JSR:

```typescript
import * as git from "jsr:@nullstyle/libgit2";
```

Or add it to your `deno.json`:

```json
{
  "imports": {
    "@nullstyle/libgit2": "jsr:@nullstyle/libgit2"
  }
}
```

## Quick Start

```typescript
import { init, Repository, shutdown } from "jsr:@nullstyle/libgit2";

// Initialize libgit2 (async - loads the native library)
await init();

try {
  using repo = Repository.open(".");
  console.log(`Repository: ${repo.path}`);
  console.log(`HEAD: ${repo.headOid()}`);
} finally {
  shutdown();
}
```

## Usage Examples

### Resource Management

Classes that wrap native resources implement `Symbol.dispose` and can be used
with `using` for automatic cleanup:

```typescript
import { init, Repository, Index, shutdown } from "jsr:@nullstyle/libgit2";

await init();
try {
  using repo = Repository.open(".");
  using index = Index.fromRepository(repo);

  // Resources are automatically freed when they go out of scope
  console.log(`Index entries: ${index.entryCount}`);
} finally {
  shutdown();
}
```

### Using the Helper Function

The `withLibrary` helper manages initialization and shutdown automatically:

```typescript
import { Repository, withLibrary } from "jsr:@nullstyle/libgit2";

await withLibrary(async () => {
  using repo = Repository.open(".");

  console.log("Branches:");
  for (const branch of repo.listBranches()) {
    const marker = branch.isHead ? "* " : "  ";
    console.log(`${marker}${branch.name}`);
  }

  console.log("\nRecent Commits:");
  for (const commit of repo.walkCommits(undefined, 5)) {
    const shortOid = commit.oid.slice(0, 7);
    const summary = commit.message.split("\n")[0];
    console.log(`${shortOid} ${summary}`);
  }
});
```

### Creating a Commit

```typescript
import {
  createCommit,
  Index,
  init,
  Repository,
  shutdown,
} from "jsr:@nullstyle/libgit2";

await init();

try {
  using repo = Repository.open("/path/to/repo");
  using index = Index.fromRepository(repo);

  // Stage files
  index.add("README.md");
  index.add("src/main.ts");
  index.write();

  // Create the commit
  const oid = createCommit(repo, {
    message: "Add initial files",
    author: { name: "Your Name", email: "you@example.com" },
  });

  console.log(`Created commit: ${oid}`);
} finally {
  shutdown();
}
```

### Finding Deleted File History

Track the history of files that have been deleted from the repository:

```typescript
import {
  fileExistsAtHead,
  findFileDeletion,
  findFileHistory,
  init,
  Repository,
  shutdown,
} from "jsr:@nullstyle/libgit2";

await init();

try {
  using repo = Repository.open("/path/to/repo");

  const filePath = "path/to/deleted-file.md";

  // Check if file exists at HEAD
  if (!fileExistsAtHead(repo, filePath)) {
    // Find when and where the file was deleted
    const deletion = findFileDeletion(repo, filePath, { includeContent: true });

    if (deletion) {
      console.log(`Deleted in: ${deletion.deletedInCommit.commitOid}`);
      console.log(`Last existed in: ${deletion.lastExistedInCommit.commitOid}`);
      console.log(`Content at deletion:\n${deletion.lastContent}`);
    }
  }

  // Get full history of the file
  const history = findFileHistory(repo, filePath);
  console.log(`File appeared in ${history.commits.length} commits`);
} finally {
  shutdown();
}
```

### Working with Diffs

```typescript
import { init, Repository, shutdown } from "jsr:@nullstyle/libgit2";

await init();

try {
  using repo = Repository.open(".");

  // Diff between two commits
  const headOid = repo.headOid();
  using diff = repo.diffTreeToWorkdir(headOid);

  console.log(`Changed files: ${diff.numDeltas}`);

  for (const delta of diff.deltas()) {
    console.log(`${delta.status}: ${delta.newFile.path}`);
  }
} finally {
  shutdown();
}
```

### Merge Operations

```typescript
import { init, Repository, shutdown, GitMergeAnalysis } from "jsr:@nullstyle/libgit2";

await init();

try {
  using repo = Repository.open(".");

  // Analyze merge possibility
  const annotated = repo.annotatedCommitFromRevspec("feature-branch");
  const analysis = repo.mergeAnalysis(annotated);

  if (analysis.analysis & GitMergeAnalysis.FASTFORWARD) {
    console.log("Fast-forward merge possible");
  } else if (analysis.analysis & GitMergeAnalysis.NORMAL) {
    console.log("Normal merge required");
  }

  // Perform merge
  repo.merge(annotated);

  // Check for conflicts
  const conflicts = repo.getConflicts();
  if (conflicts.length > 0) {
    console.log("Conflicts detected:");
    for (const conflict of conflicts) {
      console.log(`  ${conflict.ancestorPath}`);
    }
  }
} finally {
  shutdown();
}
```

### Stash Operations

```typescript
import { init, Repository, shutdown } from "jsr:@nullstyle/libgit2";

await init();

try {
  using repo = Repository.open(".");

  // Save current changes to stash
  const stashOid = repo.stashSave({
    message: "Work in progress",
  });
  console.log(`Stashed: ${stashOid}`);

  // List stashes
  const stashes = repo.listStashes();
  for (const stash of stashes) {
    console.log(`${stash.index}: ${stash.message}`);
  }

  // Apply and drop the stash
  repo.stashPop();
} finally {
  shutdown();
}
```

## API Reference

### Library Management

| Function       | Description                                           |
| -------------- | ----------------------------------------------------- |
| `init()`       | Initialize libgit2 (async, loads the native library)  |
| `shutdown()`   | Shutdown libgit2 and free resources                   |
| `withLibrary()`| Run a function with automatic init/shutdown           |
| `version()`    | Get libgit2 version as `{major, minor, revision}`     |
| `versionString()` | Get libgit2 version as a string                    |

### Repository Class

Core repository operations:

| Method                   | Description                                        |
| ------------------------ | -------------------------------------------------- |
| `Repository.open(path)`  | Open an existing repository                        |
| `Repository.init(path)`  | Create a new repository                            |
| `Repository.discover()`  | Find a repository by walking up from a path        |
| `close()`                | Close the repository and free memory               |
| `head()`                 | Get the current HEAD reference                     |
| `headOid()`              | Get the OID of the commit HEAD points to           |
| `setHead(ref)`           | Set HEAD to a reference                            |
| `setHeadDetached(oid)`   | Detach HEAD at a specific commit                   |
| `state`                  | Get repository state (normal, merging, etc.)       |
| `stateCleanup()`         | Clean up repository state after merge/revert       |

Branch operations:

| Method                         | Description                              |
| ------------------------------ | ---------------------------------------- |
| `listBranches(type?)`          | List local and/or remote branches        |
| `createBranch(name, target)`   | Create a new branch                      |
| `deleteBranch(name)`           | Delete a branch                          |

Commit operations:

| Method                     | Description                                  |
| -------------------------- | -------------------------------------------- |
| `lookupCommit(oid)`        | Find a commit by its OID                     |
| `walkCommits(start?, max?)`| Generator to walk commit history             |
| `getCommits(start?, max?)` | Get commits as an array                      |

Status and references:

| Method                | Description                                      |
| --------------------- | ------------------------------------------------ |
| `status()`            | Get working directory status                     |
| `listReferences()`    | List all references                              |
| `lookupReference()`   | Look up a reference by name                      |
| `resolveReference()`  | Resolve a symbolic reference                     |

### Index Class

| Method                       | Description                             |
| ---------------------------- | --------------------------------------- |
| `Index.fromRepository(repo)` | Get the index for a repository          |
| `add(path)`                  | Stage a file                            |
| `addAll(paths)`              | Stage multiple files                    |
| `remove(path)`               | Unstage a file                          |
| `write()`                    | Write index changes to disk             |
| `writeTree()`                | Create a tree object from the index     |
| `entries()`                  | Get all entries in the index            |
| `hasConflicts`               | Check if index has conflicts            |

### Implemented Features

#### Core Operations
- **Repository**: init, open, discover, clone, state management
- **Commits**: create, lookup, amend, walk history, parents
- **Branches**: create, delete, list, rename, upstream tracking
- **Index**: add, remove, write, read, conflict detection
- **References**: lookup, resolve, create, delete, list
- **Trees & Blobs**: lookup, traverse, read content
- **Status**: working directory and index status

#### Advanced Operations
- **Merge**: merge analysis, merge commits, merge base, conflict detection
- **Rebase**: init, open, next, commit, abort, finish
- **Cherry-pick**: cherry-pick commits with options
- **Revert**: revert commits with options
- **Diff**: tree-to-tree, tree-to-workdir, index-to-workdir
- **Patch**: create patches from diffs, line statistics
- **Apply**: apply diffs to index or tree
- **Blame**: file blame with options
- **Stash**: save, apply, pop, drop, list

#### Repository Features
- **Tags**: create (annotated and lightweight), delete, list, lookup
- **Remotes**: create, lookup, list, rename, delete, set URLs
- **Worktrees**: add, list, lookup, lock, unlock, prune
- **Submodules**: list, lookup, status
- **Config**: read and write configuration values
- **Reflog**: read, delete, rename

#### Utilities
- **Notes**: create, read, remove, list
- **Describe**: describe commits and workdir
- **Graph**: ahead/behind, descendant checking
- **Ignore**: add rules, check paths
- **Pathspec**: pattern matching
- **Mailmap**: author/committer resolution
- **Message**: prettify, parse trailers
- **ODB**: object database operations

## Running the Examples

```bash
# Basic usage example (creates a temp repository)
deno task run-basic

# Inspect an existing repository
deno task run-inspect

# Or run directly:
deno run --allow-ffi --allow-read --allow-write examples/basic_usage.ts
deno run --allow-ffi --allow-read examples/inspect_repo.ts /path/to/repo
deno run --allow-ffi --allow-read examples/deleted_file_history.ts /path/to/repo path/to/file
```

## Required Permissions

- `--allow-ffi`: Required for native library calls
- `--allow-read`: Required for reading repository files
- `--allow-write`: Required for write operations (commits, index, etc.)
- `--allow-env`: Required for environment variable access (optional)

## Contributing

Contributions are welcome! Please feel free to open an issue or submit a pull
request.

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE)
file for details.
