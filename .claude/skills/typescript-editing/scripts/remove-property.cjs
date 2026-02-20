#!/usr/bin/env node

const { Project } = require('ts-morph');
const path = require('path');
const { execSync } = require('child_process');

function usage() {
  console.error('Usage: node remove-property.js <file-path> <class-name> <property-name>');
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

  if (args.length < 3) {
    usage();
  }

  const filePath = path.resolve(args[0]);
  const className = args[1];
  const propertyName = args[2];

  try {
    const project = new Project();
    const sourceFile = project.addSourceFileAtPath(filePath);

    // Find the class
    const classDecl = sourceFile.getClass(className);
    if (!classDecl) {
      console.error(`Error: Could not find class '${className}'`);
      process.exit(1);
    }

    // Find the property
    const property = classDecl.getProperty(propertyName);
    if (!property) {
      console.error(`Error: Could not find property '${propertyName}' in class '${className}'`);
      process.exit(1);
    }

    const line = property.getStartLineNumber();

    property.remove();
    sourceFile.saveSync();
    runPrettier(filePath);

    console.log(`Removed property '${propertyName}' from line ${line}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
