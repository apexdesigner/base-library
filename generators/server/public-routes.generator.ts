import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary } from '@apexdesigner/generator';
import { getBehaviorFunction, getBehaviorOptions, getBehaviorParent } from '@apexdesigner/utilities';
import { kebabCase } from 'change-case';
import pluralize from 'pluralize';
import createDebug from 'debug';

const Debug = createDebug('BaseLibrary:generators:publicRoutes');

const publicRoutesGenerator: DesignGenerator = {
  name: 'public-routes',

  isAggregate: true,

  triggers: [
    {
      metadataType: 'AppBehavior',
    },
    {
      metadataType: 'Behavior',
    },
    {
      metadataType: 'Project',
      condition: (metadata) => !isLibrary(metadata),
    },
  ],

  outputs: () => ['server/src/routes/public-routes.ts'],

  async generate(_metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');

    const routes: string[] = [];

    // Collect app behaviors with roles: [Everyone]
    const appBehaviors = context.listMetadata('AppBehavior').filter(behavior => {
      const options = getBehaviorOptions(behavior.sourceFile);
      return options?.httpMethod && Array.isArray(options.roles) && (options.roles as string[]).includes('Everyone');
    });
    debug('appBehaviors.length %j', appBehaviors.length);

    for (const behavior of appBehaviors) {
      const options = getBehaviorOptions(behavior.sourceFile);
      if (!options) continue;

      const func = getBehaviorFunction(behavior.sourceFile);
      if (!func) continue;

      const path = options.path
        ? (options.path as string)
        : `/api/${kebabCase(func.name)}`;
      debug('path %j', path);

      routes.push(path);
    }

    // Collect BO behaviors with roles: [Everyone]
    const boBehaviors = context.listMetadata('Behavior').filter(behavior => {
      const options = getBehaviorOptions(behavior.sourceFile);
      return options?.httpMethod && Array.isArray(options.roles) && (options.roles as string[]).includes('Everyone');
    });
    debug('boBehaviors.length %j', boBehaviors.length);

    for (const behavior of boBehaviors) {
      const options = getBehaviorOptions(behavior.sourceFile);
      if (!options) continue;

      const func = getBehaviorFunction(behavior.sourceFile);
      if (!func) continue;

      const parentName = getBehaviorParent(behavior.sourceFile);
      if (!parentName) continue;

      const pluralKebab = kebabCase(pluralize(parentName));
      const behaviorKebab = kebabCase(func.name);
      const isInstance = options.type === 'Instance';

      const path = isInstance
        ? `/api/${pluralKebab}/:id/${behaviorKebab}`
        : `/api/${pluralKebab}/${behaviorKebab}`;
      debug('path %j', path);

      routes.push(path);
    }

    // Sort alphabetically
    routes.sort();

    const lines: string[] = [];
    lines.push('export const publicRoutes = [');
    for (const route of routes) {
      lines.push(`  "${route}",`);
    }
    lines.push('] as const;');

    return lines.join('\n') + '\n';
  },
};

export { publicRoutesGenerator };
