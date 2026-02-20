#!/usr/bin/env node

const { Project, SyntaxKind } = require('ts-morph');
const path = require('path');

function usage() {
  console.error('Usage: node list-structure.js <file-path>');
  process.exit(1);
}

function getImportInfo(importDecl) {
  const moduleSpecifier = importDecl.getModuleSpecifierValue();
  const line = importDecl.getStartLineNumber();
  return {
    text: importDecl.getText(),
    line,
    moduleSpecifier
  };
}

function getPropertyInfo(prop, indent) {
  const name = prop.getName();
  const typeNode = prop.getTypeNode();
  const type = typeNode ? typeNode.getText() : prop.getType().getText();
  const line = prop.getStartLineNumber();
  return `${indent}property ${name}: ${type} (${line})`;
}

function getMethodInfo(method, indent) {
  const name = method.getName();
  const params = method.getParameters().map(p => {
    const paramName = p.getName();
    const typeNode = p.getTypeNode();
    const paramType = typeNode ? typeNode.getText() : p.getType().getText();
    return `${paramName}: ${paramType}`;
  }).join(', ');
  const returnTypeNode = method.getReturnTypeNode();
  const returnType = returnTypeNode ? returnTypeNode.getText() : method.getReturnType().getText();
  const line = method.getStartLineNumber();
  return `${indent}method ${name}(${params}): ${returnType} (${line})`;
}

function getConstructorInfo(ctor, indent) {
  const params = ctor.getParameters().map(p => {
    const paramName = p.getName();
    const typeNode = p.getTypeNode();
    const paramType = typeNode ? typeNode.getText() : p.getType().getText();
    const scope = p.getScope();
    return scope ? `${scope} ${paramName}: ${paramType}` : `${paramName}: ${paramType}`;
  }).join(', ');
  const startLine = ctor.getStartLineNumber();
  const endLine = ctor.getEndLineNumber();
  return `${indent}constructor(${params}) (${startLine}-${endLine})`;
}

function getClassInfo(classDecl, baseIndent = '') {
  const name = classDecl.getName() || '(anonymous)';
  const startLine = classDecl.getStartLineNumber();
  const endLine = classDecl.getEndLineNumber();
  const lines = [];
  const indent = baseIndent + '  ';

  lines.push(`${baseIndent}class ${name} (${startLine}-${endLine})`);

  // Properties
  const properties = classDecl.getProperties();
  for (const prop of properties) {
    lines.push(getPropertyInfo(prop, indent));
  }

  // Constructor
  const constructors = classDecl.getConstructors();
  for (const ctor of constructors) {
    lines.push(getConstructorInfo(ctor, indent));
  }

  // Methods
  const methods = classDecl.getMethods();
  for (const method of methods) {
    lines.push(getMethodInfo(method, indent));
  }

  return lines.join('\n');
}

function getInterfaceInfo(iface, baseIndent = '') {
  const name = iface.getName();
  const startLine = iface.getStartLineNumber();
  const endLine = iface.getEndLineNumber();
  const lines = [];
  const indent = baseIndent + '  ';

  lines.push(`${baseIndent}interface ${name} (${startLine}-${endLine})`);

  // Get members directly from the interface
  const members = iface.getMembers();

  for (const member of members) {
    if (member.getKind() === SyntaxKind.PropertySignature) {
      const propName = member.getName();
      const typeNode = member.getTypeNode();
      const propType = typeNode ? typeNode.getText() : 'any';
      const line = member.getStartLineNumber();
      lines.push(`${indent}property ${propName}: ${propType} (${line})`);
    } else if (member.getKind() === SyntaxKind.MethodSignature) {
      const methodName = member.getName();
      const params = member.getParameters().map(p => {
        const paramName = p.getName();
        const typeNode = p.getTypeNode();
        const paramType = typeNode ? typeNode.getText() : 'any';
        return `${paramName}: ${paramType}`;
      }).join(', ');
      const returnTypeNode = member.getReturnTypeNode();
      const returnType = returnTypeNode ? returnTypeNode.getText() : 'any';
      const line = member.getStartLineNumber();
      lines.push(`${indent}method ${methodName}(${params}): ${returnType} (${line})`);
    }
  }

  return lines.join('\n');
}

function getFunctionInfo(func, baseIndent = '') {
  const name = func.getName() || '(anonymous)';
  const params = func.getParameters().map(p => {
    const paramName = p.getName();
    const typeNode = p.getTypeNode();
    const paramType = typeNode ? typeNode.getText() : p.getType().getText();
    return `${paramName}: ${paramType}`;
  }).join(', ');
  const returnTypeNode = func.getReturnTypeNode();
  const returnType = returnTypeNode ? returnTypeNode.getText() : func.getReturnType().getText();
  const startLine = func.getStartLineNumber();
  const endLine = func.getEndLineNumber();
  return `${baseIndent}function ${name}(${params}): ${returnType} (${startLine}-${endLine})`;
}

function getTypeAliasInfo(typeAlias, baseIndent = '') {
  const name = typeAlias.getName();
  const typeNode = typeAlias.getTypeNode();
  const type = typeNode ? typeNode.getText() : typeAlias.getType().getText();
  const line = typeAlias.getStartLineNumber();
  return `${baseIndent}type ${name} = ${type} (${line})`;
}

function getEnumInfo(enumDecl, baseIndent = '') {
  const name = enumDecl.getName();
  const startLine = enumDecl.getStartLineNumber();
  const endLine = enumDecl.getEndLineNumber();
  const lines = [];
  const indent = baseIndent + '  ';

  lines.push(`${baseIndent}enum ${name} (${startLine}-${endLine})`);

  const members = enumDecl.getMembers();
  for (const member of members) {
    const memberName = member.getName();
    const line = member.getStartLineNumber();
    lines.push(`${indent}member ${memberName} (${line})`);
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
    const output = [];

    // Imports
    const imports = sourceFile.getImportDeclarations();
    if (imports.length > 0) {
      const firstLine = imports[0].getStartLineNumber();
      const lastLine = imports[imports.length - 1].getEndLineNumber();
      output.push(`Imports (${firstLine}-${lastLine})`);
      for (const imp of imports) {
        const info = getImportInfo(imp);
        output.push(`  ${info.text} (${info.line})`);
      }
      output.push('');
    }

    // Interfaces
    const interfaces = sourceFile.getInterfaces();
    for (const iface of interfaces) {
      output.push(getInterfaceInfo(iface));
      output.push('');
    }

    // Type Aliases
    const typeAliases = sourceFile.getTypeAliases();
    for (const typeAlias of typeAliases) {
      output.push(getTypeAliasInfo(typeAlias));
      output.push('');
    }

    // Classes
    const classes = sourceFile.getClasses();
    for (const classDecl of classes) {
      output.push(getClassInfo(classDecl));
      output.push('');
    }

    // Functions
    const functions = sourceFile.getFunctions();
    for (const func of functions) {
      output.push(getFunctionInfo(func));
      output.push('');
    }

    // Enums
    const enums = sourceFile.getEnums();
    for (const enumDecl of enums) {
      output.push(getEnumInfo(enumDecl));
      output.push('');
    }

    if (output.length === 0) {
      console.log('No structure found');
    } else {
      // Remove trailing empty line
      if (output[output.length - 1] === '') {
        output.pop();
      }
      console.log(output.join('\n'));
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
