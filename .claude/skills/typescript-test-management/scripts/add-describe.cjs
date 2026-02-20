#!/usr/bin/env node

const { Project, SyntaxKind } = require('ts-morph');
const path = require('path');
const { execSync } = require('child_process');

function usage() {
  console.error('Usage: node add-describe.js <file-path> <describe-name> [options]');
  console.error('Options:');
  console.error('  --after-line=N              Add after line N');
  console.error('  --after-describe="Name"     Add after describe block with name');
  process.exit(1);
}

function parseArgs() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    usage();
  }

  const filePath = path.resolve(args[0]);
  const describeName = args[1];
  let afterLine = null;
  let afterDescribe = null;

  for (let i = 2; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--after-line=')) {
      afterLine = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--after-describe=')) {
      afterDescribe = arg.split('=')[1].replace(/^["']|["']$/g, '');
    }
  }

  return { filePath, describeName, afterLine, afterDescribe };
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

function getIndentation(sourceFile) {
  // Try to detect indentation from existing code
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

  return '  '; // default to 2 spaces
}

function createDescribeBlock(describeName, indent) {
  return `describe('${describeName}', () => {
${indent}it('should work', () => {
${indent}${indent}// TODO: implement test
${indent}});
});`;
}

function runPrettier(filePath) {
  try {
    execSync(`npx prettier --write "${filePath}"`, { stdio: 'ignore' });
  } catch (error) {
    // Prettier not available or failed, that's okay
  }
}

function main() {
  const { filePath, describeName, afterLine, afterDescribe } = parseArgs();

  try {
    const project = new Project();
    const sourceFile = project.addSourceFileAtPath(filePath);
    const indent = getIndentation(sourceFile);
    const describeBlock = createDescribeBlock(describeName, indent);

    let insertPosition;

    if (afterDescribe) {
      const targetDescribe = findDescribeByName(sourceFile, afterDescribe);
      if (!targetDescribe) {
        console.error(`Error: Could not find describe block "${afterDescribe}"`);
        process.exit(1);
      }
      insertPosition = targetDescribe.getEnd();
    } else if (afterLine) {
      insertPosition = sourceFile.getPositionOfLine(afterLine);
    } else {
      // Add at the end
      insertPosition = sourceFile.getEnd();
    }

    // Insert with newlines
    const textToInsert = `\n\n${describeBlock}\n`;
    sourceFile.insertText(insertPosition, textToInsert);

    // Save the file
    sourceFile.saveSync();

    // Run prettier
    runPrettier(filePath);

    // Re-read to get accurate line numbers
    const updatedProject = new Project();
    const updatedFile = updatedProject.addSourceFileAtPath(filePath);
    const addedDescribe = findDescribeByName(updatedFile, describeName);

    if (addedDescribe) {
      const startLine = addedDescribe.getStartLineNumber();
      const endLine = addedDescribe.getEndLineNumber();
      console.log(`Added describe at lines ${startLine}-${endLine}`);
    } else {
      console.log('Added describe block');
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
