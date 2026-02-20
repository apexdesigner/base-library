import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary } from '@apexdesigner/generator';
import { getClassByBase, getClassPropertyInitializer } from '@apexdesigner/utilities';
import { Node } from 'ts-morph';
import createDebug from 'debug';

const Debug = createDebug('ad3:generators:clientIndexHtml');

const clientIndexHtmlGenerator: DesignGenerator = {
  name: 'client-index-html',

  triggers: [
    {
      metadataType: 'Project',
      condition: (metadata) => !isLibrary(metadata),
    },
  ],

  outputs: () => ['client/src/index.html'],

  async generate(_metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');

    const allProjects = context.listMetadata('Project');
    const project = allProjects.find(p => !isLibrary(p));
    if (!project) {
      throw new Error('Main project not found');
    }

    const projectClass = getClassByBase(project.sourceFile, 'Project')!;

    const displayNameExpr = getClassPropertyInitializer(projectClass, 'displayName');
    const displayName = displayNameExpr && Node.isStringLiteral(displayNameExpr)
      ? displayNameExpr.getLiteralValue()
      : undefined;

    const title = displayName || project.name;
    const params = context.parameterValues || {};
    const favicon = params.favicon || 'favicon.ico';
    debug('title %j, favicon %j', title, favicon);

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>${title}</title>
    <base href="/">
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" type="image/x-icon" href="assets/${favicon}">
  </head>
  <body>
    <app-root></app-root>
  </body>
</html>`;
  },
};

export { clientIndexHtmlGenerator };
