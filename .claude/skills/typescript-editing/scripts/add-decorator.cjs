#!/usr/bin/env node

const { Project } = require('ts-morph');
const path = require('path');
const { execSync } = require('child_process');

function usage() {
  console.error('Usage: node add-decorator.js <file-path> <class-name> <decorator-name> [options]');
  console.error('Options:');
  console.error('  --target=class|method|property   Target type (default: class)');
  console.error('  --method-name="methodName"       Target method (when target=method)');
  console.error('  --property-name="propertyName"   Target property (when target=property)');
  console.error('  --args="arg1, arg2"              Decorator arguments');
  process.exit(1);
}

function parseArgs() {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    usage();
  }

  const filePath = path.resolve(args[0]);
  const className = args[1];
  const decoratorName = args[2];
  let target = 'class';
  let methodName = null;
  let propertyName = null;
  let decoratorArgs = null;

  for (let i = 3; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--target=')) {
      target = arg.split('=')[1];
    } else if (arg.startsWith('--method-name=')) {
      methodName = arg.split('=')[1].replace(/^["']|["']$/g, '');
    } else if (arg.startsWith('--property-name=')) {
      propertyName = arg.split('=')[1].replace(/^["']|["']$/g, '');
    } else if (arg.startsWith('--args=')) {
      decoratorArgs = arg.split('=')[1].replace(/^["']|["']$/g, '');
    }
  }

  return { filePath, className, decoratorName, target, methodName, propertyName, decoratorArgs };
}

function runPrettier(filePath) {
  try {
    execSync(`npx prettier --write "${filePath}"`, { stdio: 'ignore' });
  } catch (error) {
    // Prettier not available or failed
  }
}

function main() {
  const { filePath, className, decoratorName, target, methodName, propertyName, decoratorArgs } = parseArgs();

  try {
    const project = new Project();
    const sourceFile = project.addSourceFileAtPath(filePath);

    // Find the class
    const classDecl = sourceFile.getClass(className);
    if (!classDecl) {
      console.error(`Error: Could not find class '${className}'`);
      process.exit(1);
    }

    let targetNode = null;
    let targetDescription = '';

    if (target === 'class') {
      targetNode = classDecl;
      targetDescription = `class '${className}'`;
    } else if (target === 'method') {
      if (!methodName) {
        console.error('Error: --method-name is required when target=method');
        process.exit(1);
      }
      targetNode = classDecl.getMethod(methodName);
      if (!targetNode) {
        console.error(`Error: Could not find method '${methodName}' in class '${className}'`);
        process.exit(1);
      }
      targetDescription = `method '${methodName}'`;
    } else if (target === 'property') {
      if (!propertyName) {
        console.error('Error: --property-name is required when target=property');
        process.exit(1);
      }
      targetNode = classDecl.getProperty(propertyName);
      if (!targetNode) {
        console.error(`Error: Could not find property '${propertyName}' in class '${className}'`);
        process.exit(1);
      }
      targetDescription = `property '${propertyName}'`;
    } else {
      console.error(`Error: Invalid target '${target}'. Must be class, method, or property`);
      process.exit(1);
    }

    // Build decorator structure
    const decoratorStructure = {
      name: decoratorName
    };

    if (decoratorArgs) {
      decoratorStructure.arguments = [decoratorArgs];
    }

    // Add the decorator
    targetNode.addDecorator(decoratorStructure);

    sourceFile.saveSync();
    runPrettier(filePath);

    console.log(`Added @${decoratorName} decorator to ${targetDescription}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
