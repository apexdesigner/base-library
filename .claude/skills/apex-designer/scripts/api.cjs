#!/usr/bin/env node
/**
 * API CLI — Make authenticated requests to the generated server API.
 *
 * Usage:
 *   npx api login                                # OIDC login via browser
 *   npx api logout                               # Clear cached tokens
 *   npx api get /api/candidates                   # GET request
 *   npx api post /api/candidates '{"name":"A"}'   # POST with JSON body
 *   npx api --as user@example.com get /api/items  # Impersonate a user
 */

'use strict';

const { createServer: createHttpServer } = require('node:http');
const { createServer: createNetServer } = require('node:net');
const { createHash, randomBytes } = require('node:crypto');
const { readFileSync, writeFileSync, existsSync, unlinkSync } = require('node:fs');
const { resolve } = require('node:path');
const { execSync } = require('node:child_process');

const PROJECT_ROOT = process.cwd();
const API_FILE = resolve(PROJECT_ROOT, '.api.json');
const CLAUDE_SETTINGS_FILE = resolve(PROJECT_ROOT, '.claude', 'settings.local.json');
const WORKSPACE_FILE = resolve(PROJECT_ROOT, '.workspace.json');

// ── Config & token storage ────────────────────────────────────────────────

const DEFAULT_CALLBACK_PORTS = [3100, 3149];

function loadConfig() {
  if (!existsSync(API_FILE)) return {};
  try {
    return JSON.parse(readFileSync(API_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function saveConfig(config) {
  writeFileSync(API_FILE, JSON.stringify(config, null, 2) + '\n');
  ensureClaudeDeny();
}

function getCallbackPortRange() {
  const config = loadConfig();
  return config.callbackPorts || DEFAULT_CALLBACK_PORTS;
}

function loadToken() {
  return loadConfig().token || null;
}

function saveToken(token) {
  const config = loadConfig();
  config.token = token;
  saveConfig(config);
}

function clearToken() {
  const config = loadConfig();
  delete config.token;
  if (Object.keys(config).length === 0) {
    if (existsSync(API_FILE)) unlinkSync(API_FILE);
  } else {
    saveConfig(config);
  }
}

// ── Claude settings protection ─────────────────────────────────────────────

function ensureClaudeDeny() {
  const denyPattern = 'Read(.api.json)';
  let settings = {};

  if (existsSync(CLAUDE_SETTINGS_FILE)) {
    try {
      settings = JSON.parse(readFileSync(CLAUDE_SETTINGS_FILE, 'utf-8'));
    } catch {}
  }

  const deny = settings.deny || [];
  if (!deny.includes(denyPattern)) {
    deny.push(denyPattern);
    settings.deny = deny;
    writeFileSync(CLAUDE_SETTINGS_FILE, JSON.stringify(settings, null, 2) + '\n');
  }
}

// ── Server URL resolution ──────────────────────────────────────────────────

function getServerPort() {
  if (process.env.PORT) return Number(process.env.PORT);
  if (existsSync(WORKSPACE_FILE)) {
    try {
      const ws = JSON.parse(readFileSync(WORKSPACE_FILE, 'utf-8'));
      if (ws.ports && ws.ports.server) return ws.ports.server;
    } catch {}
  }
  return 3000;
}

function getServerUrl() {
  if (process.env.API_URL) return process.env.API_URL.replace(/\/$/, '');
  return `http://localhost:${getServerPort()}`;
}

// ── Token refresh ──────────────────────────────────────────────────────────

async function getValidToken() {
  const token = loadToken();
  if (!token) {
    console.error('Not logged in. Run: npx api login');
    process.exit(1);
  }

  // Refresh if expired (with 60s buffer)
  if (Date.now() >= (token.expires_at - 60) * 1000 && token.refresh_token) {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: token.client_id,
      refresh_token: token.refresh_token,
    });

    const res = await fetch(token.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!res.ok) {
      console.error('Token refresh failed. Run: npx api login');
      process.exit(1);
    }

    const data = await res.json();
    const refreshed = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || token.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
      token_endpoint: token.token_endpoint,
      client_id: token.client_id,
    };
    saveToken(refreshed);
    return refreshed.access_token;
  }

  return token.access_token;
}

// ── PKCE helpers ───────────────────────────────────────────────────────────

function generateCodeVerifier() {
  return randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier) {
  return createHash('sha256').update(verifier).digest('base64url');
}

function generateState() {
  return randomBytes(16).toString('base64url');
}

// ── OIDC discovery ─────────────────────────────────────────────────────────

async function discoverOidc(issuer) {
  const url = `${issuer.replace(/\/$/, '')}/.well-known/openid-configuration`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OIDC discovery failed: ${res.status} ${res.statusText}`);
  return res.json();
}

// ── HTML pages ─────────────────────────────────────────────────────────────

const pageStyle = `
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    margin: 0;
    color: white;
  }
  .container {
    text-align: center;
    padding: 40px;
    background: rgba(255,255,255,0.1);
    border-radius: 16px;
    backdrop-filter: blur(10px);
    max-width: 500px;
  }
  .icon { font-size: 64px; margin-bottom: 16px; }
  h1 { margin-bottom: 16px; }
  p { opacity: 0.9; }
  .detail {
    font-family: monospace;
    background: rgba(0,0,0,0.2);
    padding: 8px 16px;
    border-radius: 8px;
    margin-top: 16px;
  }
`;

function successPage() {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Login Successful</title>
<style>${pageStyle} body { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }</style>
</head><body><div class="container">
  <div class="icon">&#10003;</div>
  <h1>Login Successful</h1>
  <p>You can close this tab and return to the terminal.</p>
</div></body></html>`;
}

function errorPage(error, description) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Login Failed</title>
<style>${pageStyle} body { background: linear-gradient(135deg, #eb4d4b 0%, #b71540 100%); }</style>
</head><body><div class="container">
  <div class="icon">&#10007;</div>
  <h1>Login Failed</h1>
  <p>${description}</p>
  <div class="detail">${error}</div>
  <p style="margin-top:24px">Please close this tab and try again.</p>
</div></body></html>`;
}

// ── Find available port ────────────────────────────────────────────────────

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = createNetServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, 'localhost');
  });
}

async function findAvailablePort(min, max) {
  for (let port = min; port <= max; port++) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No available port in range ${min}-${max}`);
}

// ── Open browser ───────────────────────────────────────────────────────────

function openBrowser(url) {
  const cmd =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  execSync(`${cmd} "${url}"`);
}

// ── Login command ──────────────────────────────────────────────────────────

async function login() {
  const serverUrl = getServerUrl();

  // Fetch auth config from the running server
  const configRes = await fetch(`${serverUrl}/api/auth/config`);
  if (!configRes.ok) {
    console.error(`Failed to fetch auth config from ${serverUrl}/api/auth/config`);
    console.error('Is the server running?');
    process.exit(1);
  }

  const authConfig = await configRes.json();
  if (!authConfig || !authConfig.domain || !authConfig.clientId) {
    console.error('Auth is not configured on the server.');
    process.exit(1);
  }

  const issuer = authConfig.domain.includes('://') ? authConfig.domain : `https://${authConfig.domain}`;

  const oidc = await discoverOidc(issuer);

  // Find an available callback port
  const [portMin, portMax] = getCallbackPortRange();
  const port = await findAvailablePort(portMin, portMax);
  const redirectUri = `http://localhost:${port}`;

  // Generate PKCE and state
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = generateState();

  // Build authorization URL
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: authConfig.clientId,
    redirect_uri: redirectUri,
    scope: (authConfig.scopes || ['openid', 'profile', 'email']).join(' ') + ' offline_access',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
    ...(authConfig.audience ? { audience: authConfig.audience } : {}),
  });

  const authUrl = `${oidc.authorization_endpoint}?${params}`;

  // Start callback server
  const code = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error('Login timed out after 120 seconds'));
    }, 120_000);

    const server = createHttpServer((req, res) => {
      const url = new URL(req.url || '/', `http://localhost:${port}`);
      const authCode = url.searchParams.get('code');
      const returnedState = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(errorPage(error, url.searchParams.get('error_description') || ''));
        clearTimeout(timeout);
        server.close();
        reject(new Error(`Auth error: ${error}`));
        return;
      }

      if (authCode) {
        if (returnedState !== state) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(errorPage('state_mismatch', 'State mismatch — possible CSRF attack.'));
          clearTimeout(timeout);
          server.close();
          reject(new Error('State mismatch'));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(successPage());
        clearTimeout(timeout);
        server.close();
        resolve(authCode);
      }
    });

    server.listen(port, 'localhost', () => {
      console.log(`\nIf browser doesn't open automatically, visit:\n${authUrl}\n`);
      console.log('Waiting for authentication...');
      openBrowser(authUrl);
    });
  });

  // Exchange code for tokens
  const tokenBody = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: authConfig.clientId,
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });

  const tokenRes = await fetch(oidc.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenBody,
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    console.error('Token exchange failed:', err);
    process.exit(1);
  }

  const tokenData = await tokenRes.json();

  saveToken({
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + (tokenData.expires_in || 3600),
    token_endpoint: oidc.token_endpoint,
    client_id: authConfig.clientId,
  });

  console.log('Login successful. Token cached.');
  process.exit(0);
}

// ── API request ────────────────────────────────────────────────────────────

async function apiRequest(method, path, body, asEmail) {
  const serverUrl = getServerUrl();
  const accessToken = await getValidToken();

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  if (asEmail) {
    headers['x-impersonate-email'] = asEmail;
  }

  const url = `${serverUrl}${path.startsWith('/') ? path : '/' + path}`;

  const res = await fetch(url, {
    method: method.toUpperCase(),
    headers,
    ...(body ? { body } : {}),
  });

  const status = `${res.status} ${res.statusText}`;
  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();

  if (contentType.includes('application/json') && text) {
    try {
      const json = JSON.parse(text);
      console.log(status);
      console.log(JSON.stringify(json, null, 2));
    } catch {
      console.log(status);
      console.log(text);
    }
  } else {
    console.log(status);
    if (text) console.log(text);
  }

  if (!res.ok) process.exit(1);
}

// ── CLI argument parsing ───────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    printUsage();
    process.exit(0);
  }

  let asEmail;
  let i = 0;

  // Parse flags
  while (i < args.length && args[i].startsWith('-')) {
    if (args[i] === '--as' && i + 1 < args.length) {
      asEmail = args[i + 1];
      i += 2;
    } else {
      console.error(`Unknown flag: ${args[i]}`);
      process.exit(1);
    }
  }

  const command = args[i] && args[i].toLowerCase();

  if (command === 'login') {
    login().catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
    return;
  }

  if (command === 'logout') {
    clearToken();
    console.log('Logged out.');
    return;
  }

  const methods = ['get', 'post', 'put', 'patch', 'delete'];
  if (!command || !methods.includes(command)) {
    printUsage();
    process.exit(1);
  }

  const path = args[i + 1];
  if (!path) {
    console.error('Missing path. Example: npx api get /api/candidates');
    process.exit(1);
  }

  const body = args[i + 2];

  apiRequest(command, path, body, asEmail).catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

function printUsage() {
  console.log(`API CLI — Make authenticated requests to the server API.

Usage:
  npx api login                                Login via browser (OIDC)
  npx api logout                               Clear cached tokens
  npx api get <path>                           GET request
  npx api post <path> '<json>'                 POST with JSON body
  npx api put <path> '<json>'                  PUT with JSON body
  npx api patch <path> '<json>'                PATCH with JSON body
  npx api delete <path>                        DELETE request
  npx api --as user@example.com get <path>     Impersonate a user

Examples:
  npx api login
  npx api get /api/candidates
  npx api post /api/candidates '{"name":"Alice"}'
  npx api --as admin@example.com get /api/users

Configuration:
  Create .api.json in the project root to customize the callback port range:
  { "callbackPorts": [3100, 3149] }`);
}

main();
