#!/usr/bin/env node

const { Project } = require('ts-morph');
const path = require('path');
const { execSync } = require('child_process');

function usage() {
  console.error('Usage: node add-import.js <file-path> <module-path> [options]');
  console.error('Options:');
  console.error('  --named="Name1,Name2"   Named imports');
  console.error('  --default="Name"        Default import');
  console.error('  --namespace="Name"      Namespace import (import * as Name)');
  console.error('  --type-only             Type-only import');
  process.exit(1);
}

function parseArgs() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    usage();
  }

  const filePath = path.resolve(args[0]);
  const modulePath = args[1];
  let named = [];
  let defaultImport = null;
  let namespace = null;
  let typeOnly = false;

  for (let i = 2; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--named=')) {
      const value = arg.split('=')[1].replace(/^["']|["']$/g, '');
      named = value.split(',').map(n => n.trim()).filter(n => n);
    } else if (arg.startsWith('--default=')) {
      defaultImport = arg.split('=')[1].replace(/^["']|["']$/g, '');
    } else if (arg.startsWith('--namespace=')) {
      namespace = arg.split('=')[1].replace(/^["']|["']$/g, '');
    } else if (arg === '--type-only') {
      typeOnly = true;
    }
  }

  return { filePath, modulePath, named, defaultImport, namespace, typeOnly };
}

function runPrettier(filePath) {
  try {
    execSync(`npx prettier --write "${filePath}"`, { stdio: 'ignore' });
  } catch (error) {
    // Prettier not available or failed
  }
}

function main() {
  const { filePath, modulePath, named, defaultImport, namespace, typeOnly } = parseArgs();

  try {
    const project = new Project();
    const sourceFile = project.addSourceFileAtPath(filePath);

    // Find existing import from this module
    const existingImport = sourceFile.getImportDeclaration(imp =>
      imp.getModuleSpecifierValue() === modulePath
    );

    if (existingImport) {
      let modified = false;
      const line = existingImport.getStartLineNumber();

      // Add named imports to existing import
      if (named.length > 0) {
        const existingNamed = existingImport.getNamedImports().map(n => n.getName());
        const toAdd = named.filter(n => !existingNamed.includes(n));

        if (toAdd.length > 0) {
          for (const name of toAdd) {
            existingImport.addNamedImport(name);
          }
          modified = true;
          sourceFile.saveSync();
          runPrettier(filePath);
          console.log(`Added '${toAdd.join("', '")}' to existing import at line ${line}`);
        } else {
          console.log('Import already exists (skipped)');
        }
      } else if (defaultImport) {
        const existingDefault = existingImport.getDefaultImport();
        if (!existingDefault) {
          existingImport.setDefaultImport(defaultImport);
          modified = true;
          sourceFile.saveSync();
          runPrettier(filePath);
          console.log(`Added default import to existing import at line ${line}`);
        } else {
          console.log('Import already exists (skipped)');
        }
      } else if (namespace) {
        const existingNamespace = existingImport.getNamespaceImport();
        if (!existingNamespace) {
          existingImport.setNamespaceImport(namespace);
          modified = true;
          sourceFile.saveSync();
          runPrettier(filePath);
          console.log(`Added namespace import to existing import at line ${line}`);
        } else {
          console.log('Import already exists (skipped)');
        }
      } else {
        console.log('Import already exists (skipped)');
      }
    } else {
      // Create new import
      const importStructure = {
        moduleSpecifier: modulePath,
        isTypeOnly: typeOnly
      };

      if (named.length > 0) {
        importStructure.namedImports = named;
      }
      if (defaultImport) {
        importStructure.defaultImport = defaultImport;
      }
      if (namespace) {
        importStructure.namespaceImport = namespace;
      }

      const newImport = sourceFile.addImportDeclaration(importStructure);
      sourceFile.saveSync();
      runPrettier(filePath);

      // Re-read to get accurate line number
      const updatedProject = new Project();
      const updatedFile = updatedProject.addSourceFileAtPath(filePath);
      const addedImport = updatedFile.getImportDeclaration(imp =>
        imp.getModuleSpecifierValue() === modulePath
      );

      if (addedImport) {
        const line = addedImport.getStartLineNumber();
        console.log(`Added import at line ${line}`);
      } else {
        console.log('Added import');
      }
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
