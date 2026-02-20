#!/usr/bin/env node

const { Project, SyntaxKind } = require('ts-morph');
const path = require('path');
const { execSync } = require('child_process');

function usage() {
  console.error('Usage: node toggle-skip.js <file-path> <test-or-describe-name> <--skip|--only|--none>');
  console.error('Note: Supports partial matching of name');
  process.exit(1);
}

function parseArgs() {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    usage();
  }

  const filePath = path.resolve(args[0]);
  const name = args[1];
  const modeArg = args[2];

  let mode;
  if (modeArg === '--skip') {
    mode = 'skip';
  } else if (modeArg === '--only') {
    mode = 'only';
  } else if (modeArg === '--none') {
    mode = 'none';
  } else {
    usage();
  }

  return { filePath, name, mode };
}

function findTestOrDescribe(sourceFile, name, exactMatch = false) {
  const matches = [];

  sourceFile.forEachDescendant((node) => {
    if (node.isKind(SyntaxKind.CallExpression)) {
      const expr = node.getExpression();
      const exprText = expr.getText();

      if (exprText && (
        exprText.startsWith('describe') ||
        exprText.startsWith('it') ||
        exprText.startsWith('test')
      )) {
        const args = node.getArguments();
        if (args.length > 0) {
          const firstArg = args[0];
          if (firstArg.isKind(SyntaxKind.StringLiteral) ||
              firstArg.isKind(SyntaxKind.NoSubstitutionTemplateLiteral)) {
            const literalText = firstArg.getLiteralText();

            const isMatch = exactMatch
              ? literalText === name
              : literalText.includes(name);

            if (isMatch) {
              matches.push({ node, name: literalText, expr });
            }
          }
        }
      }
    }
  });

  return matches;
}

function getBaseCallName(exprText) {
  // Extract base name (describe, it, test) from describe.skip, it.only, etc.
  return exprText.split('.')[0];
}

function updateCallExpression(callNode, expr, mode) {
  const exprText = expr.getText();
  const baseName = getBaseCallName(exprText);

  let newExprText;
  if (mode === 'none') {
    newExprText = baseName;
  } else {
    newExprText = `${baseName}.${mode}`;
  }

  // Get the current expression's position and text
  const sourceFile = callNode.getSourceFile();
  const exprStart = expr.getStart();
  const exprEnd = expr.getEnd();

  // Replace the expression text
  sourceFile.replaceText([exprStart, exprEnd], newExprText);
}

function runPrettier(filePath) {
  try {
    execSync(`npx prettier --write "${filePath}"`, { stdio: 'ignore' });
  } catch (error) {
    // Prettier not available or failed
  }
}

function main() {
  const { filePath, name, mode } = parseArgs();

  try {
    const project = new Project();
    const sourceFile = project.addSourceFileAtPath(filePath);

    // Try exact match first
    let matches = findTestOrDescribe(sourceFile, name, true);

    // If no exact match, try partial match
    if (matches.length === 0) {
      matches = findTestOrDescribe(sourceFile, name, false);
    }

    if (matches.length === 0) {
      console.error(`Error: No test or describe found matching "${name}"`);
      process.exit(1);
    }

    if (matches.length > 1) {
      console.error(`Error: Multiple items match "${name}":`);
      matches.forEach(m => console.error(`  - ${m.name}`));
      console.error('Please be more specific');
      process.exit(1);
    }

    const match = matches[0];
    const oldExpr = match.expr.getText();

    updateCallExpression(match.node, match.expr, mode);

    sourceFile.saveSync();
    runPrettier(filePath);

    const newExpr = mode === 'none'
      ? getBaseCallName(oldExpr)
      : `${getBaseCallName(oldExpr)}.${mode}`;

    console.log(`Changed "${match.name}" from ${oldExpr}(...) to ${newExpr}(...)`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
