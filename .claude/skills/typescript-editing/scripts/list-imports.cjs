#!/usr/bin/env node

const { Project } = require('ts-morph');
const path = require('path');

function usage() {
  console.error('Usage: node list-imports.js <file-path>');
  process.exit(1);
}

function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    usage();
  }

  const filePath = path.resolve(args[0]);

  try {
    const project = new Project();
    const sourceFile = project.addSourceFileAtPath(filePath);
    const imports = sourceFile.getImportDeclarations();

    if (imports.length === 0) {
      console.log('No imports found');
    } else {
      for (const imp of imports) {
        const text = imp.getText();
        const line = imp.getStartLineNumber();
        console.log(`${text} (${line})`);
      }
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
