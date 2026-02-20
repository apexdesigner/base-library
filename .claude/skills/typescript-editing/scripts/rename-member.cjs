#!/usr/bin/env node

const { Project } = require('ts-morph');
const path = require('path');
const { execSync } = require('child_process');

function usage() {
  console.error('Usage: node rename-member.js <file-path> <class-name> <old-name> <new-name>');
  process.exit(1);
}

function runPrettier(filePath) {
  try {
    execSync(`npx prettier --write "${filePath}"`, { stdio: 'ignore' });
  } catch (error) {
    // Prettier not available or failed
  }
}

function main() {
  const args = process.argv.slice(2);

  if (args.length < 4) {
    usage();
  }

  const filePath = path.resolve(args[0]);
  const className = args[1];
  const oldName = args[2];
  const newName = args[3];

  try {
    const project = new Project();
    const sourceFile = project.addSourceFileAtPath(filePath);

    // Find the class
    const classDecl = sourceFile.getClass(className);
    if (!classDecl) {
      console.error(`Error: Could not find class '${className}'`);
      process.exit(1);
    }

    // Try to find method first
    const method = classDecl.getMethod(oldName);
    if (method) {
      const line = method.getStartLineNumber();
      method.rename(newName);
      sourceFile.saveSync();
      runPrettier(filePath);
      console.log(`Renamed method '${oldName}' to '${newName}' at line ${line}`);
      return;
    }

    // Try to find property
    const property = classDecl.getProperty(oldName);
    if (property) {
      const line = property.getStartLineNumber();
      property.rename(newName);
      sourceFile.saveSync();
      runPrettier(filePath);
      console.log(`Renamed property '${oldName}' to '${newName}' at line ${line}`);
      return;
    }

    console.error(`Error: Could not find method or property '${oldName}' in class '${className}'`);
    process.exit(1);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
