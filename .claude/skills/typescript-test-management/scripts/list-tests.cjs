#!/usr/bin/env node

const { Project } = require('ts-morph');
const path = require('path');

function usage() {
  console.error('Usage: node list-tests.js <file-path>');
  process.exit(1);
}

function getCallName(node) {
  if (node.getExpression) {
    const expr = node.getExpression();
    if (expr.getText) {
      return expr.getText();
    }
  }
  return null;
}

function getTestName(node) {
  const args = node.getArguments();
  if (args.length > 0) {
    const firstArg = args[0];
    if (firstArg.isKind) {
      const SyntaxKind = require('ts-morph').SyntaxKind;
      if (firstArg.isKind(SyntaxKind.StringLiteral) ||
          firstArg.isKind(SyntaxKind.NoSubstitutionTemplateLiteral)) {
        return firstArg.getLiteralText();
      }
    }
  }
  return null;
}

function findTestBlocks(node, depth = 0) {
  const SyntaxKind = require('ts-morph').SyntaxKind;
  const results = [];

  if (node.isKind && node.isKind(SyntaxKind.CallExpression)) {
    const callName = getCallName(node);

    if (callName && (
      callName === 'describe' ||
      callName === 'it' ||
      callName === 'test' ||
      callName.match(/^(describe|it|test)\.(skip|only)$/)
    )) {
      const name = getTestName(node);
      if (name) {
        const startLine = node.getStartLineNumber();
        const endLine = node.getEndLineNumber();
        const type = callName.startsWith('describe') ? 'describe' : 'test';

        results.push({
          type,
          name,
          callName,
          startLine,
          endLine,
          depth,
          node
        });

        // Find nested blocks
        const args = node.getArguments();
        if (args.length > 1) {
          const callback = args[1];
          if (callback.isKind && (
            callback.isKind(SyntaxKind.ArrowFunction) ||
            callback.isKind(SyntaxKind.FunctionExpression)
          )) {
            const body = callback.getBody();
            if (body) {
              const nested = findTestBlocksInNode(body, depth + 1);
              results.push(...nested);
            }
          }
        }

        return results;
      }
    }
  }

  // Continue searching children
  const children = node.getChildren ? node.getChildren() : [];
  for (const child of children) {
    results.push(...findTestBlocks(child, depth));
  }

  return results;
}

function findTestBlocksInNode(node, depth) {
  const results = [];
  const children = node.getChildren ? node.getChildren() : [];

  for (const child of children) {
    results.push(...findTestBlocks(child, depth));
  }

  return results;
}

function formatOutput(blocks) {
  const lines = [];

  for (const block of blocks) {
    const indent = '  '.repeat(block.depth);
    const type = block.type === 'describe' ? 'describe' : 'it';
    lines.push(`${indent}${type} "${block.name}" (${block.startLine}-${block.endLine})`);
  }

  return lines.join('\n');
}

function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    usage();
  }

  const filePath = path.resolve(args[0]);

  try {
    const project = new Project();
    const sourceFile = project.addSourceFileAtPath(filePath);

    const blocks = findTestBlocks(sourceFile);

    if (blocks.length === 0) {
      console.log('No test blocks found');
    } else {
      console.log(formatOutput(blocks));
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
