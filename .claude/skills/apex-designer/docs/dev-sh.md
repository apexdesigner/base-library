# dev.sh

Development server startup script. Located at `.claude/skills/apex-designer/scripts/dev.sh`.

## Usage

```bash
# Start server and client
bash .claude/skills/apex-designer/scripts/dev.sh

# Start with debug output
bash .claude/skills/apex-designer/scripts/dev.sh --debug "AppName:*"
```

## Behavior

- Starts both the server (port 3000) and client (port 4200) in the background, then exits
- Running it again automatically kills existing processes on the ports — no need to manually kill anything
- The server uses `tsx --watch`, so it auto-restarts when generated code changes (e.g., after `ad3 gen`). If the server fails on initial startup (e.g., before code is generated), it will keep retrying — run `ad3 gen` and check `logs/server.log` rather than re-running dev.sh

## Logs

- Server: `logs/server.log`
- Client: `logs/client.log`

## Checking Status

Check if the processes are running:

```bash
lsof -ti :3000   # Server
lsof -ti :4200   # Client
```

## Port Configuration

Ports can be pinned per project in `.workspace.json`:

```json
{
  "ports": { "server": 3000, "client": 4200 }
}
```

Priority: `.workspace.json` → environment variables → defaults (3000/4200).

| Source | Server Port | Client Port | Design Server Port |
|---|---|---|---|
| `.workspace.json` | `ports.server` | `ports.client` | `ports.design` |
| Environment variable | `PORT` | `CLIENT_PORT` | — |
| Default | `3000` | `4200` | `0` (random) |
