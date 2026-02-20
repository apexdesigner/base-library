#!/usr/bin/env node

const { Project, Scope } = require('ts-morph');
const path = require('path');
const { execSync } = require('child_process');

function usage() {
  console.error('Usage: node add-property.js <file-path> <class-name> <property-name> [options]');
  console.error('Options:');
  console.error('  --type="string"                         Property type (required)');
  console.error('  --visibility=public|private|protected   Property visibility (default: public)');
  console.error('  --readonly                              Make property readonly');
  console.error('  --static                                Make property static');
  console.error('  --initial-value="value"                 Initial value');
  process.exit(1);
}

function parseArgs() {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    usage();
  }

  const filePath = path.resolve(args[0]);
  const className = args[1];
  const propertyName = args[2];
  let type = null;
  let visibility = 'public';
  let isReadonly = false;
  let isStatic = false;
  let initialValue = null;

  for (let i = 3; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--type=')) {
      type = arg.split('=')[1].replace(/^["']|["']$/g, '');
    } else if (arg.startsWith('--visibility=')) {
      visibility = arg.split('=')[1];
    } else if (arg === '--readonly') {
      isReadonly = true;
    } else if (arg === '--static') {
      isStatic = true;
    } else if (arg.startsWith('--initial-value=')) {
      initialValue = arg.split('=')[1].replace(/^["']|["']$/g, '');
    }
  }

  if (!type) {
    console.error('Error: --type is required');
    usage();
  }

  return { filePath, className, propertyName, type, visibility, isReadonly, isStatic, initialValue };
}

function runPrettier(filePath) {
  try {
    execSync(`npx prettier --write "${filePath}"`, { stdio: 'ignore' });
  } catch (error) {
    // Prettier not available or failed
  }
}

function main() {
  const { filePath, className, propertyName, type, visibility, isReadonly, isStatic, initialValue } = parseArgs();

  try {
    const project = new Project();
    const sourceFile = project.addSourceFileAtPath(filePath);

    // Find the class
    const classDecl = sourceFile.getClass(className);
    if (!classDecl) {
      console.error(`Error: Could not find class '${className}'`);
      process.exit(1);
    }

    // Check if property already exists
    const existingProperty = classDecl.getProperty(propertyName);
    if (existingProperty) {
      console.error(`Error: Property '${propertyName}' already exists in class '${className}'`);
      process.exit(1);
    }

    // Create the property
    const scopeMap = {
      'public': Scope.Public,
      'private': Scope.Private,
      'protected': Scope.Protected
    };

    const propertyStructure = {
      name: propertyName,
      type: type,
      scope: scopeMap[visibility] || Scope.Public,
      isReadonly: isReadonly,
      isStatic: isStatic
    };

    if (initialValue !== null) {
      propertyStructure.initializer = initialValue;
    }

    const property = classDecl.addProperty(propertyStructure);

    sourceFile.saveSync();
    runPrettier(filePath);

    // Re-read to get accurate line number
    const updatedProject = new Project();
    const updatedFile = updatedProject.addSourceFileAtPath(filePath);
    const updatedClass = updatedFile.getClass(className);
    const addedProperty = updatedClass?.getProperty(propertyName);

    if (addedProperty) {
      const line = addedProperty.getStartLineNumber();
      console.log(`Added property at line ${line}`);
    } else {
      console.log('Added property');
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
