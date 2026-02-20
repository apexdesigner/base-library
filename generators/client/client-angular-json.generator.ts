import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary } from '@apexdesigner/generator';
import { getClassByBase, getObjectLiteralValue } from '@apexdesigner/utilities';
import createDebug from 'debug';

const Debug = createDebug('ad3:generators:clientAngularJson');

const clientAngularJsonGenerator: DesignGenerator = {
  name: 'client-angular-json',

  triggers: [
    {
      metadataType: 'Project',
      condition: (metadata: DesignMetadata) => !isLibrary(metadata),
    },
  ],

  outputs: () => ['client/angular.json'],

  async generate(metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');
    debug('generating angular.json');

    // Collect isCommonJs packages from clientDependencies
    const commonJsPackages: string[] = [];
    const allProjects = context.listMetadata('Project');
    for (const project of allProjects) {
      const projectClass = getClassByBase(project.sourceFile, 'Project');
      if (!projectClass) continue;

      const metadataClientDeps = (project as any).clientDependencies as Record<string, any> | undefined;
      const objectClientDeps = getObjectLiteralValue(projectClass, 'clientDependencies') as Record<string, any> | undefined;
      const clientDeps = metadataClientDeps || objectClientDeps;
      if (!clientDeps || Array.isArray(clientDeps)) continue;

      for (const [pkgName, value] of Object.entries(clientDeps)) {
        if (typeof value === 'object' && value !== null && value.isCommonJs === true) {
          commonJsPackages.push(pkgName);
        }
      }
    }
    debug('commonJsPackages %j', commonJsPackages);

    const angularConfig = {
      $schema: './node_modules/@angular/cli/lib/config/schema.json',
      version: 1,
      newProjectRoot: 'projects',
      projects: {
        angular: {
          root: '',
          sourceRoot: 'src',
          projectType: 'application',
          architect: {
            build: {
              builder: '@angular-devkit/build-angular:browser',
              options: {
                outputPath: '../server/client',
                index: 'src/index.html',
                main: 'src/main.ts',
                tsConfig: 'tsconfig.app.json',
                polyfills: ['zone.js'],
                assets: ['src/assets'],
                styles: [
                  '@angular/material/prebuilt-themes/azure-blue.css',
                  'src/styles.scss',
                ],
                scripts: [],
                ...(commonJsPackages.length > 0 && {
                  allowedCommonJsDependencies: commonJsPackages,
                }),
              },
              configurations: {
                production: {
                  optimization: true,
                  outputHashing: 'all',
                  sourceMap: false,
                  namedChunks: false,
                  aot: true,
                  extractLicenses: true,
                  vendorChunk: false,
                  buildOptimizer: true,
                },
                development: {
                  buildOptimizer: false,
                  optimization: false,
                  vendorChunk: true,
                  extractLicenses: false,
                  sourceMap: true,
                  namedChunks: true,
                },
              },
              defaultConfiguration: 'development',
            },
            serve: {
              builder: '@angular-devkit/build-angular:dev-server',
              options: {
                buildTarget: 'angular:build',
                proxyConfig: 'proxy.conf.json',
              },
              configurations: {
                production: {
                  buildTarget: 'angular:build:production',
                },
              },
            },
            test: {
              builder: '@angular-devkit/build-angular:karma',
              options: {
                main: 'src/test.ts',
                polyfills: ['zone.js'],
                tsConfig: 'tsconfig.spec.json',
                styles: ['src/styles.scss'],
                scripts: [],
                assets: ['src/assets'],
              },
            },
          },
        },
      },
    };

    return JSON.stringify(angularConfig, null, 2);
  },
};

export { clientAngularJsonGenerator };
