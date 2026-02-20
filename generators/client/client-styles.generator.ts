import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary } from '@apexdesigner/generator';
import { getModuleLevelCall, getTemplateString } from '@apexdesigner/utilities';
import createDebug from 'debug';

const Debug = createDebug('ad3:generators:clientStyles');

const clientStylesGenerator: DesignGenerator = {
  name: 'client-styles',
  isAggregate: true,

  triggers: [
    {
      metadataType: 'Project',
      condition: (metadata: DesignMetadata) => !isLibrary(metadata),
    },
  ],

  outputs: () => ['client/src/styles.scss'],

  async generate(_metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');
    debug('generating styles.scss');

    const allProjects = context.listMetadata('Project');

    // Libraries first (in order), then the main project
    const libraryProjects = allProjects.filter(p => isLibrary(p));
    const mainProject = allProjects.find(p => !isLibrary(p));

    const orderedProjects = [...libraryProjects];
    if (mainProject) {
      orderedProjects.push(mainProject);
    }

    const styleParts: string[] = [];

    for (const project of orderedProjects) {
      const applyStylesCall = getModuleLevelCall(project.sourceFile, 'applyStyles');
      if (applyStylesCall) {
        const styles = getTemplateString(applyStylesCall) || '';
        if (styles.trim()) {
          debug('styles from %s (%d chars)', project.name, styles.length);
          styleParts.push(`/* Styles from ${project.name} */\n${styles.trim()}`);
        }
      }
    }

    if (styleParts.length === 0) {
      return `/* Global application styles */\n`;
    }

    return styleParts.join('\n\n') + '\n';
  },
};

export { clientStylesGenerator };
