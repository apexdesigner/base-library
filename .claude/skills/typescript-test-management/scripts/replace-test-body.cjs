#!/usr/bin/env node

const { Project, SyntaxKind } = require('ts-morph');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

function usage() {
  console.error('Usage: node replace-test-body.cjs <file-path> <name> [new-body] [options]');
  console.error('');
  console.error('Arguments:');
  console.error('  name       - Name of test or describe block');
  console.error('  new-body   - JavaScript/TypeScript code for the new body (or use --body-file)');
  console.error('');
  console.error('Options:');
  console.error('  --type=test       Replace test body (default)');
  console.error('  --type=describe   Replace describe body');
  console.error('  --body-file=path  Read new body from file (auto-deleted after use)');
  console.error('');
  console.error('Note: Supports partial matching of name');
  console.error('');
  console.error('Examples:');
  console.error('  # Inline body');
  console.error('  node replace-test-body.cjs file.ts "should work" "expect(true).toBe(true)"');
  console.error('');
  console.error('  # Body from file');
  console.error('  node replace-test-body.cjs file.ts "should work" --body-file=/tmp/body.js');
  process.exit(1);
}

function parseArgs() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    usage();
  }

  const filePath = path.resolve(args[0]);
  const name = args[1];
  let newBody = null;
  let bodyFile = null;
  let type = 'test';

  for (let i = 2; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--type=')) {
      type = arg.split('=')[1];
      if (type !== 'test' && type !== 'describe') {
        usage();
      }
    } else if (arg.startsWith('--body-file=')) {
      bodyFile = arg.split('=').slice(1).join('=').replace(/^["']|["']$/g, '');
    } else if (!arg.startsWith('--') && newBody === null) {
      newBody = arg;
    }
  }

  // Read body from file if specified
  if (bodyFile) {
    const resolvedBodyFile = path.resolve(bodyFile);
    if (!fs.existsSync(resolvedBodyFile)) {
      console.error(`Error: Body file not found: ${resolvedBodyFile}`);
      process.exit(1);
    }
    newBody = fs.readFileSync(resolvedBodyFile, 'utf-8');
    // Auto-cleanup: delete the body file after reading
    try {
      fs.unlinkSync(resolvedBodyFile);
    } catch (e) {
      // Ignore cleanup errors
    }
  }

  if (!newBody) {
    console.error('Error: No body provided. Use positional argument or --body-file');
    process.exit(1);
  }

  return { filePath, name, newBody, type };
}

function findByName(sourceFile, name, type, exactMatch = false) {
  const matches = [];

  sourceFile.forEachDescendant((node) => {
    if (node.isKind(SyntaxKind.CallExpression)) {
      const expr = node.getExpression();
      const exprText = expr.getText();

      let isTargetType = false;
      if (type === 'describe' && exprText && exprText.startsWith('describe')) {
        isTargetType = true;
      } else if (type === 'test' && exprText && (exprText.startsWith('it') || exprText.startsWith('test'))) {
        isTargetType = true;
      }

      if (isTargetType) {
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
              matches.push({ node, name: literalText });
            }
          }
        }
      }
    }
  });

  return matches;
}

function getIndentation(node) {
  const sourceFile = node.getSourceFile();
  const text = sourceFile.getFullText();
  const lines = text.split('\n');
  const startLine = node.getStartLineNumber();

  if (startLine > 0 && startLine <= lines.length) {
    const line = lines[startLine - 1];
    const match = line.match(/^(\s+)/);
    if (match) {
      return match[1];
    }
  }

  return '  ';
}

function indentCode(code, baseIndent) {
  const lines = code.split('\n');
  return lines.map((line, index) => {
    // Don't indent empty lines
    if (line.trim() === '') return '';
    // First line doesn't need extra indent
    if (index === 0) return line;
    // Other lines get the base indent
    return baseIndent + line;
  }).join('\n');
}

function runPrettier(filePath) {
  try {
    execSync(`npx prettier --write "${filePath}"`, { stdio: 'ignore' });
  } catch (error) {
    // Prettier not available or failed
  }
}

function main() {
  const { filePath, name, newBody, type } = parseArgs();

  try {
    const project = new Project();
    const sourceFile = project.addSourceFileAtPath(filePath);

    // Try exact match first
    let matches = findByName(sourceFile, name, type, true);

    // If no exact match, try partial match
    if (matches.length === 0) {
      matches = findByName(sourceFile, name, type, false);
    }

    if (matches.length === 0) {
      console.error(`Error: No ${type} found matching "${name}"`);
      process.exit(1);
    }

    if (matches.length > 1) {
      console.error(`Error: Multiple ${type}s match "${name}":`);
      matches.forEach(m => console.error(`  - ${m.name}`));
      console.error('Please be more specific');
      process.exit(1);
    }

    const match = matches[0];
    const callNode = match.node;

    // Find the callback function (second argument)
    const args = callNode.getArguments();
    if (args.length < 2) {
      console.error(`Error: ${type} "${match.name}" has no callback function`);
      process.exit(1);
    }

    const callback = args[1];
    let body;

    if (callback.isKind(SyntaxKind.ArrowFunction)) {
      body = callback.getBody();
    } else if (callback.isKind(SyntaxKind.FunctionExpression)) {
      body = callback.getBody();
    }

    if (!body) {
      console.error(`Error: Could not find callback body for ${type} "${match.name}"`);
      process.exit(1);
    }

    // Get indentation
    const indent = getIndentation(callNode);
    const bodyIndent = indent + '  ';

    // If body is a block, replace its contents
    if (body.isKind(SyntaxKind.Block)) {
      const openBrace = body.getFirstChildByKind(SyntaxKind.OpenBraceToken);
      const closeBrace = body.getLastChildByKind(SyntaxKind.CloseBraceToken);

      if (openBrace && closeBrace) {
        const startPos = openBrace.getEnd();
        const endPos = closeBrace.getStart();

        // Indent the new body
        const indentedBody = indentCode(newBody, bodyIndent);

        const newText = `\n${bodyIndent}${indentedBody}\n${indent}`;
        sourceFile.replaceText([startPos, endPos], newText);
      }
    } else {
      // Non-block body (single expression), replace the whole body
      const startPos = body.getStart();
      const endPos = body.getEnd();

      sourceFile.replaceText([startPos, endPos], newBody);
    }

    sourceFile.saveSync();
    runPrettier(filePath);

    // Re-read to get line numbers
    const updatedProject = new Project();
    const updatedFile = updatedProject.addSourceFileAtPath(filePath);
    const updated = findByName(updatedFile, match.name, type, true);

    if (updated.length > 0) {
      const startLine = updated[0].node.getStartLineNumber();
      const endLine = updated[0].node.getEndLineNumber();
      console.log(`Replaced ${type} body "${match.name}" (lines ${startLine}-${endLine})`);
    } else {
      console.log(`Replaced ${type} body "${match.name}"`);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
