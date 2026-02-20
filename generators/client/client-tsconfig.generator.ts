import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary } from '@apexdesigner/generator';
import createDebug from 'debug';

const Debug = createDebug('ad3:generators:clientTsconfig');

const clientTsconfigGenerator: DesignGenerator = {
  name: 'client-tsconfig',

  triggers: [
    {
      metadataType: 'Project',
      condition: (metadata: DesignMetadata) => !isLibrary(metadata),
    },
  ],

  outputs: () => [
    'client/tsconfig.json',
    'client/tsconfig.base.json',
    'client/tsconfig.app.json',
    'client/tsconfig.spec.json',
  ],

  async generate(metadata: DesignMetadata, _context: GenerationContext): Promise<Map<string, string>> {
    const debug = Debug.extend('generate');
    debug('metadata.name %j', metadata.name);

    const files = new Map<string, string>();

    const pathAliases = {
      '@services/*': ['./src/app/services/*'],
      '@components/*': ['./src/app/components/*'],
      '@pages/*': ['./src/app/pages/*'],
      '@business-objects/*': ['./src/app/business-objects/*'],
      '@schemas/*': ['../server/src/schemas/*'],
      '@app/*': ['./src/app/*'],
    };

    // tsconfig.json - Solution style root config
    const tsconfigJson = {
      compileOnSave: false,
      files: [],
      references: [{ path: './tsconfig.app.json' }, { path: './tsconfig.spec.json' }],
    };
    files.set('client/tsconfig.json', JSON.stringify(tsconfigJson, null, 2));

    // tsconfig.base.json - Base config with shared settings
    const tsconfigBase = {
      compileOnSave: false,
      compilerOptions: {
        baseUrl: './',
        outDir: './dist/out-tsc',
        sourceMap: true,
        declaration: false,
        downlevelIteration: true,
        experimentalDecorators: true,
        module: 'ES2022',
        moduleResolution: 'node',
        importHelpers: true,
        target: 'ES2022',
        resolveJsonModule: true,
        skipLibCheck: true,
        typeRoots: ['node_modules/@types'],
        useDefineForClassFields: false,
        lib: ['ES2022', 'dom'],
        paths: pathAliases,
      },
      angularCompilerOptions: {
        enableI18nLegacyMessageIdFormat: false,
        strictInjectionParameters: true,
        strictInputAccessModifiers: true,
      },
    };
    files.set('client/tsconfig.base.json', JSON.stringify(tsconfigBase, null, 2));

    // tsconfig.app.json - Application config
    const tsconfigApp = {
      extends: './tsconfig.base.json',
      compilerOptions: {
        outDir: './dist/out-tsc',
        types: ['node'],
      },
      files: ['src/main.ts'],
      include: ['src/**/*.d.ts'],
    };
    files.set('client/tsconfig.app.json', JSON.stringify(tsconfigApp, null, 2));

    // tsconfig.spec.json - Test config
    const tsconfigSpec = {
      extends: './tsconfig.base.json',
      compilerOptions: {
        outDir: './out-tsc/spec',
        types: ['jasmine', 'node'],
      },
      include: ['src/**/*.spec.ts', 'src/**/*.d.ts'],
    };
    files.set('client/tsconfig.spec.json', JSON.stringify(tsconfigSpec, null, 2));

    return files;
  },
};

export { clientTsconfigGenerator };
