#!/usr/bin/env node

/**
 * Ensures settings.json and settings.local.json have correct deny entries and skill allow list.
 * Creates files if missing. Prevents duplicates. No arguments needed.
 *
 * Both files are updated because:
 * - settings.json: Shared project settings (checked into git)
 * - settings.local.json: Personal settings (gitignored) - takes precedence at runtime
 */

const fs = require('fs');

const SETTINGS_FILE = '.claude/settings.json';
const LOCAL_SETTINGS_FILE = '.claude/settings.local.json';

function loadSettings(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (e) {
    console.warn(`⚠️  Could not parse ${filePath}, starting fresh`);
  }
  return {};
}

function saveSettings(filePath, settings) {
  fs.mkdirSync('.claude', { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(settings, null, 2) + '\n');
}

function ensureDenyEntry(settings, pattern) {
  if (!settings.permissions) settings.permissions = {};
  if (!settings.permissions.deny) settings.permissions.deny = [];

  if (!settings.permissions.deny.includes(pattern)) {
    settings.permissions.deny.push(pattern);
    return true;
  }
  return false;
}

function ensureAllowEntry(settings, pattern) {
  if (!settings.permissions) settings.permissions = {};
  if (!settings.permissions.allow) settings.permissions.allow = [];

  if (!settings.permissions.allow.includes(pattern)) {
    settings.permissions.allow.push(pattern);
    return true;
  }
  return false;
}

function discoverSkills() {
  const skillsDir = '.claude/skills';
  if (!fs.existsSync(skillsDir)) {
    return [];
  }
  return fs.readdirSync(skillsDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .filter(entry => fs.existsSync(`${skillsDir}/${entry.name}/SKILL.md`))
    .map(entry => entry.name);
}

function discoverScripts(skill) {
  const scriptsDir = `.claude/skills/${skill}/scripts`;
  if (!fs.existsSync(scriptsDir)) {
    return [];
  }
  return fs.readdirSync(scriptsDir, { withFileTypes: true })
    .filter(entry => entry.isFile())
    .filter(entry => entry.name.endsWith('.cjs') || entry.name.endsWith('.js') || entry.name.endsWith('.sh'))
    .map(entry => entry.name);
}

function updateSettingsFile(filePath, includeHooks = false) {
  const settings = loadSettings(filePath);
  let changed = false;

  // Deny entries for sensitive files (only in main settings.json)
  if (includeHooks) {
    const denyPatterns = ['Read(**/.env)', 'Read(**/.npmrc)'];
    for (const pattern of denyPatterns) {
      if (ensureDenyEntry(settings, pattern)) {
        console.log(`✅ Added ${pattern} deny`);
        changed = true;
      }
    }
  }

  // Discover skills from file system
  const skills = discoverSkills();
  for (const skill of skills) {
    // Allow the skill itself
    if (ensureAllowEntry(settings, `Skill(${skill})`)) {
      console.log(`✅ Added Skill(${skill}) to allow list`);
      changed = true;
    }
    // Allow each script individually (glob patterns don't work)
    const scripts = discoverScripts(skill);
    for (const script of scripts) {
      const pattern = `Bash(.claude/skills/${skill}/scripts/${script}:*)`;
      if (ensureAllowEntry(settings, pattern)) {
        console.log(`✅ Added ${script} to allow list`);
        changed = true;
      }
    }
  }

  if (changed) {
    saveSettings(filePath, settings);
    console.log(`✅ ${filePath} saved`);
  }

  return changed;
}

function main() {
  console.log('📝 Updating settings.json...');
  const mainChanged = updateSettingsFile(SETTINGS_FILE, true);

  console.log('\n📝 Updating settings.local.json...');
  const localChanged = updateSettingsFile(LOCAL_SETTINGS_FILE, false);

  if (!mainChanged && !localChanged) {
    console.log('\n✅ All settings already up to date');
  }
}

main();
