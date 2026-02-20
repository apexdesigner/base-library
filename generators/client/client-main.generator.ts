import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary } from '@apexdesigner/generator';
import createDebug from 'debug';

const Debug = createDebug('ad3:generators:clientMain');

const clientMainGenerator: DesignGenerator = {
  name: 'client-main',

  triggers: [
    {
      metadataType: 'Project',
      condition: (metadata: DesignMetadata) => !isLibrary(metadata),
    },
  ],

  outputs: () => ['client/src/main.ts'],

  async generate(_metadata: DesignMetadata, _context: GenerationContext) {
    const debug = Debug.extend('generate');
    debug('generating main.ts');

    return `import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
`;
  },
};

export { clientMainGenerator };
