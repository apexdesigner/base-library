#!/usr/bin/env node

const { Project, Scope } = require('ts-morph');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

function usage() {
  console.error('Usage: node add-constructor.cjs <file-path> <class-name> [options]');
  console.error('');
  console.error('Options:');
  console.error('  --params="private apiUrl: string, timeout: number"  Parameter list');
  console.error('  --body="this.setup();"                              Constructor body (inline)');
  console.error('  --body-file=path                                    Read body from file (auto-deleted)');
  console.error('');
  console.error('Examples:');
  console.error('  # Simple constructor with inline body');
  console.error('  node add-constructor.cjs file.ts MyClass --params="private http: HttpClient" --body="this.init();"');
  console.error('');
  console.error('  # Constructor with body from file');
  console.error('  node add-constructor.cjs file.ts MyClass --params="config: Config" --body-file=/tmp/ctor-body.js');
  process.exit(1);
}

function parseArgs() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    usage();
  }

  const filePath = path.resolve(args[0]);
  const className = args[1];
  let params = '';
  let body = '';
  let bodyFile = null;

  for (let i = 2; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--params=')) {
      params = arg.split('=').slice(1).join('=').replace(/^["']|["']$/g, '');
    } else if (arg.startsWith('--body=')) {
      body = arg.split('=').slice(1).join('=').replace(/^["']|["']$/g, '');
    } else if (arg.startsWith('--body-file=')) {
      bodyFile = arg.split('=').slice(1).join('=').replace(/^["']|["']$/g, '');
    }
  }

  // Read body from file if specified
  if (bodyFile) {
    const resolvedBodyFile = path.resolve(bodyFile);
    if (!fs.existsSync(resolvedBodyFile)) {
      console.error(`Error: Body file not found: ${resolvedBodyFile}`);
      process.exit(1);
    }
    body = fs.readFileSync(resolvedBodyFile, 'utf-8');
    // Auto-cleanup: delete the body file after reading
    try {
      fs.unlinkSync(resolvedBodyFile);
    } catch (e) {
      // Ignore cleanup errors
    }
  }

  return { filePath, className, params, body };
}

function runPrettier(filePath) {
  try {
    execSync(`npx prettier --write "${filePath}"`, { stdio: 'ignore' });
  } catch (error) {
    // Prettier not available or failed
  }
}

function parseParameters(paramsStr) {
  if (!paramsStr || paramsStr.trim() === '') {
    return [];
  }

  const params = [];
  const parts = paramsStr.split(',').map(p => p.trim());

  for (const part of parts) {
    // Match patterns like: "name: type", "private name: type", "public readonly name: type"
    const match = part.match(/^((?:private|public|protected|readonly)\s+)?((?:private|public|protected|readonly)\s+)?(\w+)(\?)?:\s*(.+)$/);
    if (match) {
      const scope1 = match[1]?.trim();
      const scope2 = match[2]?.trim();
      const name = match[3];
      const hasQuestionToken = !!match[4];
      const type = match[5];

      const paramStructure = {
        name: name,
        type: type,
        hasQuestionToken: hasQuestionToken
      };

      // Handle scope modifiers
      const scopeModifiers = [scope1, scope2].filter(Boolean);
      for (const modifier of scopeModifiers) {
        if (modifier === 'private') {
          paramStructure.scope = Scope.Private;
        } else if (modifier === 'public') {
          paramStructure.scope = Scope.Public;
        } else if (modifier === 'protected') {
          paramStructure.scope = Scope.Protected;
        } else if (modifier === 'readonly') {
          paramStructure.isReadonly = true;
        }
      }

      params.push(paramStructure);
    }
  }

  return params;
}

function main() {
  const { filePath, className, params, body } = parseArgs();

  try {
    const project = new Project();
    const sourceFile = project.addSourceFileAtPath(filePath);

    // Find the class
    const classDecl = sourceFile.getClass(className);
    if (!classDecl) {
      console.error(`Error: Could not find class '${className}'`);
      process.exit(1);
    }

    // Remove existing constructor if it exists
    const existingConstructors = classDecl.getConstructors();
    if (existingConstructors.length > 0) {
      for (const ctor of existingConstructors) {
        ctor.remove();
      }
    }

    // Parse parameters
    const parameters = parseParameters(params);

    // Create the constructor
    const constructorStructure = {
      parameters: parameters
    };

    if (body) {
      constructorStructure.statements = body;
    }

    const constructor = classDecl.addConstructor(constructorStructure);

    sourceFile.saveSync();
    runPrettier(filePath);

    // Re-read to get accurate line numbers
    const updatedProject = new Project();
    const updatedFile = updatedProject.addSourceFileAtPath(filePath);
    const updatedClass = updatedFile.getClass(className);
    const addedConstructor = updatedClass?.getConstructors()[0];

    if (addedConstructor) {
      const startLine = addedConstructor.getStartLineNumber();
      const endLine = addedConstructor.getEndLineNumber();
      console.log(`Added constructor at lines ${startLine}-${endLine}`);
    } else {
      console.log('Added constructor');
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
