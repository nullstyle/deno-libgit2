# Remote API Research

## Overview

The remote API provides functions for managing remote repositories - creating,
listing, fetching, pushing, and configuring remotes.

## Key Functions (from libgit2 v1.1.0)

### Remote Management

- `git_remote_create` - Create a remote with name and URL
- `git_remote_create_with_fetchspec` - Create remote with custom fetchspec
- `git_remote_create_anonymous` - Create anonymous remote (no name)
- `git_remote_create_detached` - Create detached remote (no repository)
- `git_remote_lookup` - Look up a remote by name
- `git_remote_free` - Free a remote

### Remote Properties

- `git_remote_name` - Get remote name
- `git_remote_url` - Get remote URL
- `git_remote_pushurl` - Get push URL
- `git_remote_set_url` - Set remote URL
- `git_remote_set_pushurl` - Set push URL

### Remote List

- `git_remote_list` - List all remotes in repository

### Network Operations

- `git_remote_fetch` - Fetch from remote
- `git_remote_push` - Push to remote
- `git_remote_connect` - Connect to remote
- `git_remote_disconnect` - Disconnect from remote
- `git_remote_connected` - Check if connected

### Refspecs

- `git_remote_get_refspec` - Get refspec at index
- `git_remote_refspec_count` - Get number of refspecs
- `git_remote_add_fetch` - Add fetch refspec
- `git_remote_add_push` - Add push refspec

## Structs

### `git_remote_create_options`

```c
typedef struct git_remote_create_options {
  unsigned int version;
  git_repository *repository;
  const char *name;
  const char *fetchspec;
  unsigned int flags;
} git_remote_create_options;
```

### `git_remote_create_flags`

```c
typedef enum {
  GIT_REMOTE_CREATE_SKIP_INSTEADOF = (1 << 0),
  GIT_REMOTE_CREATE_SKIP_DEFAULT_FETCHSPEC = (1 << 1),
} git_remote_create_flags;
```

## FFI Symbols Needed

```typescript
// Remote management
git_remote_create: { parameters: ["pointer", "pointer", "pointer", "pointer"], result: "i32" },
git_remote_lookup: { parameters: ["pointer", "pointer", "pointer"], result: "i32" },
git_remote_free: { parameters: ["pointer"], result: "void" },
git_remote_list: { parameters: ["pointer", "pointer"], result: "i32" },

// Remote properties
git_remote_name: { parameters: ["pointer"], result: "pointer" },
git_remote_url: { parameters: ["pointer"], result: "pointer" },
git_remote_pushurl: { parameters: ["pointer"], result: "pointer" },
git_remote_set_url: { parameters: ["pointer", "pointer", "pointer"], result: "i32" },
git_remote_set_pushurl: { parameters: ["pointer", "pointer", "pointer"], result: "i32" },

// Remote deletion
git_remote_delete: { parameters: ["pointer", "pointer"], result: "i32" },
git_remote_rename: { parameters: ["pointer", "pointer", "pointer", "pointer"], result: "i32" },
```

## Use Cases

1. **List remotes**: Get all configured remotes in a repository
2. **Create remote**: Add a new remote with name and URL
3. **Get/Set URLs**: Read and modify remote URLs
4. **Delete remote**: Remove a remote configuration
5. **Rename remote**: Change remote name
