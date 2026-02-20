#!/usr/bin/env node
// Post-tool hook to validate design files after Edit/Write operations
// Only runs for files in the design/ directory

const { execSync } = require('child_process');

const toolInput = process.env.CLAUDE_TOOL_INPUT || '';
let filePath = '';

// Extract file_path from JSON input
if (toolInput) {
  try {
    const input = JSON.parse(toolInput);
    filePath = input.file_path || '';
  } catch {
    // Invalid JSON, ignore
  }
}

// Only run validation for design/ files
if (filePath.includes('/design/') || filePath.includes('\\design\\') || filePath.startsWith('design/') || filePath.startsWith('design\\')) {
  const commands = ['ad3t', 'ad3'];
  for (const cmd of commands) {
    try {
      execSync(`${cmd} validate --quiet`, { stdio: 'ignore' });
      break;
    } catch {
      // Command not found or failed, try next
    }
  }
}
