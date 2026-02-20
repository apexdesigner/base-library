import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary } from '@apexdesigner/generator';
import createDebug from 'debug';

const Debug = createDebug('ad3:generators:serverTsconfig');

const serverTsconfigGenerator: DesignGenerator = {
  name: 'server-tsconfig',

  triggers: [
    {
      metadataType: 'Project',
      condition: (metadata) => !isLibrary(metadata),
    }
  ],

  outputs: () => [
    'server/tsconfig.json'
  ],

  async generate(metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');
    debug('START generate for %j', metadata.name);

    const tsconfig = {
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        esModuleInterop: true,
        strict: true,
        skipLibCheck: true,
        outDir: './dist',
        rootDir: './src',
      },
      include: ['src/**/*.ts'],
    };

    debug('Generated server tsconfig');
    return JSON.stringify(tsconfig, null, 2);
  }
};

export { serverTsconfigGenerator };
