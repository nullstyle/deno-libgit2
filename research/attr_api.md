# Git Attr API Research

## Key Types

### git_attr_value_t

Possible states for an attribute:

- `GIT_ATTR_VALUE_UNSPECIFIED = 0` - Attribute not set
- `GIT_ATTR_VALUE_TRUE` - Attribute is set (e.g., `*.c foo`)
- `GIT_ATTR_VALUE_FALSE` - Attribute is unset (e.g., `*.h -foo`)
- `GIT_ATTR_VALUE_STRING` - Attribute has a value (e.g., `*.txt eol=lf`)

### Check Flags

- `GIT_ATTR_CHECK_FILE_THEN_INDEX = 0` - Check working dir then index
- `GIT_ATTR_CHECK_INDEX_THEN_FILE = 1` - Check index then working dir
- `GIT_ATTR_CHECK_INDEX_ONLY = 2` - Only check index
- `GIT_ATTR_CHECK_NO_SYSTEM = (1 << 2)` - Ignore system gitattributes
- `GIT_ATTR_CHECK_INCLUDE_HEAD = (1 << 3)` - Include HEAD .gitattributes

## Key Functions

### git_attr_get

Look up the value of one git attribute for a path.

```c
int git_attr_get(
    const char **value_out,
    git_repository *repo,
    uint32_t flags,
    const char *path,
    const char *name);
```

### git_attr_get_many

Look up multiple attributes at once.

```c
int git_attr_get_many(
    const char **values_out,
    git_repository *repo,
    uint32_t flags,
    const char *path,
    size_t num_attr,
    const char **names);
```

### git_attr_foreach

Loop over all attributes for a path.

```c
int git_attr_foreach(
    git_repository *repo,
    uint32_t flags,
    const char *path,
    git_attr_foreach_cb callback,
    void *payload);
```

### git_attr_value

Return the value type for a given attribute.

```c
git_attr_value_t git_attr_value(const char *attr);
```

### git_attr_cache_flush

Flush the gitattributes cache.

```c
int git_attr_cache_flush(git_repository *repo);
```

### git_attr_add_macro

Add a macro definition.

```c
int git_attr_add_macro(
    git_repository *repo,
    const char *name,
    const char *values);
```

## Implementation Plan

1. FFI symbols for attr functions
2. AttrValue enum matching git_attr_value_t
3. AttrCheckFlags constants
4. getAttr function for single attribute lookup
5. getAttrMany function for multiple attributes
6. foreachAttr function for iteration
7. attrCacheFlush function
8. addAttrMacro function
