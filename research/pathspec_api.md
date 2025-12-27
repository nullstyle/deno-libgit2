# libgit2 Pathspec API Research

## Overview

The pathspec API provides functions for compiling and matching pathspec patterns against files in a repository. Pathspecs are the patterns used by git commands to limit operations to specific paths.

## Types

### git_pathspec
Compiled pathspec object.

### git_pathspec_match_list
List of filenames matching a pathspec.

### git_pathspec_flag_t
Options controlling how pathspec match should be executed:

| Flag | Value | Description |
|------|-------|-------------|
| GIT_PATHSPEC_DEFAULT | 0 | Default behavior |
| GIT_PATHSPEC_IGNORE_CASE | 1 << 0 | Force case-insensitive match |
| GIT_PATHSPEC_USE_CASE | 1 << 1 | Force case-sensitive match |
| GIT_PATHSPEC_NO_GLOB | 1 << 2 | Disable glob patterns, use simple string comparison |
| GIT_PATHSPEC_NO_MATCH_ERROR | 1 << 3 | Return GIT_ENOTFOUND if no matches |
| GIT_PATHSPEC_FIND_FAILURES | 1 << 4 | Track which patterns had no matches |
| GIT_PATHSPEC_FAILURES_ONLY | 1 << 5 | Don't keep matching filenames, just test for matches |

## Functions

### git_pathspec_new
```c
int git_pathspec_new(git_pathspec **out, const git_strarray *pathspec);
```
Compile a pathspec from an array of path patterns.

### git_pathspec_free
```c
void git_pathspec_free(git_pathspec *ps);
```
Free a compiled pathspec.

### git_pathspec_matches_path
```c
int git_pathspec_matches_path(const git_pathspec *ps, uint32_t flags, const char *path);
```
Try to match a single path against a pathspec.
Returns 1 if path matches, 0 if it does not.

### git_pathspec_match_workdir
```c
int git_pathspec_match_workdir(git_pathspec_match_list **out, git_repository *repo, uint32_t flags, git_pathspec *ps);
```
Match a pathspec against the working directory. Handles git ignores.

### git_pathspec_match_index
```c
int git_pathspec_match_index(git_pathspec_match_list **out, git_index *index, uint32_t flags, git_pathspec *ps);
```
Match a pathspec against entries in an index.

### git_pathspec_match_tree
```c
int git_pathspec_match_tree(git_pathspec_match_list **out, git_tree *tree, uint32_t flags, git_pathspec *ps);
```
Match a pathspec against entries in a tree.

### git_pathspec_match_diff
```c
int git_pathspec_match_diff(git_pathspec_match_list **out, git_diff *diff, uint32_t flags, git_pathspec *ps);
```
Match a pathspec against entries in a diff.

### git_pathspec_match_list_free
```c
void git_pathspec_match_list_free(git_pathspec_match_list *m);
```
Free memory associated with a match list.

### git_pathspec_match_list_entrycount
```c
size_t git_pathspec_match_list_entrycount(const git_pathspec_match_list *m);
```
Get the number of items in a match list.

### git_pathspec_match_list_entry
```c
const char *git_pathspec_match_list_entry(const git_pathspec_match_list *m, size_t pos);
```
Get a matching filename by position.

### git_pathspec_match_list_diff_entry
```c
const git_diff_delta *git_pathspec_match_list_diff_entry(const git_pathspec_match_list *m, size_t pos);
```
Get a matching diff delta by position (only for match_diff results).

### git_pathspec_match_list_failed_entrycount
```c
size_t git_pathspec_match_list_failed_entrycount(const git_pathspec_match_list *m);
```
Get the number of pathspec items that did not match.

### git_pathspec_match_list_failed_entry
```c
const char *git_pathspec_match_list_failed_entry(const git_pathspec_match_list *m, size_t pos);
```
Get an original pathspec string that had no matches.

## FFI Symbols Needed

```typescript
git_pathspec_new: {
  parameters: ["pointer", "pointer"],  // out, pathspec strarray
  result: "i32",
},
git_pathspec_free: {
  parameters: ["pointer"],  // ps
  result: "void",
},
git_pathspec_matches_path: {
  parameters: ["pointer", "u32", "pointer"],  // ps, flags, path
  result: "i32",
},
git_pathspec_match_workdir: {
  parameters: ["pointer", "pointer", "u32", "pointer"],  // out, repo, flags, ps
  result: "i32",
},
git_pathspec_match_index: {
  parameters: ["pointer", "pointer", "u32", "pointer"],  // out, index, flags, ps
  result: "i32",
},
git_pathspec_match_tree: {
  parameters: ["pointer", "pointer", "u32", "pointer"],  // out, tree, flags, ps
  result: "i32",
},
git_pathspec_match_diff: {
  parameters: ["pointer", "pointer", "u32", "pointer"],  // out, diff, flags, ps
  result: "i32",
},
git_pathspec_match_list_free: {
  parameters: ["pointer"],  // m
  result: "void",
},
git_pathspec_match_list_entrycount: {
  parameters: ["pointer"],  // m
  result: "usize",
},
git_pathspec_match_list_entry: {
  parameters: ["pointer", "usize"],  // m, pos
  result: "pointer",
},
git_pathspec_match_list_diff_entry: {
  parameters: ["pointer", "usize"],  // m, pos
  result: "pointer",
},
git_pathspec_match_list_failed_entrycount: {
  parameters: ["pointer"],  // m
  result: "usize",
},
git_pathspec_match_list_failed_entry: {
  parameters: ["pointer", "usize"],  // m, pos
  result: "pointer",
},
```

## Implementation Notes

1. Pathspec requires creating a git_strarray from an array of patterns
2. Match functions return match lists that must be freed
3. Can match against workdir, index, tree, or diff
4. Supports glob patterns by default (can be disabled)
5. Can track which patterns had no matches (useful for validation)
