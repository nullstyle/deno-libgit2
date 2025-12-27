# Worktree API Research

## Key Functions

### Listing and Lookup

- `git_worktree_list(git_strarray *out, git_repository *repo)` - List names of
  linked working trees
- `git_worktree_lookup(git_worktree **out, git_repository *repo, const char *name)` -
  Lookup worktree by name
- `git_worktree_open_from_repository(git_worktree **out, git_repository *repo)` -
  Open worktree from repo

### Lifecycle

- `git_worktree_free(git_worktree *wt)` - Free worktree handle
- `git_worktree_validate(const git_worktree *wt)` - Check if worktree is valid

### Adding Worktrees

- `git_worktree_add_options_init(git_worktree_add_options *opts, unsigned int version)` -
  Init options
- `git_worktree_add(git_worktree **out, git_repository *repo, const char *name, const char *path, const git_worktree_add_options *opts)` -
  Add new worktree

### Locking

- `git_worktree_lock(git_worktree *wt, const char *reason)` - Lock worktree
- `git_worktree_unlock(git_worktree *wt)` - Unlock worktree
- `git_worktree_is_locked(git_buf *reason, const git_worktree *wt)` - Check if
  locked

### Properties

- `git_worktree_name(const git_worktree *wt)` - Get worktree name
- `git_worktree_path(const git_worktree *wt)` - Get worktree path

### Pruning

- `git_worktree_prune_options_init(git_worktree_prune_options *opts, unsigned int version)` -
  Init prune options
- `git_worktree_is_prunable(git_worktree *wt, git_worktree_prune_options *opts)` -
  Check if prunable
- `git_worktree_prune(git_worktree *wt, git_worktree_prune_options *opts)` -
  Prune worktree

## Structs

### git_worktree_add_options

```c
typedef struct git_worktree_add_options {
    unsigned int version;
    int lock;              // lock newly created worktree
    git_reference *ref;    // reference to use for the new worktree HEAD
} git_worktree_add_options;
```

Version: 1

### git_worktree_prune_options

```c
typedef struct git_worktree_prune_options {
    unsigned int version;
    uint32_t flags;
} git_worktree_prune_options;
```

Version: 1

### git_worktree_prune_t (flags)

```c
typedef enum {
    GIT_WORKTREE_PRUNE_VALID = 1u << 0,        // Prune even if valid
    GIT_WORKTREE_PRUNE_LOCKED = 1u << 1,       // Prune even if locked
    GIT_WORKTREE_PRUNE_WORKING_TREE = 1u << 2, // Prune checked out working tree
} git_worktree_prune_t;
```

## FFI Signatures

```typescript
git_worktree_list: { parameters: ["pointer", "pointer"], result: "i32" },
git_worktree_lookup: { parameters: ["pointer", "pointer", "pointer"], result: "i32" },
git_worktree_open_from_repository: { parameters: ["pointer", "pointer"], result: "i32" },
git_worktree_free: { parameters: ["pointer"], result: "void" },
git_worktree_validate: { parameters: ["pointer"], result: "i32" },
git_worktree_add_options_init: { parameters: ["pointer", "u32"], result: "i32" },
git_worktree_add: { parameters: ["pointer", "pointer", "pointer", "pointer", "pointer"], result: "i32" },
git_worktree_lock: { parameters: ["pointer", "pointer"], result: "i32" },
git_worktree_unlock: { parameters: ["pointer"], result: "i32" },
git_worktree_is_locked: { parameters: ["pointer", "pointer"], result: "i32" },
git_worktree_name: { parameters: ["pointer"], result: "pointer" },
git_worktree_path: { parameters: ["pointer"], result: "pointer" },
git_worktree_prune_options_init: { parameters: ["pointer", "u32"], result: "i32" },
git_worktree_is_prunable: { parameters: ["pointer", "pointer"], result: "i32" },
git_worktree_prune: { parameters: ["pointer", "pointer"], result: "i32" },
```
