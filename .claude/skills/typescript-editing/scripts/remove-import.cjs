#!/usr/bin/env node

const { Project } = require('ts-morph');
const path = require('path');
const { execSync } = require('child_process');

function usage() {
  console.error('Usage: node remove-import.js <file-path> <module-path-or-identifier>');
  console.error('');
  console.error('Examples:');
  console.error('  node remove-import.js file.ts "@angular/core"    # Remove entire import');
  console.error('  node remove-import.js file.ts "Component"        # Remove named import');
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

  if (args.length < 2) {
    usage();
  }

  const filePath = path.resolve(args[0]);
  const target = args[1];

  try {
    const project = new Project();
    const sourceFile = project.addSourceFileAtPath(filePath);

    // Try to find import by module specifier first
    const importByModule = sourceFile.getImportDeclaration(imp =>
      imp.getModuleSpecifierValue() === target
    );

    if (importByModule) {
      const line = importByModule.getStartLineNumber();
      importByModule.remove();
      sourceFile.saveSync();
      runPrettier(filePath);
      console.log(`Removed import from '${target}' at line ${line}`);
      return;
    }

    // Try to find and remove a named import
    let found = false;
    for (const imp of sourceFile.getImportDeclarations()) {
      const namedImports = imp.getNamedImports();
      const matchingImport = namedImports.find(n => n.getName() === target);

      if (matchingImport) {
        const modulePath = imp.getModuleSpecifierValue();
        const line = imp.getStartLineNumber();

        matchingImport.remove();

        // If this was the last named import, remove the entire import statement
        if (imp.getNamedImports().length === 0 && !imp.getDefaultImport() && !imp.getNamespaceImport()) {
          imp.remove();
          console.log(`Removed '${target}' from '${modulePath}' (removed entire import at line ${line})`);
        } else {
          console.log(`Removed '${target}' from '${modulePath}' at line ${line}`);
        }

        sourceFile.saveSync();
        runPrettier(filePath);
        found = true;
        break;
      }
    }

    if (!found) {
      console.error(`Error: Could not find import '${target}'`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
