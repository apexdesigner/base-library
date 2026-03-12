#!/usr/bin/env node
// Post-tool hook: loads design file into cache, generates code, and validates.
// Returns generation results (file paths) and validation diagnostics to Claude.

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

  // Only process .ts design files
  if (!filePath.endsWith('.ts')) {
    process.exit(0);
  }

  // Skip static files in design/client/ and design/server/ — these are copied
  // to the generated directories, not DSL design objects
  if (/(?:^|\/design\/)(?:client|server)\//.test(filePath)) {
    process.exit(0);
  }

  // Extract the design-relative path for the endpoint
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

  // Call the generate-for-path endpoint (loads file, generates, validates in one call)
  const start = Date.now();
  const url = `http://localhost:${port}/api/generate/for-path?path=${encodeURIComponent(designPath)}`;

  const req = http.request(url, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      const timing = `(${((Date.now() - start) / 1000).toFixed(1)}s)`;

      if (res.statusCode !== 200) {
        respond(`ad3 server returned ${res.statusCode}: ${data}  ${timing}`);
      }

      let result;
      try {
        result = JSON.parse(data);
      } catch {
        respond(`ad3 server returned invalid JSON  ${timing}`);
      }

      const lines = [];

      // Generation results
      const gen = result.generation;
      if (gen) {
        const changed = gen.added + gen.updated + gen.removed;
        if (changed > 0 || gen.errors > 0) {
          const parts = [];
          if (gen.added > 0) parts.push(`${gen.added} added`);
          if (gen.updated > 0) parts.push(`${gen.updated} updated`);
          if (gen.removed > 0) parts.push(`${gen.removed} removed`);
          if (gen.errors > 0) parts.push(`${gen.errors} errors`);
          lines.push(`Generated: ${parts.join(', ')}  ${timing}`);

          // File paths with status indicators
          const STATUS_ICON = { added: '+', updated: '~', removed: '-', error: '!' };
          for (const f of gen.files || []) {
            const icon = STATUS_ICON[f.status] || '?';
            lines.push(`  ${icon} ${f.outputPath}`);
          }
        }

        // Generation diagnostics (e.g. static override warnings)
        for (const d of gen.diagnostics || []) {
          const prefix = d.severity === 'error' ? 'E' : 'W';
          lines.push(`  ${prefix}: ${d.outputPath} - ${d.message}`);
        }
      }

      // Validation diagnostics
      const val = result.validation;
      if (val && val.diagnostics && val.diagnostics.length > 0) {
        const MAX_DIAGS = 20;
        const total = val.diagnostics.length;
        const shown = val.diagnostics.slice(0, MAX_DIAGS);

        lines.push(`Validated: ${val.total} objects, ${total} diagnostics`);
        for (const d of shown) {
          const prefix = d.severity === 'error' ? 'E' : 'W';
          lines.push(`  ${prefix}: ${d.path} - ${d.message}`);
        }

        if (total > MAX_DIAGS) {
          lines.push(`  ... (${MAX_DIAGS} of ${total} shown)`);
          lines.push(`  ...and ${total - MAX_DIAGS} more diagnostics not shown — run \`ad3 resolve\` to auto-fix before continuing edits`);
        } else {
          lines.push('Run `ad3 resolve` after completing edits to auto-fix');
        }
      }

      // Silent exit when nothing to report
      if (lines.length === 0) {
        process.exit(0);
      }

      respond(lines.join('\n'));
    });
  });

  req.on('error', () => {
    respond('ad3 server is not running. Run `ad3 start` to start it.');
  });

  req.end();
});
