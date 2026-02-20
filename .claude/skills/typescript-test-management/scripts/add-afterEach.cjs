#!/usr/bin/env node

const { Project, SyntaxKind } = require('ts-morph');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

function usage() {
  console.error('Usage: node add-afterEach.cjs <file-path> [options]');
  console.error('');
  console.error('Options:');
  console.error('  --describe="Name"     Add to specific describe block');
  console.error('  --body="code"         Inline body');
  console.error('  --body-file=path      Read body from file (auto-deleted after use)');
  console.error('  --async               Create async afterEach');
  console.error('');
  console.error('Examples:');
  console.error('  # Simple inline body');
  console.error('  node add-afterEach.cjs file.ts --body="jest.restoreAllMocks()"');
  console.error('');
  console.error('  # Async afterEach with body from file');
  console.error('  node add-afterEach.cjs file.ts --describe="Suite" --async --body-file=/tmp/teardown.js');
  process.exit(1);
}

function parseArgs() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    usage();
  }

  const filePath = path.resolve(args[0]);
  let describeName = null;
  let body = null;
  let bodyFile = null;
  let isAsync = false;

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--describe=')) {
      describeName = arg.split('=').slice(1).join('=').replace(/^["']|["']$/g, '');
    } else if (arg.startsWith('--body=')) {
      body = arg.split('=').slice(1).join('=').replace(/^["']|["']$/g, '');
    } else if (arg.startsWith('--body-file=')) {
      bodyFile = arg.split('=').slice(1).join('=').replace(/^["']|["']$/g, '');
    } else if (arg === '--async') {
      isAsync = true;
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

  if (!body) {
    console.error('Error: No body provided. Use --body or --body-file');
    process.exit(1);
  }

  return { filePath, describeName, body, isAsync };
}

function findDescribeByName(sourceFile, name) {
  let found = null;

  sourceFile.forEachDescendant((node) => {
    if (found) return;

    if (node.isKind(SyntaxKind.CallExpression)) {
      const expr = node.getExpression();
      const exprText = expr.getText();

      if (exprText && exprText.startsWith('describe')) {
        const args = node.getArguments();
        if (args.length > 0) {
          const firstArg = args[0];
          if (firstArg.isKind(SyntaxKind.StringLiteral) ||
              firstArg.isKind(SyntaxKind.NoSubstitutionTemplateLiteral)) {
            const literalText = firstArg.getLiteralText();
            if (literalText === name) {
              found = node;
            }
          }
        }
      }
    }
  });

  return found;
}

function findFirstDescribe(sourceFile) {
  let found = null;

  sourceFile.forEachDescendant((node) => {
    if (found) return;

    if (node.isKind(SyntaxKind.CallExpression)) {
      const expr = node.getExpression();
      const exprText = expr.getText();

      if (exprText && exprText.startsWith('describe')) {
        found = node;
      }
    }
  });

  return found;
}

function findExistingAfterEach(describeBody) {
  let found = null;

  describeBody.forEachDescendant((node) => {
    if (found) return;

    if (node.isKind(SyntaxKind.CallExpression)) {
      const expr = node.getExpression();
      const exprText = expr.getText();

      if (exprText === 'afterEach') {
        found = node;
      }
    }
  });

  return found;
}

function findLastSetupBlock(describeBody) {
  // Find the last beforeEach, beforeAll, or afterAll to insert after
  let lastSetup = null;

  describeBody.forEachDescendant((node) => {
    if (node.isKind(SyntaxKind.CallExpression)) {
      const expr = node.getExpression();
      const exprText = expr.getText();

      if (['beforeEach', 'beforeAll', 'afterAll'].includes(exprText)) {
        lastSetup = node;
      }
    }
  });

  return lastSetup;
}

function getIndentation(sourceFile) {
  const text = sourceFile.getFullText();
  const lines = text.split('\n');

  for (const line of lines) {
    const match = line.match(/^(\s+)/);
    if (match) {
      const indent = match[1];
      if (indent.startsWith('\t')) {
        return '\t';
      } else if (indent.length >= 2) {
        return ' '.repeat(indent.length >= 4 ? 4 : 2);
      }
    }
  }

  return '  ';
}

function indentCode(code, baseIndent) {
  const lines = code.split('\n');
  return lines.map((line, index) => {
    if (line.trim() === '') return '';
    if (index === 0) return line;
    return baseIndent + line;
  }).join('\n');
}

function createAfterEachBlock(indent, body, isAsync) {
  const asyncKeyword = isAsync ? 'async ' : '';
  const indentedBody = indentCode(body, indent + indent);

  return `${indent}afterEach(${asyncKeyword}() => {
${indent}${indent}${indentedBody}
${indent}});`;
}

function runPrettier(filePath) {
  try {
    execSync(`npx prettier --write "${filePath}"`, { stdio: 'ignore' });
  } catch (error) {
    // Prettier not available or failed
  }
}

function main() {
  const { filePath, describeName, body, isAsync } = parseArgs();

  try {
    const project = new Project();
    const sourceFile = project.addSourceFileAtPath(filePath);
    const indent = getIndentation(sourceFile);

    let targetDescribe;

    if (describeName) {
      targetDescribe = findDescribeByName(sourceFile, describeName);
      if (!targetDescribe) {
        console.error(`Error: Could not find describe block "${describeName}"`);
        process.exit(1);
      }
    } else {
      targetDescribe = findFirstDescribe(sourceFile);
      if (!targetDescribe) {
        console.error('Error: No describe block found in file');
        process.exit(1);
      }
    }

    // Find the callback body of the describe block
    const args = targetDescribe.getArguments();
    if (args.length < 2) {
      console.error('Error: Describe block has no callback function');
      process.exit(1);
    }

    const callback = args[1];
    let describeBody;

    if (callback.isKind(SyntaxKind.ArrowFunction)) {
      describeBody = callback.getBody();
    } else if (callback.isKind(SyntaxKind.FunctionExpression)) {
      describeBody = callback.getBody();
    }

    if (!describeBody) {
      console.error('Error: Could not find describe callback body');
      process.exit(1);
    }

    // Check if afterEach already exists
    const existingAfterEach = findExistingAfterEach(describeBody);
    if (existingAfterEach) {
      console.error('Error: afterEach already exists in this describe block. Use replace-test-body.cjs to modify it.');
      process.exit(1);
    }

    // Find insertion position - after any existing setup blocks, or at the start
    let insertPosition;
    const lastSetup = findLastSetupBlock(describeBody);

    if (lastSetup) {
      // Insert after the last setup block
      const setupStatement = lastSetup.getParent();
      if (setupStatement && setupStatement.isKind(SyntaxKind.ExpressionStatement)) {
        insertPosition = setupStatement.getEnd();
      } else {
        insertPosition = lastSetup.getEnd();
      }
    } else if (describeBody.isKind(SyntaxKind.Block)) {
      // Insert at the beginning of the describe body (after opening brace)
      const openBrace = describeBody.getFirstChildByKind(SyntaxKind.OpenBraceToken);
      if (openBrace) {
        insertPosition = openBrace.getEnd();
      } else {
        insertPosition = describeBody.getStart() + 1;
      }
    } else {
      insertPosition = describeBody.getStart();
    }

    const afterEachBlock = createAfterEachBlock(indent, body, isAsync);
    const textToInsert = `\n${afterEachBlock}\n`;

    sourceFile.insertText(insertPosition, textToInsert);
    sourceFile.saveSync();

    runPrettier(filePath);

    // Re-read to get accurate line numbers
    const updatedProject = new Project();
    const updatedFile = updatedProject.addSourceFileAtPath(filePath);

    // Find the added afterEach
    let addedAfterEach = null;
    updatedFile.forEachDescendant((node) => {
      if (addedAfterEach) return;
      if (node.isKind(SyntaxKind.CallExpression)) {
        const expr = node.getExpression();
        if (expr.getText() === 'afterEach') {
          addedAfterEach = node;
        }
      }
    });

    if (addedAfterEach) {
      const startLine = addedAfterEach.getStartLineNumber();
      const endLine = addedAfterEach.getEndLineNumber();
      console.log(`Added afterEach at lines ${startLine}-${endLine}`);
    } else {
      console.log('Added afterEach');
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
