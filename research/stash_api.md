# Stash API Research

## Key Functions

### git_stash_save
Save the local modifications to a new stash.

```c
int git_stash_save(
    git_oid *out,           // OUT: OID of the stash commit
    git_repository *repo,
    const git_signature *stasher,
    const char *message,    // Optional description
    uint32_t flags          // GIT_STASH_* flags
);
```

Returns: 0 on success, GIT_ENOTFOUND if nothing to stash

### git_stash_apply
Apply a single stashed state from the stash list.

```c
int git_stash_apply(
    git_repository *repo,
    size_t index,           // Position in stash list (0 = most recent)
    const git_stash_apply_options *options
);
```

### git_stash_pop
Apply and remove a stashed state.

```c
int git_stash_pop(
    git_repository *repo,
    size_t index,
    const git_stash_apply_options *options
);
```

### git_stash_drop
Remove a single stashed state without applying.

```c
int git_stash_drop(
    git_repository *repo,
    size_t index
);
```

### git_stash_foreach
Iterate over all stashed states.

```c
typedef int (*git_stash_cb)(
    size_t index,
    const char* message,
    const git_oid *stash_id,
    void *payload
);

int git_stash_foreach(
    git_repository *repo,
    git_stash_cb callback,
    void *payload
);
```

## Enums

### git_stash_flags
```c
GIT_STASH_DEFAULT = 0,
GIT_STASH_KEEP_INDEX = (1 << 0),      // Keep index changes in working dir
GIT_STASH_INCLUDE_UNTRACKED = (1 << 1), // Also stash untracked files
GIT_STASH_INCLUDE_IGNORED = (1 << 2),   // Also stash ignored files
```

### git_stash_apply_flags
```c
GIT_STASH_APPLY_DEFAULT = 0,
GIT_STASH_APPLY_REINSTATE_INDEX = (1 << 0), // Also restore index changes
```

## FFI Signatures

```typescript
git_stash_save: {
  parameters: ["pointer", "pointer", "pointer", "pointer", "u32"],
  result: "i32",
},
git_stash_apply: {
  parameters: ["pointer", "usize", "pointer"],
  result: "i32",
},
git_stash_pop: {
  parameters: ["pointer", "usize", "pointer"],
  result: "i32",
},
git_stash_drop: {
  parameters: ["pointer", "usize"],
  result: "i32",
},
git_stash_foreach: {
  parameters: ["pointer", "pointer", "pointer"],
  result: "i32",
},
git_stash_apply_options_init: {
  parameters: ["pointer", "u32"],
  result: "i32",
},
```

## Use Cases

1. **Save work in progress**: Stash uncommitted changes before switching branches
2. **Apply stash**: Restore stashed changes to working directory
3. **Pop stash**: Apply and remove stash in one operation
4. **List stashes**: Iterate over all stashed states
5. **Drop stash**: Remove a stash without applying
