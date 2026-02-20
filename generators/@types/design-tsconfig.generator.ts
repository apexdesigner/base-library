import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary } from '@apexdesigner/generator';
import createDebug from 'debug';

const Debug = createDebug('ad3:generators:designTsconfig');

const designTsconfigGenerator: DesignGenerator = {
  name: 'design-tsconfig',

  triggers: [
    {
      metadataType: 'Project',
      condition: (metadata) => !isLibrary(metadata),
    },
  ],

  outputs: () => ['design/tsconfig.json'],

  async generate(metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');
    debug('metadata.name %j', metadata.name);

    const tsconfig = {
      compilerOptions: {
        target: 'ES2022',
        lib: ['ES2022', 'DOM'],
        module: 'ESNext',
        moduleResolution: 'bundler',
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
        noEmit: true,
        esModuleInterop: true,
        forceConsistentCasingInFileNames: true,
        strict: true,
        skipLibCheck: true,
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        useDefineForClassFields: false,
        baseUrl: '.',
        typeRoots: [
          './node_modules/@types',
          '../client/node_modules/@types',
          '../server/node_modules/@types',
          '../node_modules/@types',
        ],
        paths: {
          '@base-types': ['./@types/base-types'],
          '@business-objects': ['./@types/business-objects'],
          '@business-objects-client': ['./@types/business-objects-client'],
          '@data-sources': ['./@types/data-sources'],
          '@external-types': ['./@types/external-types'],
          '@interface-definitions': ['./@types/interface-definitions'],
          '@mixins': ['./@types/mixins'],
          '@project': ['./@types/app'],
          '@roles': ['./@types/roles'],
          '@components': ['./@types/components'],
          '@pages': ['./@types/pages'],
          '@schemas/*': ['../server/src/schemas/*'],
          '@services': ['./@types/user-interface-services'],
          '*': [
            '../client/node_modules/@types/*',
            '../server/node_modules/@types/*',
            '../client/node_modules/*',
            '../server/node_modules/*',
          ],
        },
      },
      include: ['**/*'],
      exclude: ['node_modules'],
    };

    debug('Generated design tsconfig');
    return JSON.stringify(tsconfig, null, 2);
  },
};

export { designTsconfigGenerator };
