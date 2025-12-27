# Revert API Research

## git_revert_options struct

```c
typedef struct {
    unsigned int version;
    unsigned int mainline;           // For merge commits, parent to use
    git_merge_options merge_opts;    // Options for merging
    git_checkout_options checkout_opts; // Options for checkout
} git_revert_options;

#define GIT_REVERT_OPTIONS_VERSION 1
```

Note: This is identical to git_cherrypick_options!

## Functions

### git_revert_options_init

```c
GIT_EXTERN(int) git_revert_options_init(
    git_revert_options *opts,
    unsigned int version);
```

### git_revert_commit

```c
GIT_EXTERN(int) git_revert_commit(
    git_index **out,
    git_repository *repo,
    git_commit *revert_commit,
    git_commit *our_commit,
    unsigned int mainline,
    const git_merge_options *merge_options);
```

Revert a commit against another commit, producing an index.
- `out` - Pointer to store result index
- `repo` - Repository
- `revert_commit` - Commit to revert
- `our_commit` - Commit to revert against (e.g., HEAD)
- `mainline` - Parent for merge commits (0 for non-merge)
- `merge_options` - Merge options or NULL

### git_revert

```c
GIT_EXTERN(int) git_revert(
    git_repository *repo,
    git_commit *commit,
    const git_revert_options *given_opts);
```

Revert a commit, modifying index and working directory.

## Implementation Plan

1. Add FFI symbols:
   - `git_revert_options_init`
   - `git_revert_commit`
   - `git_revert`

2. Create revert.ts module (very similar to cherrypick.ts)

3. Add Repository methods:
   - `repo.revertCommit(commitOid, ourCommitOid, options)`
   - `repo.revert(commitOid, options)`
