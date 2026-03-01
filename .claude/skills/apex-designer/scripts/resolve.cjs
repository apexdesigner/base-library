#!/usr/bin/env node
// Post-tool hook: runs ad3 resolve after Edit/Write to design/ files

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

function respond(message) {
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: message } }));
  process.exit(0);
}

let chunks = [];
process.stdin.on('data', (chunk) => chunks.push(chunk));
process.stdin.on('end', () => {
  let filePath = '';
  try {
    const data = JSON.parse(Buffer.concat(chunks).toString());
    filePath = (data.tool_input && data.tool_input.file_path) || '';
  } catch {
    process.exit(0);
  }

  // Only run for design/ files
  if (!filePath.includes('/design/') && !filePath.startsWith('design/')) {
    process.exit(0);
  }

  // Skip static files in design/client/ and design/server/ — these are copied
  // to the generated directories, not DSL design objects
  if (/(?:^|\/design\/)(?:client|server)\//.test(filePath)) {
    process.exit(0);
  }

  // Extract the design-relative path for targeted resolve
  const designIndex = filePath.indexOf('/design/');
  const designPath = designIndex >= 0 ? filePath.slice(designIndex + 1) : filePath;

  // Read auth token
  const credentialsFile = path.join(os.homedir(), '.ad3', 'credentials.json');
  let token;
  try {
    const creds = JSON.parse(fs.readFileSync(credentialsFile, 'utf8'));
    token = creds.accessToken;
  } catch {
    respond('No ad3 credentials found at ' + credentialsFile);
  }

  // Read server info
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const serverInfoFile = path.join(projectDir, '.apex-designer', 'server.json');
  let port;
  try {
    const info = JSON.parse(fs.readFileSync(serverInfoFile, 'utf8'));
    port = info.port;
  } catch {
    respond('ad3 server is not running. Run `ad3 start` to start it.');
  }

  // Regenerate design type definitions before validating
  // (ensures types/barrels are up to date after edits)
  const designFilesUrl = `http://localhost:${port}/api/generate/design-files`;
  const dfReq = http.request(designFilesUrl, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }, (dfRes) => {
    let dfData = '';
    dfRes.on('data', (chunk) => { dfData += chunk; });
    dfRes.on('end', () => {
      runValidate();
    });
  });
  dfReq.on('error', () => {
    // If design-files fails, still run validate
    runValidate();
  });
  dfReq.end();

  function runValidate() {
  // Call the validate API (validate-only, no fix — use `ad3 resolve` to fix)
  const start = Date.now();
  const url = `http://localhost:${port}/api/validate?path=${encodeURIComponent(designPath)}`;

  const req = http.request(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, Accept: 'application/x-ndjson' } }, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      const timing = `(${((Date.now() - start) / 1000).toFixed(1)}s)`;

      if (res.statusCode !== 200) {
        respond(`ad3 server returned ${res.statusCode}: ${data}  ${timing}`);
      }

      // Parse NDJSON response
      const diagLines = [];
      let objectCount = 0;
      for (const line of data.split('\n').filter(Boolean)) {
        try {
          const event = JSON.parse(line);
          if (event.type === 'result') {
            objectCount = event.summary?.total || 0;
            if (event.diagnostics) {
              for (const d of event.diagnostics) {
                diagLines.push(`${d.severity}: ${d.path} - ${d.message}`);
              }
            }
          }
        } catch {}
      }

      // Clean — no output needed
      if (diagLines.length === 0) {
        process.exit(0);
      }

      const MAX_DIAGS = 20;
      const total = diagLines.length;
      const shown = diagLines.slice(0, MAX_DIAGS);
      const truncated = total > MAX_DIAGS;

      let message = `Validated: ${objectCount} objects, ${total} diagnostics  ${timing}\n` +
        shown.join('\n');

      if (truncated) {
        message += `\n... (${MAX_DIAGS} of ${total} shown)` +
          `\n...and ${total - MAX_DIAGS} more diagnostics not shown — run \`ad3 resolve\` to auto-fix before continuing edits`;
      } else {
        message += '\nRun `ad3 resolve` after completing edits to auto-fix';
      }

      respond(message);
    });
  });

  req.on('error', (err) => {
    respond('ad3 server is not running. Run `ad3 start` to start it.');
  });

  req.end();
  } // end runValidate
});
