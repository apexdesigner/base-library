import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { getClassByBase, getDescription } from '@apexdesigner/utilities';
import { kebabCase } from 'change-case';
import createDebug from 'debug';

const Debug = createDebug('ad3:generators:serviceType');

const serviceTypeGenerator: DesignGenerator = {
  name: 'service-type',

  triggers: [
    {
      metadataType: 'Service',
    }
  ],

  outputs: (metadata: DesignMetadata) => [
    `design/@types/services/${kebabCase(metadata.name)}.d.ts`
  ],

  async generate(metadata: DesignMetadata, _context: GenerationContext) {
    const debug = Debug.extend('generate');
    debug('name %j', metadata.name);

    const lines: string[] = [];

    lines.push(`// Generated type definitions for ${metadata.name} service`);
    lines.push('');

    const serviceClass = getClassByBase(metadata.sourceFile, 'Service');
    const description = serviceClass ? getDescription(serviceClass) : undefined;
    if (description) {
      lines.push(...description.split('\n').map(line => `// ${line}`));
      lines.push('');
    }

    // Collect properties and methods from the service class
    const members: string[] = [];
    if (serviceClass) {
      for (const prop of serviceClass.getProperties()) {
        const name = prop.getName();
        const typeNode = prop.getTypeNode();
        if (!typeNode) continue;
        const typeText = typeNode.getText();
        const isOptional = prop.hasQuestionToken();
        members.push(`  ${name}${isOptional ? '?' : ''}: ${typeText};`);
      }
      for (const method of serviceClass.getMethods()) {
        const name = method.getName();
        const returnType = method.getReturnTypeNode()?.getText() || 'void';
        const params = method.getParameters().map(p => {
          const pName = p.getName();
          const pType = p.getTypeNode()?.getText() || 'any';
          return `${pName}: ${pType}`;
        }).join(', ');
        const isAsync = method.isAsync();
        members.push(`  ${isAsync ? 'async ' : ''}${name}(${params}): ${returnType};`);
      }
    }

    if (members.length > 0) {
      lines.push(`export declare class ${metadata.name} {`);
      lines.push(...members);
      lines.push('}');
    } else {
      lines.push(`export declare class ${metadata.name} {}`);
    }

    const content = lines.join('\n');
    debug('Generated type file for %j', metadata.name);

    return content;
  }
};

export { serviceTypeGenerator };
