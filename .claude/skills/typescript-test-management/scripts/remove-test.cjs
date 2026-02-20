#!/usr/bin/env node

const { Project, SyntaxKind } = require('ts-morph');
const path = require('path');
const { execSync } = require('child_process');

function usage() {
  console.error('Usage: node remove-test.js <file-path> <test-name>');
  console.error('Note: Supports partial matching of test name');
  process.exit(1);
}

function parseArgs() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    usage();
  }

  const filePath = path.resolve(args[0]);
  const testName = args[1];

  return { filePath, testName };
}

function findTestByName(sourceFile, name, exactMatch = false) {
  const matches = [];

  sourceFile.forEachDescendant((node) => {
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

            if (exactMatch) {
              if (literalText === name) {
                matches.push({ node, name: literalText });
              }
            } else {
              if (literalText.includes(name)) {
                matches.push({ node, name: literalText });
              }
            }
          }
        }
      }
    }
  });

  return matches;
}

function runPrettier(filePath) {
  try {
    execSync(`npx prettier --write "${filePath}"`, { stdio: 'ignore' });
  } catch (error) {
    // Prettier not available or failed
  }
}

function main() {
  const { filePath, testName } = parseArgs();

  try {
    const project = new Project();
    const sourceFile = project.addSourceFileAtPath(filePath);

    // Try exact match first
    let matches = findTestByName(sourceFile, testName, true);

    // If no exact match, try partial match
    if (matches.length === 0) {
      matches = findTestByName(sourceFile, testName, false);
    }

    if (matches.length === 0) {
      console.error(`Error: No test found matching "${testName}"`);
      process.exit(1);
    }

    if (matches.length > 1) {
      console.error(`Error: Multiple tests match "${testName}":`);
      matches.forEach(m => console.error(`  - ${m.name}`));
      console.error('Please be more specific');
      process.exit(1);
    }

    const match = matches[0];
    const startLine = match.node.getStartLineNumber();
    const endLine = match.node.getEndLineNumber();

    // Find the parent statement to remove
    const statement = match.node.getFirstAncestorByKind(SyntaxKind.ExpressionStatement);
    if (statement) {
      statement.remove();
    } else {
      // If not in an expression statement, remove the call expression directly
      const parent = match.node.getParent();
      if (parent) {
        parent.removeChildIndex(match.node.getChildIndex());
      }
    }

    sourceFile.saveSync();
    runPrettier(filePath);

    console.log(`Removed test "${match.name}" (lines ${startLine}-${endLine})`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
