# Notes API Research

## Key Functions

### Iterator
- `git_note_iterator_new(git_note_iterator **out, git_repository *repo, const char *notes_ref)` - Create notes iterator
- `git_note_commit_iterator_new(git_note_iterator **out, git_commit *notes_commit)` - Create iterator from commit
- `git_note_iterator_free(git_note_iterator *it)` - Free iterator
- `git_note_next(git_oid *note_id, git_oid *annotated_id, git_note_iterator *it)` - Get next note

### Read
- `git_note_read(git_note **out, git_repository *repo, const char *notes_ref, const git_oid *oid)` - Read note for object
- `git_note_commit_read(git_note **out, git_repository *repo, git_commit *notes_commit, const git_oid *oid)` - Read from commit

### Note Properties
- `git_note_author(const git_note *note)` - Get note author (returns git_signature *)
- `git_note_committer(const git_note *note)` - Get note committer (returns git_signature *)
- `git_note_message(const git_note *note)` - Get note message (returns const char *)
- `git_note_id(const git_note *note)` - Get note blob OID

### Create/Remove
- `git_note_create(git_oid *out, git_repository *repo, const char *notes_ref, const git_signature *author, const git_signature *committer, const git_oid *oid, const char *note, int force)` - Create note
- `git_note_remove(git_repository *repo, const char *notes_ref, const git_signature *author, const git_signature *committer, const git_oid *oid)` - Remove note
- `git_note_commit_create(...)` - Create note with commit
- `git_note_commit_remove(...)` - Remove note from commit

### Utility
- `git_note_default_ref(git_buf *out, git_repository *repo)` - Get default notes ref
- `git_note_foreach(git_repository *repo, const char *notes_ref, git_note_foreach_cb note_cb, void *payload)` - Iterate notes
- `git_note_free(git_note *note)` - Free note object

## FFI Signatures

```typescript
git_note_iterator_new: { parameters: ["pointer", "pointer", "pointer"], result: "i32" },
git_note_iterator_free: { parameters: ["pointer"], result: "void" },
git_note_next: { parameters: ["pointer", "pointer", "pointer"], result: "i32" },
git_note_read: { parameters: ["pointer", "pointer", "pointer", "pointer"], result: "i32" },
git_note_author: { parameters: ["pointer"], result: "pointer" },
git_note_committer: { parameters: ["pointer"], result: "pointer" },
git_note_message: { parameters: ["pointer"], result: "pointer" },
git_note_id: { parameters: ["pointer"], result: "pointer" },
git_note_create: { parameters: ["pointer", "pointer", "pointer", "pointer", "pointer", "pointer", "pointer", "i32"], result: "i32" },
git_note_remove: { parameters: ["pointer", "pointer", "pointer", "pointer", "pointer"], result: "i32" },
git_note_free: { parameters: ["pointer"], result: "void" },
git_note_default_ref: { parameters: ["pointer", "pointer"], result: "i32" },
```
