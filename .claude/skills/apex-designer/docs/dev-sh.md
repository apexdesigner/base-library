# Dev Server Scripts

Separate scripts for starting the generated app server and client. Located at `.claude/skills/apex-designer/scripts/`.

## Server

```bash
# Start the app server
bash .claude/skills/apex-designer/scripts/dev-server.sh

# Start with debug output
bash .claude/skills/apex-designer/scripts/dev-server.sh --debug "AppName:*"

# Stop the app server
bash .claude/skills/apex-designer/scripts/dev-server.sh --stop
```

## Client

```bash
# Start the Angular client
bash .claude/skills/apex-designer/scripts/dev-client.sh

# Stop the client
bash .claude/skills/apex-designer/scripts/dev-client.sh --stop
```

## Behavior

- Each script manages only its own process using PID files (`logs/server.pid`, `logs/client.pid`)
- Running a script again automatically stops the existing process before starting a new one
- The server uses `tsx --watch`, so it auto-restarts when generated code changes
- These scripts do NOT affect the design server (`ad3 start`) — they only manage the generated app

## Logs

- Server: `logs/server.log`
- Client: `logs/client.log`

## Port Configuration

Ports are read from `.workspace.json`:

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
