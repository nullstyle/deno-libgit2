# libgit2 Tag API Research

## Key Functions

### Tag Lookup
- `git_tag_lookup(git_tag **out, git_repository *repo, const git_oid *id)` - Lookup tag by OID
- `git_tag_lookup_prefix(git_tag **out, git_repository *repo, const git_oid *id, size_t len)` - Lookup by prefix
- `git_tag_free(git_tag *tag)` - Free tag object

### Tag Properties
- `git_tag_id(const git_tag *tag)` - Get tag OID
- `git_tag_target(git_object **target_out, const git_tag *tag)` - Get tagged object
- `git_tag_target_id(const git_tag *tag)` - Get target OID
- `git_tag_target_type(const git_tag *tag)` - Get target type
- `git_tag_name(const git_tag *tag)` - Get tag name
- `git_tag_tagger(const git_tag *tag)` - Get tagger signature
- `git_tag_message(const git_tag *tag)` - Get tag message

### Tag Creation
- `git_tag_create(git_oid *oid, git_repository *repo, const char *tag_name, const git_object *target, const git_signature *tagger, const char *message, int force)` - Create annotated tag
- `git_tag_create_lightweight(git_oid *oid, git_repository *repo, const char *tag_name, const git_object *target, int force)` - Create lightweight tag
- `git_tag_annotation_create(git_oid *oid, git_repository *repo, const char *tag_name, const git_object *target, const git_signature *tagger, const char *message)` - Create tag annotation object

### Tag Listing
- `git_tag_list(git_strarray *tag_names, git_repository *repo)` - List all tags
- `git_tag_list_match(git_strarray *tag_names, const char *pattern, git_repository *repo)` - List tags matching pattern
- `git_tag_foreach(git_repository *repo, git_tag_foreach_cb callback, void *payload)` - Iterate over tags

### Tag Deletion
- `git_tag_delete(git_repository *repo, const char *tag_name)` - Delete a tag

### Tag Utilities
- `git_tag_peel(git_object **tag_target_out, const git_tag *tag)` - Recursively peel tag
- `git_tag_dup(git_tag **out, git_tag *source)` - Duplicate tag

## Implementation Plan

1. FFI Symbols needed:
   - git_tag_lookup
   - git_tag_free
   - git_tag_id
   - git_tag_target_id
   - git_tag_target_type
   - git_tag_name
   - git_tag_tagger
   - git_tag_message
   - git_tag_create
   - git_tag_create_lightweight
   - git_tag_list
   - git_tag_list_match
   - git_tag_foreach
   - git_tag_delete
   - git_tag_peel

2. Types needed:
   - Tag class wrapping git_tag pointer
   - TagInfo interface for tag metadata

3. Repository methods:
   - createTag(name, target, tagger, message, force?) - Create annotated tag
   - createLightweightTag(name, target, force?) - Create lightweight tag
   - listTags(pattern?) - List tags
   - lookupTag(oid) - Lookup tag by OID
   - deleteTag(name) - Delete tag
