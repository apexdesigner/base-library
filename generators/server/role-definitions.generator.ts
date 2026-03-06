import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary } from '@apexdesigner/generator';
import { getClassByBase, getDescription } from '@apexdesigner/utilities';
import createDebug from 'debug';

const Debug = createDebug('BaseLibrary:generators:roleDefinitions');

const roleDefinitionsGenerator: DesignGenerator = {
  name: 'role-definitions',

  isAggregate: true,

  triggers: [
    {
      metadataType: 'Role'
    },
    {
      metadataType: 'Project',
      condition: metadata => !isLibrary(metadata)
    }
  ],

  outputs: () => ['server/src/roles/role-definitions.ts'],

  async generate(_metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');

    const roles = context
      .listMetadata('Role')
      .map(role => {
        const roleClass = getClassByBase(role.sourceFile, 'Role');
        const description = roleClass ? getDescription(roleClass) : undefined;

        // JSDoc first line is display name, rest is description
        const jsDocs = roleClass?.getJsDocs() ?? [];
        let displayName = role.name;
        if (jsDocs.length > 0) {
          const comment = jsDocs[0].getComment();
          if (typeof comment === 'string') {
            const firstLine = comment.split('\n')[0].trim();
            if (firstLine) displayName = firstLine;
          }
        }

        return { name: role.name, displayName, description };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    debug('roles %j', roles);

    const lines: string[] = [];

    lines.push('export const roleDefinitions = [');

    for (const role of roles) {
      const desc = role.description ? `, description: "${role.description.replace(/"/g, '\\"')}"` : '';
      lines.push(`  { name: "${role.name}", displayName: "${role.displayName.replace(/"/g, '\\"')}"${desc} },`);
    }

    lines.push('] as const;');

    return lines.join('\n') + '\n';
  }
};

export { roleDefinitionsGenerator };
