# Describe API Research

## Enums

### git_describe_strategy_t

```c
typedef enum {
    GIT_DESCRIBE_DEFAULT,  // 0 - Only look in refs/tags/
    GIT_DESCRIBE_TAGS,     // 1 - Look for any reference in refs/tags/
    GIT_DESCRIBE_ALL,      // 2 - Look for any reference in refs/
} git_describe_strategy_t;
```

## Structs

### git_describe_options

```c
typedef struct git_describe_options {
    unsigned int version;                   // offset 0, 4 bytes
    unsigned int max_candidates_tags;       // offset 4, 4 bytes (default: 10)
    unsigned int describe_strategy;         // offset 8, 4 bytes (default: GIT_DESCRIBE_DEFAULT)
    const char *pattern;                    // offset 16, 8 bytes (pointer, may have padding)
    int only_follow_first_parent;           // offset 24, 4 bytes
    int show_commit_oid_as_fallback;        // offset 28, 4 bytes
} git_describe_options;
// Total size: ~32 bytes
```

### git_describe_format_options

```c
typedef struct {
    unsigned int version;                   // offset 0, 4 bytes
    unsigned int abbreviated_size;          // offset 4, 4 bytes (default: 7)
    int always_use_long_format;             // offset 8, 4 bytes
    // padding: 4 bytes
    const char *dirty_suffix;               // offset 16, 8 bytes (pointer)
} git_describe_format_options;
// Total size: ~24 bytes
```

## Key Functions

### Describe Operations

- `git_describe_commit(git_describe_result **result, git_object *committish, git_describe_options *opts)` -
  Describe a commit
- `git_describe_workdir(git_describe_result **out, git_repository *repo, git_describe_options *opts)` -
  Describe workdir (includes dirty status)

### Format

- `git_describe_format(git_buf *out, const git_describe_result *result, const git_describe_format_options *opts)` -
  Format result to string

### Cleanup

- `git_describe_result_free(git_describe_result *result)` - Free describe result

### Init

- `git_describe_options_init(git_describe_options *opts, unsigned int version)` -
  Initialize options
- `git_describe_format_options_init(git_describe_format_options *opts, unsigned int version)` -
  Initialize format options

## FFI Signatures

```typescript
git_describe_options_init: {
  parameters: ["pointer", "u32"],
  result: "i32",
},
git_describe_format_options_init: {
  parameters: ["pointer", "u32"],
  result: "i32",
},
git_describe_commit: {
  parameters: ["pointer", "pointer", "pointer"],
  result: "i32",
},
git_describe_workdir: {
  parameters: ["pointer", "pointer", "pointer"],
  result: "i32",
},
git_describe_format: {
  parameters: ["pointer", "pointer", "pointer"],
  result: "i32",
},
git_describe_result_free: {
  parameters: ["pointer"],
  result: "void",
},
```

## Constants

- `GIT_DESCRIBE_OPTIONS_VERSION` = 1
- `GIT_DESCRIBE_FORMAT_OPTIONS_VERSION` = 1
- `GIT_DESCRIBE_DEFAULT_MAX_CANDIDATES_TAGS` = 10
- `GIT_DESCRIBE_DEFAULT_ABBREVIATED_SIZE` = 7
