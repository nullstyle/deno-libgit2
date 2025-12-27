# ODB (Object Database) API Research

## Overview

The ODB API provides low-level access to Git's object database, allowing direct
manipulation of Git objects (commits, trees, blobs, tags) at the storage level.

## Key Functions (from libgit2 v1.1.0)

### ODB Management

- `git_repository_odb` - Get the object database from a repository
- `git_odb_new` - Create a new empty object database
- `git_odb_open` - Open an object database at a path
- `git_odb_free` - Free an object database

### Object Reading

- `git_odb_read` - Read an object from the database
- `git_odb_read_prefix` - Read an object by prefix
- `git_odb_read_header` - Read only the header of an object
- `git_odb_exists` - Check if an object exists
- `git_odb_exists_prefix` - Check if an object exists by prefix

### Object Writing

- `git_odb_write` - Write an object to the database
- `git_odb_hash` - Hash data without writing
- `git_odb_hashfile` - Hash a file without writing

### ODB Object

- `git_odb_object_free` - Free an ODB object
- `git_odb_object_id` - Get the OID of an object
- `git_odb_object_data` - Get the data of an object
- `git_odb_object_size` - Get the size of an object
- `git_odb_object_type` - Get the type of an object

### Iteration

- `git_odb_foreach` - Iterate over all objects in the database

## FFI Symbols Needed

```typescript
// ODB management
git_repository_odb: { parameters: ["pointer", "pointer"], result: "i32" },
git_odb_free: { parameters: ["pointer"], result: "void" },

// Object reading
git_odb_read: { parameters: ["pointer", "pointer", "pointer"], result: "i32" },
git_odb_read_header: { parameters: ["pointer", "pointer", "pointer", "pointer"], result: "i32" },
git_odb_exists: { parameters: ["pointer", "pointer"], result: "i32" },

// Object writing
git_odb_write: { parameters: ["pointer", "pointer", "pointer", "usize", "i32"], result: "i32" },
git_odb_hash: { parameters: ["pointer", "pointer", "usize", "i32"], result: "i32" },

// ODB object
git_odb_object_free: { parameters: ["pointer"], result: "void" },
git_odb_object_id: { parameters: ["pointer"], result: "pointer" },
git_odb_object_data: { parameters: ["pointer"], result: "pointer" },
git_odb_object_size: { parameters: ["pointer"], result: "usize" },
git_odb_object_type: { parameters: ["pointer"], result: "i32" },
```

## Use Cases

1. **Check object existence**: Verify if a specific object exists in the
   database
2. **Read raw objects**: Get raw object data for custom processing
3. **Write raw objects**: Create objects directly without going through
   higher-level APIs
4. **Hash data**: Compute Git hashes for data without storing
5. **Object iteration**: Walk through all objects in the database
