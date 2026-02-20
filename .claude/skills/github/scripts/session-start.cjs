#!/usr/bin/env node

/**
 * Session start hook for Claude Code remote environments
 *
 * 1. Calls adjust-settings.js to ensure permissions
 * 2. Configures git author from GitHub user info
 * 3. Sets git remote origin HEAD (for base branch detection)
 * 4. Sets up GITHUB_TOKEN in .env
 * 5. Configures npm authentication
 * 6. Clears tokens from environment
 * 7. Runs npm install if needed
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

// Only run in remote environments
if (process.env.CLAUDE_CODE_REMOTE !== 'true') {
  console.log('ℹ️  session-start: skipping (local environment)');
  process.exit(0);
}

// Signal async execution
console.log(JSON.stringify({ async: true, asyncTimeout: 300000 }));

console.log('🚀 Session start setup...');

// 1. Adjust settings (deny entries, allow list)
const SCRIPT_DIR = __dirname;
const ADJUST_SETTINGS = path.join(SCRIPT_DIR, 'adjust-settings.cjs');

try {
  execSync(`node "${ADJUST_SETTINGS}"`, { stdio: 'inherit' });
} catch (e) {
  console.warn('⚠️  Could not adjust settings');
}

// 2. Configure git author from GitHub user (if not already set)
if (process.env.GITHUB_TOKEN) {
  try {
    // Check if already configured locally
    let hasName = false, hasEmail = false;
    try {
      execSync('git config --local user.name', { stdio: 'pipe' });
      hasName = true;
    } catch {}
    try {
      execSync('git config --local user.email', { stdio: 'pipe' });
      hasEmail = true;
    } catch {}

    if (!hasName || !hasEmail) {
      // Fetch user info from GitHub API
      const response = execSync(
        `curl -s -H "Authorization: Bearer ${process.env.GITHUB_TOKEN}" https://api.github.com/user`,
        { encoding: 'utf8' }
      );
      const user = JSON.parse(response);

      if (!hasName && user.name) {
        execSync(`git config --local user.name "${user.name}"`, { stdio: 'pipe' });
      }
      if (!hasEmail) {
        // Use noreply email if user has email privacy enabled
        const email = user.email || `${user.id}+${user.login}@users.noreply.github.com`;
        execSync(`git config --local user.email "${email}"`, { stdio: 'pipe' });
      }
      console.log(`✅ Git author configured (${user.name || user.login})`);
    } else {
      console.log('✅ Git author already configured');
    }
  } catch (e) {
    console.warn('⚠️  Could not configure git author:', e.message);
  }
}

// 3. Set git remote origin HEAD (for base branch detection in publish-version)
// Use ls-remote to detect default branch, which is more reliable than --auto
try {
  // First fetch to ensure we have remote refs
  execSync('git fetch origin', { stdio: 'pipe' });

  // Try --auto first (works when remote HEAD is already known)
  try {
    execSync('git remote set-head origin --auto', { stdio: 'pipe' });
    console.log('✅ Git origin HEAD configured (auto)');
  } catch (autoErr) {
    // --auto failed, detect default branch via ls-remote
    const lsRemote = execSync('git ls-remote --symref origin HEAD', { encoding: 'utf8' });
    // Parse: "ref: refs/heads/main\tHEAD\n..."
    const match = lsRemote.match(/ref: refs\/heads\/(\S+)\s+HEAD/);
    if (match) {
      const defaultBranch = match[1];
      execSync(`git remote set-head origin ${defaultBranch}`, { stdio: 'pipe' });
      console.log(`✅ Git origin HEAD configured (${defaultBranch})`);
    } else {
      // Fallback: try common branch names
      const branches = execSync('git branch -r', { encoding: 'utf8' });
      const defaultBranch = branches.includes('origin/main') ? 'main' :
                           branches.includes('origin/master') ? 'master' : null;
      if (defaultBranch) {
        execSync(`git remote set-head origin ${defaultBranch}`, { stdio: 'pipe' });
        console.log(`✅ Git origin HEAD configured (${defaultBranch})`);
      } else {
        console.warn('⚠️  Could not detect default branch');
      }
    }
  }
} catch (e) {
  console.warn('⚠️  Could not set origin HEAD:', e.message);
}

// 4. GitHub token setup
if (process.env.GITHUB_TOKEN) {
  console.log('🔐 Configuring GitHub token...');

  // Check if already in .env (shouldn't be - tokens don't belong in source control)
  if (fs.existsSync('.env')) {
    const envContent = fs.readFileSync('.env', 'utf8');
    if (envContent.includes('GITHUB_TOKEN=')) {
      console.warn('⚠️  GITHUB_TOKEN already in .env - remove it from source control');
    } else {
      fs.appendFileSync('.env', `GITHUB_TOKEN=${process.env.GITHUB_TOKEN}\n`);
      console.log('✅ Added GITHUB_TOKEN to .env');
    }
  } else {
    fs.writeFileSync('.env', `GITHUB_TOKEN=${process.env.GITHUB_TOKEN}\n`);
    console.log('✅ Created .env with GITHUB_TOKEN');
  }

  delete process.env.GITHUB_TOKEN;
  console.log('🔒 GITHUB_TOKEN cleared from environment');
}

// 5. npm authentication setup
if (process.env.NPM_TOKEN) {
  console.log('🔐 Configuring npm authentication...');

  try {
    execSync(`npm config set //registry.npmjs.org/:_authToken "${process.env.NPM_TOKEN}"`, {
      stdio: 'pipe'
    });
    console.log('✅ npm authentication configured');

    delete process.env.NPM_TOKEN;
    console.log('🔒 NPM_TOKEN cleared from environment');
  } catch (e) {
    console.warn('⚠️  Could not configure npm authentication:', e.message);
  }
}

// 6. Install npm dependencies if needed
if (fs.existsSync('package.json')) {
  const needsInstall = !fs.existsSync('node_modules') ||
                       !fs.existsSync('node_modules/.package-lock.json');

  if (needsInstall) {
    console.log('📦 Installing npm dependencies...');
    const child = spawn('npm', ['install', '--silent'], {
      stdio: 'inherit',
      detached: true
    });
    child.unref();
    console.log('✅ npm install started (background)');
  } else {
    console.log('✅ npm dependencies already installed');
  }
}

console.log('🎉 Session setup complete!');
