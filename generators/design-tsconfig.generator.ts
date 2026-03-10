import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary } from '@apexdesigner/generator';
import createDebug from 'debug';

const Debug = createDebug('BaseLibrary:generators:designTsconfig');

/**
 * Override of the baseline design-tsconfig generator.
 * Adds the @filters path alias for typed filter imports.
 */
const designTsconfigGenerator: DesignGenerator = {
  name: 'design-tsconfig',

  triggers: [
    {
      metadataType: 'Project',
      condition: metadata => !isLibrary(metadata)
    }
  ],

  outputs: (_metadata: DesignMetadata) => {
    return ['design/tsconfig.json'];
  },

  async generate(metadata: DesignMetadata, _context: GenerationContext) {
    const debug = Debug.extend('generate');
    debug('name %j', metadata.name);

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
        typeRoots: ['./node_modules/@types', '../client/node_modules/@types', '../server/node_modules/@types', '../node_modules/@types'],
        paths: {
          '@base-types': ['./@types/base-types'],
          '@business-objects': ['./@types/business-objects'],
          '@business-objects-client': ['./@types/business-objects-client'],
          '@data-sources': ['./@types/data-sources'],
          '@external-types': ['./@types/external-types'],
          '@filters': ['../server/src/filters'],
          '@functions': ['./@types/functions'],
          '@interface-definitions': ['./@types/interface-definitions'],
          '@mixins': ['./@types/mixins'],
          '@app': ['./@types/app'],
          '@app-properties': ['./@types/app-properties'],
          '@roles': ['./@types/roles'],
          '@client': ['./client/src', '../client/src'],
          '@client/*': ['./client/src/*', '../client/src/*'],
          '@server': ['./server/src', '../server/src'],
          '@server/*': ['./server/src/*', '../server/src/*'],
          '@server-node-modules/*': ['../server/node_modules/*'],
          '@components': ['./@types/components'],
          '@pages': ['./@types/pages'],
          '@services': ['./@types/services'],
          '*': [
            './node_modules/@types/*',
            '../client/node_modules/@types/*',
            '../server/node_modules/@types/*',
            '../node_modules/@types/*',
            './node_modules/*',
            '../client/node_modules/*',
            '../server/node_modules/*',
            '../node_modules/*'
          ]
        }
      },
      include: ['**/*'],
      exclude: ['node_modules']
    };

    const result = JSON.stringify(tsconfig, null, 2);
    debug('result.length %j', result.length);
    return result;
  }
};

export { designTsconfigGenerator };
