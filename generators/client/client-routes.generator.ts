import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { getClassByBase, getClassDecorator, getBehaviorFunction, getBehaviorOptions } from '@apexdesigner/utilities';
import { Node } from 'ts-morph';
import { kebabCase } from 'change-case';
import createDebug from 'debug';

const Debug = createDebug('BaseLibrary:generators:clientRoutes');

/** Strip 'Page' suffix to get the base name */
function getBaseName(name: string): string {
  return name.replace(/Page$/, '');
}

const clientRoutesGenerator: DesignGenerator = {
  name: 'client-routes',

  triggers: [
    {
      metadataType: 'Page',
    },
    {
      metadataType: 'AppBehavior',
      condition: (metadata) => {
        const options = getBehaviorOptions(metadata.sourceFile);
        return options?.type === 'Guard';
      },
    },
  ],

  outputs: () => ['client/src/app/app.routes.ts'],

  async generate(_metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');

    // Get all pages
    const allPages = context.listMetadata('Page');
    debug('allPages.length %j', allPages.length);

    // Collect guard app behaviors, sorted by sequence
    const guards = context.listMetadata('AppBehavior').filter(behavior => {
      const options = getBehaviorOptions(behavior.sourceFile);
      return options?.type === 'Guard';
    }).sort((a, b) => {
      const aSeq = (getBehaviorOptions(a.sourceFile)?.sequence as number) || 0;
      const bSeq = (getBehaviorOptions(b.sourceFile)?.sequence as number) || 0;
      return aSeq - bSeq;
    });
    debug('guards %j', guards.length);

    // Separate guards by stage
    const activateGuards = guards.filter(g => {
      const options = getBehaviorOptions(g.sourceFile);
      return (options?.stage as string || 'Activate') === 'Activate';
    });
    const deactivateGuards = guards.filter(g => {
      const options = getBehaviorOptions(g.sourceFile);
      return (options?.stage as string) === 'Deactivate';
    });

    // Extract page info from decorators
    const pageInfos = allPages
      .map(page => {
        const pageClass = getClassByBase(page.sourceFile, 'Page');
        if (!pageClass) return null;

        const pageOptions = getClassDecorator(pageClass, 'page');
        const path = pageOptions?.path as string | undefined;
        const roles = pageOptions?.roles as string[] | undefined;
        const isDefault = pageOptions?.isDefault as boolean | undefined;
        return { name: page.name, path, roles, isDefault };
      })
      .filter((page): page is { name: string; path: string; roles: string[] | undefined; isDefault: boolean | undefined } => !!page?.path);

    debug('pageInfos %j', pageInfos.map(p => ({ name: p.name, path: p.path, roles: p.roles })));

    // Sort by path specificity (more segments first, alphabetical tiebreak)
    const sortedPages = [...pageInfos].sort((a, b) => {
      const aSegments = a.path.split('/').filter(Boolean).length;
      const bSegments = b.path.split('/').filter(Boolean).length;
      if (aSegments !== bSegments) return bSegments - aSegments;
      return a.path.localeCompare(b.path);
    });

    // Find default page from isDefault option
    const defaultPage = pageInfos.find(p => p.isDefault);
    const defaultPagePath = defaultPage?.path ?? null;
    debug('defaultPagePath %j', defaultPagePath);

    // Strip leading slash and convert dotted params (:supplier.id → :supplierId)
    const processPath = (path: string) => path.replace(/^\//, '').replace(/:(\w+)\.(\w+)/g, (_match, prop, field) => `:${prop}${field.charAt(0).toUpperCase()}${field.slice(1)}`);

    // Check if any page needs guards (pages without roles: ['Everyone'] require auth)
    const hasRoleProtectedPages = pageInfos.some(p => !p.roles?.includes('Everyone'));

    // Build imports
    const importLines: string[] = [
      `import { Routes } from '@angular/router';`,
    ];

    // Import guard functions
    const guardImportNames: { activate: string[]; deactivate: string[] } = { activate: [], deactivate: [] };

    for (const guard of activateGuards) {
      const func = getBehaviorFunction(guard.sourceFile);
      if (!func) continue;
      const fileName = kebabCase(guard.name);
      importLines.push(`import { ${func.name} } from './guards/${fileName}.guard';`);
      guardImportNames.activate.push(func.name);
    }

    for (const guard of deactivateGuards) {
      const func = getBehaviorFunction(guard.sourceFile);
      if (!func) continue;
      const fileName = kebabCase(guard.name);
      importLines.push(`import { ${func.name} } from './guards/${fileName}.guard';`);
      guardImportNames.deactivate.push(func.name);
    }

    // Build routes
    const routes: string[] = [];

    // Add default route redirect
    if (defaultPagePath && defaultPagePath !== '/' && defaultPagePath !== '') {
      routes.push(`  {
    path: '',
    redirectTo: '${processPath(defaultPagePath)}',
    pathMatch: 'full'
  }`);
    }

    // Add page routes
    for (const page of sortedPages) {
      const path = processPath(page.path);
      const baseName = getBaseName(page.name);
      const className = `${baseName}Page`;
      const dirName = kebabCase(baseName);

      const routeProps: string[] = [
        `    path: '${path}'`,
        `    loadComponent: () => import('./pages/${dirName}/${dirName}.page').then(c => c.${className})`,
        `    pathMatch: 'full'`,
      ];

      // Add canActivate guards — all pages except Everyone are protected
      const isPublic = page.roles?.includes('Everyone');
      if (!isPublic && guardImportNames.activate.length > 0) {
        routeProps.push(`    canActivate: [${guardImportNames.activate.join(', ')}]`);
        if (page.roles && page.roles.length > 0) {
          routeProps.push(`    data: { roles: [${page.roles.map(r => `'${r}'`).join(', ')}] }`);
        }
      }

      // Add canDeactivate guards (apply to all pages for now)
      if (guardImportNames.deactivate.length > 0) {
        routeProps.push(`    canDeactivate: [${guardImportNames.deactivate.join(', ')}]`);
      }

      routes.push(`  {\n${routeProps.join(',\n')}\n  }`);
    }

    return `${importLines.join('\n')}

export const routes: Routes = [
${routes.join(',\n')}
];
`;
  },
};

export { clientRoutesGenerator };
