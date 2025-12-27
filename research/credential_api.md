# Credential API Research

## Overview

The credential API in libgit2 provides authentication mechanisms for remote
operations. However, this API is primarily designed for **callback-based
authentication** during fetch/push operations, which is complex to implement via
FFI due to callback requirements.

## Key Functions (from libgit2 v1.1.0)

### Credential Creation

- `git_credential_userpass_plaintext_new` - Create username/password credential
- `git_credential_ssh_key_new` - Create SSH key credential
- `git_credential_ssh_key_from_agent` - Create credential from SSH agent
- `git_credential_ssh_key_memory_new` - Create SSH key from memory
- `git_credential_default_new` - Create default credential
- `git_credential_username_new` - Create username-only credential

### Credential Management

- `git_credential_free` - Free a credential
- `git_credential_has_username` - Check if credential has username

## Challenges for FFI Implementation

1. **Callback-based**: Credentials are typically used via callbacks during
   remote operations
2. **Complex structs**: Credential structs contain function pointers
3. **Security concerns**: Handling passwords/keys in FFI requires careful memory
   management
4. **Limited standalone use**: Without fetch/push, credentials have limited
   utility

## Recommendation

Skip credential module for now. The credential API is primarily useful when
implementing fetch/push operations, which require:

- Network transport callbacks
- Progress callbacks
- Certificate validation callbacks

These are complex to implement via FFI and would require significant additional
work.

## Alternative Approach

For authentication, users can:

1. Use SSH agent (already configured in environment)
2. Use credential helpers configured in git config
3. Use URL-embedded credentials (not recommended for security)

The remote module already supports basic remote management (create, list,
rename, delete, URLs) without needing credentials.
