#!/usr/bin/env node

const { Project, Scope } = require('ts-morph');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

function usage() {
  console.error('Usage: node add-method.cjs <file-path> <class-name> <method-name> [options]');
  console.error('');
  console.error('Options:');
  console.error('  --visibility=public|private|protected   Method visibility (default: public)');
  console.error('  --static                                Make method static');
  console.error('  --async                                 Make method async');
  console.error('  --params="name: string, age: number"    Parameter list');
  console.error('  --return-type="Promise<void>"           Return type');
  console.error('  --body="code"                           Method body (inline)');
  console.error('  --body-file=path                        Read body from file (auto-deleted)');
  console.error('');
  console.error('Examples:');
  console.error('  # Simple method with inline body');
  console.error('  node add-method.cjs file.ts MyClass getData --return-type="string" --body="return this.data;"');
  console.error('');
  console.error('  # Async method with body from file');
  console.error('  node add-method.cjs file.ts MyClass fetchUser --async --params="id: string" \\');
  console.error('    --return-type="Promise<User>" --body-file=/tmp/method-body.js');
  process.exit(1);
}

function parseArgs() {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    usage();
  }

  const filePath = path.resolve(args[0]);
  const className = args[1];
  const methodName = args[2];
  let visibility = 'public';
  let isStatic = false;
  let isAsync = false;
  let params = '';
  let returnType = 'void';
  let body = null;
  let bodyFile = null;

  for (let i = 3; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--visibility=')) {
      visibility = arg.split('=')[1];
    } else if (arg === '--static') {
      isStatic = true;
    } else if (arg === '--async') {
      isAsync = true;
    } else if (arg.startsWith('--params=')) {
      params = arg.split('=').slice(1).join('=').replace(/^["']|["']$/g, '');
    } else if (arg.startsWith('--return-type=')) {
      returnType = arg.split('=').slice(1).join('=').replace(/^["']|["']$/g, '');
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

  return { filePath, className, methodName, visibility, isStatic, isAsync, params, returnType, body };
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
    const match = part.match(/^(\w+)(\?)?:\s*(.+)$/);
    if (match) {
      params.push({
        name: match[1],
        type: match[3],
        hasQuestionToken: !!match[2]
      });
    }
  }

  return params;
}

function main() {
  const { filePath, className, methodName, visibility, isStatic, isAsync, params, returnType, body } = parseArgs();

  try {
    const project = new Project();
    const sourceFile = project.addSourceFileAtPath(filePath);

    // Find the class
    const classDecl = sourceFile.getClass(className);
    if (!classDecl) {
      console.error(`Error: Could not find class '${className}'`);
      process.exit(1);
    }

    // Check if method already exists
    const existingMethod = classDecl.getMethod(methodName);
    if (existingMethod) {
      console.error(`Error: Method '${methodName}' already exists in class '${className}'`);
      process.exit(1);
    }

    // Parse parameters
    const parameters = parseParameters(params);

    // Create the method
    const scopeMap = {
      'public': Scope.Public,
      'private': Scope.Private,
      'protected': Scope.Protected
    };

    const method = classDecl.addMethod({
      name: methodName,
      scope: scopeMap[visibility] || Scope.Public,
      isStatic: isStatic,
      isAsync: isAsync,
      parameters: parameters,
      returnType: returnType,
      statements: body || '// TODO: implement'
    });

    sourceFile.saveSync();
    runPrettier(filePath);

    // Re-read to get accurate line numbers
    const updatedProject = new Project();
    const updatedFile = updatedProject.addSourceFileAtPath(filePath);
    const updatedClass = updatedFile.getClass(className);
    const addedMethod = updatedClass?.getMethod(methodName);

    if (addedMethod) {
      const startLine = addedMethod.getStartLineNumber();
      const endLine = addedMethod.getEndLineNumber();
      console.log(`Added method at lines ${startLine}-${endLine}`);
    } else {
      console.log('Added method');
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
