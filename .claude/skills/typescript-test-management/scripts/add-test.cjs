#!/usr/bin/env node

const { Project, SyntaxKind } = require('ts-morph');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

function usage() {
  console.error('Usage: node add-test.cjs <file-path> <test-name> [options]');
  console.error('');
  console.error('Options:');
  console.error('  --describe="Name"     Add to specific describe block');
  console.error('  --after-line=N        Add after line N');
  console.error('  --after-test="Name"   Add after specific test');
  console.error('  --body="code"         Inline test body');
  console.error('  --body-file=path      Read test body from file (auto-deleted after use)');
  console.error('  --async               Create async test');
  console.error('');
  console.error('Examples:');
  console.error('  # Simple test with inline body');
  console.error('  node add-test.cjs file.ts "should return null" --body="expect(result).toBeNull()"');
  console.error('');
  console.error('  # Async test with body from file');
  console.error('  node add-test.cjs file.ts "should create" --describe="Suite" --async --body-file=/tmp/body.js');
  process.exit(1);
}

function parseArgs() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    usage();
  }

  const filePath = path.resolve(args[0]);
  const testName = args[1];
  let describeName = null;
  let afterLine = null;
  let afterTest = null;
  let body = null;
  let bodyFile = null;
  let isAsync = false;

  for (let i = 2; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--describe=')) {
      describeName = arg.split('=').slice(1).join('=').replace(/^["']|["']$/g, '');
    } else if (arg.startsWith('--after-line=')) {
      afterLine = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--after-test=')) {
      afterTest = arg.split('=').slice(1).join('=').replace(/^["']|["']$/g, '');
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

  return { filePath, testName, describeName, afterLine, afterTest, body, isAsync };
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

function findTestByName(sourceFile, name, withinDescribe = null) {
  let found = null;
  let searchScope = withinDescribe ? withinDescribe : sourceFile;

  searchScope.forEachDescendant((node) => {
    if (found) return;

    if (node.isKind(SyntaxKind.CallExpression)) {
      const expr = node.getExpression();
      const exprText = expr.getText();

      if (exprText && (exprText.startsWith('it') || exprText.startsWith('test'))) {
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

function createTestBlock(testName, indent, body, isAsync) {
  const asyncKeyword = isAsync ? 'async ' : '';
  const bodyContent = body
    ? indentCode(body, indent + indent)
    : '// TODO: implement test';

  return `${indent}it('${testName}', ${asyncKeyword}() => {
${indent}${indent}${bodyContent}
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
  const { filePath, testName, describeName, afterLine, afterTest, body, isAsync } = parseArgs();

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

    // Determine insertion position
    let insertPosition;

    if (afterTest) {
      // Find the test to insert after
      const targetTest = findTestByName(sourceFile, afterTest, targetDescribe);
      if (!targetTest) {
        console.error(`Error: Could not find test "${afterTest}" in describe block`);
        process.exit(1);
      }
      // Get the statement containing the test (handles the semicolon/newline)
      const testStatement = targetTest.getParent();
      if (testStatement && testStatement.isKind(SyntaxKind.ExpressionStatement)) {
        insertPosition = testStatement.getEnd();
      } else {
        insertPosition = targetTest.getEnd();
      }
    } else if (afterLine && describeBody.getStartLineNumber() <= afterLine && afterLine <= describeBody.getEndLineNumber()) {
      insertPosition = sourceFile.getPositionOfLine(afterLine + 1);
    } else if (describeBody.isKind(SyntaxKind.Block)) {
      // Insert at the end of the block, before the closing brace
      const closeBrace = describeBody.getLastChildByKind(SyntaxKind.CloseBraceToken);
      if (closeBrace) {
        insertPosition = closeBrace.getPos();
      } else {
        insertPosition = describeBody.getEnd() - 1;
      }
    } else {
      insertPosition = describeBody.getEnd();
    }

    const testBlock = createTestBlock(testName, indent, body, isAsync);
    const textToInsert = `\n${testBlock}\n`;

    sourceFile.insertText(insertPosition, textToInsert);
    sourceFile.saveSync();

    runPrettier(filePath);

    // Re-read to get accurate line numbers
    const updatedProject = new Project();
    const updatedFile = updatedProject.addSourceFileAtPath(filePath);
    const addedTest = findTestByName(updatedFile, testName);

    if (addedTest) {
      const startLine = addedTest.getStartLineNumber();
      const endLine = addedTest.getEndLineNumber();
      console.log(`Added test at lines ${startLine}-${endLine}`);
    } else {
      console.log('Added test');
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
