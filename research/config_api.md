# Git Config API Research

## Key Types

### git_config_level_t
Priority levels for config files:
- `GIT_CONFIG_LEVEL_PROGRAMDATA = 1` - System-wide on Windows
- `GIT_CONFIG_LEVEL_SYSTEM = 2` - /etc/gitconfig on Linux
- `GIT_CONFIG_LEVEL_XDG = 3` - ~/.config/git/config
- `GIT_CONFIG_LEVEL_GLOBAL = 4` - ~/.gitconfig
- `GIT_CONFIG_LEVEL_LOCAL = 5` - .git/config
- `GIT_CONFIG_LEVEL_APP = 6` - Application specific
- `GIT_CONFIG_HIGHEST_LEVEL = -1` - Highest available

### git_config_entry
```c
typedef struct git_config_entry {
    const char *name;           // Name of the entry (normalised)
    const char *value;          // String value of the entry
    unsigned int include_depth; // Depth of includes
    git_config_level_t level;   // Which config file this was found in
    void (*free)(struct git_config_entry *entry);
    void *payload;
} git_config_entry;
```

## Key Functions

### Opening/Creating Config
- `git_config_new(git_config **out)` - Create new empty config
- `git_config_open_default(git_config **out)` - Open default config
- `git_config_open_ondisk(git_config **out, const char *path)` - Open specific file
- `git_repository_config(git_config **out, git_repository *repo)` - Get repo config
- `git_config_free(git_config *cfg)` - Free config

### Finding Config Files
- `git_config_find_global(git_buf *out)` - Find global config path
- `git_config_find_xdg(git_buf *out)` - Find XDG config path
- `git_config_find_system(git_buf *out)` - Find system config path

### Reading Values
- `git_config_get_entry(git_config_entry **out, const git_config *cfg, const char *name)`
- `git_config_get_string(const char **out, const git_config *cfg, const char *name)`
- `git_config_get_string_buf(git_buf *out, const git_config *cfg, const char *name)`
- `git_config_get_int32(int32_t *out, const git_config *cfg, const char *name)`
- `git_config_get_int64(int64_t *out, const git_config *cfg, const char *name)`
- `git_config_get_bool(int *out, const git_config *cfg, const char *name)`
- `git_config_get_path(git_buf *out, const git_config *cfg, const char *name)`

### Writing Values
- `git_config_set_string(git_config *cfg, const char *name, const char *value)`
- `git_config_set_int32(git_config *cfg, const char *name, int32_t value)`
- `git_config_set_int64(git_config *cfg, const char *name, int64_t value)`
- `git_config_set_bool(git_config *cfg, const char *name, int value)`
- `git_config_set_multivar(git_config *cfg, const char *name, const char *regexp, const char *value)`

### Deleting Values
- `git_config_delete_entry(git_config *cfg, const char *name)`
- `git_config_delete_multivar(git_config *cfg, const char *name, const char *regexp)`

### Iteration
- `git_config_foreach(const git_config *cfg, git_config_foreach_cb callback, void *payload)`
- `git_config_foreach_match(const git_config *cfg, const char *regexp, git_config_foreach_cb callback, void *payload)`
- `git_config_iterator_new(git_config_iterator **out, const git_config *cfg)`
- `git_config_next(git_config_entry **entry, git_config_iterator *iter)`
- `git_config_iterator_free(git_config_iterator *iter)`

### Snapshots
- `git_config_snapshot(git_config **out, git_config *config)` - Create read-only snapshot

## Implementation Plan

1. FFI symbols for core config functions
2. Config class with get/set methods
3. ConfigEntry type for iteration
4. Support for different value types (string, int, bool)
5. Iteration support with foreach
