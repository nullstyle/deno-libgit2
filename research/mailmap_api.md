# Mailmap API Research

## Overview

The mailmap API provides functions for parsing and resolving author/committer
name and email mappings. This is useful for normalizing contributor identities
across a repository's history.

## Key Functions

### `git_mailmap_new`

```c
int git_mailmap_new(git_mailmap **out);
```

Allocate a new empty mailmap object.

### `git_mailmap_free`

```c
void git_mailmap_free(git_mailmap *mm);
```

Free the mailmap and its associated memory.

### `git_mailmap_add_entry`

```c
int git_mailmap_add_entry(
    git_mailmap *mm, const char *real_name, const char *real_email,
    const char *replace_name, const char *replace_email);
```

Add a single entry to the mailmap. If entry exists, it will be replaced.

### `git_mailmap_from_buffer`

```c
int git_mailmap_from_buffer(git_mailmap **out, const char *buf, size_t len);
```

Create a new mailmap from a buffer containing mailmap content.

### `git_mailmap_from_repository`

```c
int git_mailmap_from_repository(git_mailmap **out, git_repository *repo);
```

Create a new mailmap from a repository, loading mailmap files based on
configuration:

1. `.mailmap` in working directory root
2. Blob identified by `mailmap.blob` config entry
3. Path in `mailmap.file` config entry

### `git_mailmap_resolve`

```c
int git_mailmap_resolve(
    const char **real_name, const char **real_email,
    const git_mailmap *mm, const char *name, const char *email);
```

Resolve a name and email to the corresponding real name and email.

### `git_mailmap_resolve_signature`

```c
int git_mailmap_resolve_signature(
    git_signature **out, const git_mailmap *mm, const git_signature *sig);
```

Resolve a signature to use real names and emails with a mailmap.

## FFI Symbols Needed

```typescript
git_mailmap_new: { parameters: ["pointer"], result: "i32" },
git_mailmap_free: { parameters: ["pointer"], result: "void" },
git_mailmap_add_entry: { parameters: ["pointer", "pointer", "pointer", "pointer", "pointer"], result: "i32" },
git_mailmap_from_buffer: { parameters: ["pointer", "pointer", "usize"], result: "i32" },
git_mailmap_from_repository: { parameters: ["pointer", "pointer"], result: "i32" },
git_mailmap_resolve: { parameters: ["pointer", "pointer", "pointer", "pointer", "pointer"], result: "i32" },
git_mailmap_resolve_signature: { parameters: ["pointer", "pointer", "pointer"], result: "i32" },
```
