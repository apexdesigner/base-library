# ad3 CLI Reference

`ad3` is installed globally. Do not use `npx`.

## Commands

| Command | Description |
|---|---|
| `ad3 init [name]` | Initialize a new project |
| `ad3 start` | Start the server (restarts if already running) |
| `ad3 stop` | Stop the server |
| `ad3 health` | Check server health |
| `ad3 info` | Show server info |
| `ad3 list [type]` | List design objects |
| `ad3 get <uuid>` | Get a single object by UUID |
| `ad3 add [type] [name] [extra]` | Add a design object to the project |
| `ad3 remove <uuid>` | Remove an object by UUID |
| `ad3 validate [uuid]` | Validate objects (alias: `ad3 val`) |
| `ad3 resolve [uuid]` | Resolve and validate objects (fix issues) |
| `ad3 reload` | Reload design files (keeps HTTP server running) |
| `ad3 restart` | Full restart including HTTP server |
| `ad3 generate` | Generate code (alias: `ad3 gen`) |
| `ad3 json-schema [type]` | Get JSON schema for a type |
| `ad3 typescript [type]` | Get TypeScript type for a type |
| `ad3 types` | List all design object type names |
| `ad3 local` | Manage local design dependencies |
| `ad3 sync` | Sync local dependencies (alias for `local sync`) |
| `ad3 deps` | Manage design dependencies |
| `ad3 dev` | Developer tools |
| `ad3 --version` | Show version |

## Common Workflows

### Create or modify design files

```bash
# Edit files in design/, then:
ad3 resolve        # Validate and auto-fix
```

### New type with relationships (may need gen)

```bash
ad3 resolve        # May report 1 diagnostic for new types
ad3 gen            # Generate code including new type definitions
ad3 resolve        # Should pass with 0 diagnostics
```

### Server management

```bash
ad3 stop           # Stop the server
ad3 start          # Start the server
ad3 restart        # Full restart
```

Any ad3 command starts the server if it isn't already running.

### Stale server state

If diagnostics persist unexpectedly, try stopping and restarting:

```bash
ad3 stop
ad3 resolve        # Fresh server picks up all changes
```
