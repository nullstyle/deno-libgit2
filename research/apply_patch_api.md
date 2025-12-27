# Apply and Patch API Research

## Apply API (apply.h)

### git_apply_location_t enum

```c
typedef enum {
    GIT_APPLY_LOCATION_WORKDIR = 0,  // Apply to workdir only
    GIT_APPLY_LOCATION_INDEX = 1,    // Apply to index only (--cached)
    GIT_APPLY_LOCATION_BOTH = 2,     // Apply to both (--index)
} git_apply_location_t;
```

### git_apply_flags_t enum

```c
typedef enum {
    GIT_APPLY_CHECK = (1 << 0),  // Don't apply, just test (--check)
} git_apply_flags_t;
```

### git_apply_options struct

```c
typedef struct {
    unsigned int version;
    git_apply_delta_cb delta_cb;   // Callback per delta
    git_apply_hunk_cb hunk_cb;     // Callback per hunk
    void *payload;
    unsigned int flags;            // git_apply_flags_t
} git_apply_options;

#define GIT_APPLY_OPTIONS_VERSION 1
```

### Functions

#### git_apply_to_tree

```c
GIT_EXTERN(int) git_apply_to_tree(
    git_index **out,
    git_repository *repo,
    git_tree *preimage,
    git_diff *diff,
    const git_apply_options *options);
```

Apply a diff to a tree, return resulting index.

#### git_apply

```c
GIT_EXTERN(int) git_apply(
    git_repository *repo,
    git_diff *diff,
    git_apply_location_t location,
    const git_apply_options *options);
```

Apply a diff to repository (workdir, index, or both).

## Patch API (patch.h)

### Functions

#### git_patch_from_diff

```c
GIT_EXTERN(int) git_patch_from_diff(
    git_patch **out, git_diff *diff, size_t idx);
```

Get a patch for an entry in a diff list.

#### git_patch_from_blobs

```c
GIT_EXTERN(int) git_patch_from_blobs(
    git_patch **out,
    const git_blob *old_blob,
    const char *old_as_path,
    const git_blob *new_blob,
    const char *new_as_path,
    const git_diff_options *opts);
```

Generate patch from difference between two blobs.

#### git_patch_from_buffers

```c
GIT_EXTERN(int) git_patch_from_buffers(
    git_patch **out,
    const void *old_buffer,
    size_t old_len,
    const char *old_as_path,
    const void *new_buffer,
    size_t new_len,
    const char *new_as_path,
    const git_diff_options *opts);
```

Generate patch from difference between two buffers.

#### git_patch_free

```c
GIT_EXTERN(void) git_patch_free(git_patch *patch);
```

#### git_patch_get_delta

```c
GIT_EXTERN(const git_diff_delta *) git_patch_get_delta(const git_patch *patch);
```

#### git_patch_num_hunks

```c
GIT_EXTERN(size_t) git_patch_num_hunks(const git_patch *patch);
```

#### git_patch_to_buf

```c
GIT_EXTERN(int) git_patch_to_buf(
    git_buf *out,
    git_patch *patch);
```

Serialize patch to a buffer (unified diff format).

## Implementation Plan

### Apply Module

1. Add FFI symbols:
   - `git_apply_options_init`
   - `git_apply_to_tree`
   - `git_apply`

2. Create apply.ts module with:
   - `ApplyLocation` enum
   - `ApplyFlags` enum
   - `ApplyOptions` interface
   - `applyToTree()` function
   - `apply()` function

### Patch Module

1. Add FFI symbols:
   - `git_patch_from_diff`
   - `git_patch_from_buffers`
   - `git_patch_free`
   - `git_patch_get_delta`
   - `git_patch_num_hunks`
   - `git_patch_to_buf`

2. Create patch.ts module with:
   - `Patch` class
   - `patchFromDiff()` function
   - `patchFromBuffers()` function

Note: Apply requires Diff objects, which we haven't implemented yet. We should
implement Diff first, then Apply/Patch.

## Diff API (diff.h) - Key Functions

The diff API is large and complex. Key functions for apply/patch:

### git_diff_tree_to_tree

```c
GIT_EXTERN(int) git_diff_tree_to_tree(
    git_diff **diff,
    git_repository *repo,
    git_tree *old_tree,
    git_tree *new_tree,
    const git_diff_options *opts);
```

Create diff between two trees.

### git_diff_tree_to_index

```c
GIT_EXTERN(int) git_diff_tree_to_index(
    git_diff **diff,
    git_repository *repo,
    git_tree *old_tree,
    git_index *index,
    const git_diff_options *opts);
```

### git_diff_index_to_workdir

```c
GIT_EXTERN(int) git_diff_index_to_workdir(
    git_diff **diff,
    git_repository *repo,
    git_index *index,
    const git_diff_options *opts);
```

### git_diff_tree_to_workdir

```c
GIT_EXTERN(int) git_diff_tree_to_workdir(
    git_diff **diff,
    git_repository *repo,
    git_tree *old_tree,
    const git_diff_options *opts);
```

### git_diff_free

```c
GIT_EXTERN(void) git_diff_free(git_diff *diff);
```

## Revised Implementation Plan

Since Apply/Patch depend on Diff, we should implement in this order:

1. **Diff module** (basic diff generation)
   - `git_diff_tree_to_tree`
   - `git_diff_index_to_workdir`
   - `git_diff_free`
   - `git_diff_num_deltas`

2. **Patch module** (patch from diff)
   - `git_patch_from_diff`
   - `git_patch_to_buf`
   - `git_patch_free`

3. **Apply module** (apply diff/patch)
   - `git_apply`
   - `git_apply_to_tree`
