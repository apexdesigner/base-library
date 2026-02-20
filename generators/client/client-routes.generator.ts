import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary } from '@apexdesigner/generator';
import { getClassByBase, getClassDecorator, getClassPropertyInitializer } from '@apexdesigner/utilities';
import { Node } from 'ts-morph';
import { kebabCase } from 'change-case';
import createDebug from 'debug';

const Debug = createDebug('ad3:generators:clientRoutes');

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
      metadataType: 'Project',
      condition: (metadata) => !isLibrary(metadata),
    },
  ],

  outputs: () => ['client/src/app/app.routes.ts'],

  async generate(_metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');

    // Get all pages
    const allPages = context.listMetadata('Page');
    debug('allPages.length %j', allPages.length);

    // Extract page info from decorators
    const pageInfos = allPages
      .map(page => {
        const pageClass = getClassByBase(page.sourceFile, 'Page');
        if (!pageClass) return null;

        const pageOptions = getClassDecorator(pageClass, 'page');
        const path = pageOptions?.path as string | undefined;
        return { name: page.name, path };
      })
      .filter((page): page is { name: string; path: string } => !!page?.path);

    debug('pageInfos %j', pageInfos.map(p => ({ name: p.name, path: p.path })));

    // Sort by path specificity (more segments first, alphabetical tiebreak)
    const sortedPages = [...pageInfos].sort((a, b) => {
      const aSegments = a.path.split('/').filter(Boolean).length;
      const bSegments = b.path.split('/').filter(Boolean).length;
      if (aSegments !== bSegments) return bSegments - aSegments;
      return a.path.localeCompare(b.path);
    });

    // Find default page from project
    const projects = context.listMetadata('Project');
    const project = projects.find(p => !isLibrary(p));

    let defaultPagePath: string | null = null;
    if (project) {
      const projectClass = getClassByBase(project.sourceFile, 'Project');
      if (projectClass) {
        const defaultPageExpr = getClassPropertyInitializer(projectClass, 'defaultPage');
        if (defaultPageExpr) {
          const defaultPageName = defaultPageExpr.getText();
          const defaultPage = pageInfos.find(p => p.name === defaultPageName || p.name === `${defaultPageName}Page`);
          if (defaultPage) {
            defaultPagePath = defaultPage.path;
            debug('defaultPagePath %j', defaultPagePath);
          }
        }
      }
    }

    // Strip leading slash and convert dotted params (:supplier.id → :supplierId)
    const processPath = (path: string) => path.replace(/^\//, '').replace(/:(\w+)\.(\w+)/g, (_match, prop, field) => `:${prop}${field.charAt(0).toUpperCase()}${field.slice(1)}`);

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

      routes.push(`  {
    path: '${path}',
    loadComponent: () => import('./pages/${dirName}/${dirName}.page').then(c => c.${className}),
    pathMatch: 'full'
  }`);
    }

    return `import { Routes } from '@angular/router';

export const routes: Routes = [
${routes.join(',\n')}
];
`;
  },
};

export { clientRoutesGenerator };
