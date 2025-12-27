# libgit2 Ignore API Research

## Overview

The ignore API provides functions for working with gitignore rules.

## Functions

### git_ignore_add_rule
```c
int git_ignore_add_rule(git_repository *repo, const char *rules);
```
Add ignore rules for a repository. Rules are in-memory and don't persist.
- `repo` - The repository to add ignore rules to
- `rules` - Text of rules, a la .gitignore file contents. Multiple rules separated by newlines.
- Returns 0 on success

Example: `git_ignore_add_rule(myrepo, "*.c\ndir/\nFile with space\n");`

### git_ignore_clear_internal_rules
```c
int git_ignore_clear_internal_rules(git_repository *repo);
```
Clear ignore rules that were explicitly added via `git_ignore_add_rule`.
Resets to default internal ignores (".", "..", ".git").
Does NOT affect rules in actual .gitignore files.
- `repo` - The repository to remove ignore rules from
- Returns 0 on success

### git_ignore_path_is_ignored
```c
int git_ignore_path_is_ignored(int *ignored, git_repository *repo, const char *path);
```
Test if the ignore rules apply to a given path.
Equivalent to `git check-ignore --no-index`.
- `ignored` - Output: 0 if not ignored, 1 if ignored
- `repo` - Repository object
- `path` - File to check, relative to repo's workdir
- Returns 0 if rules could be processed, error < 0 otherwise

## FFI Symbols Needed

```typescript
git_ignore_add_rule: {
  parameters: ["pointer", "pointer"],  // repo, rules
  result: "i32",
},
git_ignore_clear_internal_rules: {
  parameters: ["pointer"],  // repo
  result: "i32",
},
git_ignore_path_is_ignored: {
  parameters: ["pointer", "pointer", "pointer"],  // ignored, repo, path
  result: "i32",
},
```

## Implementation Notes

1. Simple API with only 3 functions
2. Rules added via `add_rule` are in-memory only
3. `path_is_ignored` checks both in-memory rules and .gitignore files
4. Default internal ignores: ".", "..", ".git"
