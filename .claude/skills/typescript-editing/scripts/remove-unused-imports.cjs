#!/usr/bin/env node

const { Project } = require('ts-morph');
const path = require('path');
const { execSync } = require('child_process');

function usage() {
  console.error('Usage: node remove-unused-imports.js <file-path>');
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

  if (args.length < 1) {
    usage();
  }

  const filePath = path.resolve(args[0]);

  try {
    const project = new Project();
    const sourceFile = project.addSourceFileAtPath(filePath);
    const removed = [];

    // Get all import declarations
    const imports = sourceFile.getImportDeclarations();

    for (const imp of imports) {
      const moduleSpecifier = imp.getModuleSpecifierValue();
      const line = imp.getStartLineNumber();
      let shouldRemove = true;

      // Check default import
      const defaultImport = imp.getDefaultImport();
      if (defaultImport) {
        const refs = defaultImport.findReferencesAsNodes();
        // Filter out the import declaration itself
        const usages = refs.filter(ref => ref.getSourceFile() === sourceFile && ref !== defaultImport);
        if (usages.length > 0) {
          shouldRemove = false;
        }
      }

      // Check namespace import
      const namespaceImport = imp.getNamespaceImport();
      if (namespaceImport) {
        const refs = namespaceImport.findReferencesAsNodes();
        const usages = refs.filter(ref => ref.getSourceFile() === sourceFile && ref !== namespaceImport);
        if (usages.length > 0) {
          shouldRemove = false;
        }
      }

      // Check named imports
      const namedImports = imp.getNamedImports();
      const unusedNamedImports = [];

      for (const namedImport of namedImports) {
        const name = namedImport.getName();
        const refs = namedImport.getNameNode().findReferencesAsNodes();
        const usages = refs.filter(ref => ref.getSourceFile() === sourceFile && ref !== namedImport.getNameNode());

        if (usages.length === 0) {
          unusedNamedImports.push(name);
        } else {
          shouldRemove = false;
        }
      }

      // Remove unused named imports or entire import
      if (shouldRemove) {
        removed.push({ module: moduleSpecifier, line, type: 'all' });
        imp.remove();
      } else if (unusedNamedImports.length > 0) {
        // Only remove specific unused named imports
        for (const namedImport of namedImports) {
          if (unusedNamedImports.includes(namedImport.getName())) {
            namedImport.remove();
          }
        }
        removed.push({ module: moduleSpecifier, line, type: 'partial', names: unusedNamedImports });
      }
    }

    if (removed.length > 0) {
      sourceFile.saveSync();
      runPrettier(filePath);

      console.log('Removed unused imports:');
      for (const item of removed) {
        if (item.type === 'all') {
          console.log(`  import from '${item.module}' (line ${item.line})`);
        } else {
          console.log(`  '${item.names.join("', '")}' from '${item.module}' (line ${item.line})`);
        }
      }
    } else {
      console.log('No unused imports found');
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
