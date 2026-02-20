import { describe, it, expect } from 'vitest';
import { clientPackageGenerator } from './client-package.generator.js';
import { createSimpleMockWorkspace } from '@apexdesigner/generator';

describe('clientPackageGenerator', () => {
  it('should generate package.json with project name and version', async () => {
    const workspace = createSimpleMockWorkspace({
      projectSourceCode: `
        import { Project } from '@apexdesigner/dsl';
        export class TestProject extends Project {
          packageName = 'test-project';
          version = '2.0.0';
        }
      `,
    });

    const metadata = workspace.context.listMetadata('Project')[0];
    const result = (await clientPackageGenerator.generate(metadata, workspace.context)) as string;
    const pkg = JSON.parse(result);

    expect(pkg.name).toBe('test-project');
    expect(pkg.version).toBe('2.0.0');
  });

  it('should fall back to kebab-case project name', async () => {
    const workspace = createSimpleMockWorkspace({
      name: 'MyTestProject',
      projectSourceCode: `
        import { Project } from '@apexdesigner/dsl';
        export class MyTestProject extends Project {
          version = '1.0.0';
        }
      `,
    });

    const metadata = workspace.context.listMetadata('Project')[0];
    const result = (await clientPackageGenerator.generate(metadata, workspace.context)) as string;
    const pkg = JSON.parse(result);

    expect(pkg.name).toBe('my-test-project');
  });

  it('should collect clientDependencies as prod deps', async () => {
    const workspace = createSimpleMockWorkspace({
      projectSourceCode: `
        import { Project } from '@apexdesigner/dsl';
        export class TestProject extends Project {
          version = '1.0.0';
          clientDependencies = {
            '@angular/core': '~19.2.0',
            rxjs: '~7.8.1',
            'zone.js': '~0.15.0',
          };
        }
      `,
    });

    const metadata = workspace.context.listMetadata('Project')[0];
    const result = (await clientPackageGenerator.generate(metadata, workspace.context)) as string;
    const pkg = JSON.parse(result);

    expect(pkg.dependencies['@angular/core']).toBe('~19.2.0');
    expect(pkg.dependencies.rxjs).toBe('~7.8.1');
    expect(pkg.dependencies['zone.js']).toBe('~0.15.0');
  });

  it('should handle developmentOnly dependencies', async () => {
    const workspace = createSimpleMockWorkspace({
      projectSourceCode: `
        import { Project } from '@apexdesigner/dsl';
        export class TestProject extends Project {
          version = '1.0.0';
          clientDependencies = {
            '@angular/core': '~19.2.0',
            '@angular/cli': { versionSelector: '~19.2.0', developmentOnly: true },
            typescript: { versionSelector: '~5.7.0', developmentOnly: true },
          };
        }
      `,
    });

    const metadata = workspace.context.listMetadata('Project')[0];
    const result = (await clientPackageGenerator.generate(metadata, workspace.context)) as string;
    const pkg = JSON.parse(result);

    expect(pkg.dependencies['@angular/core']).toBe('~19.2.0');
    expect(pkg.dependencies['@angular/cli']).toBeUndefined();
    expect(pkg.dependencies.typescript).toBeUndefined();

    expect(pkg.devDependencies['@angular/cli']).toBe('~19.2.0');
    expect(pkg.devDependencies.typescript).toBe('~5.7.0');
    expect(pkg.devDependencies['@angular/core']).toBeUndefined();
  });

  it('should collect clientDependencyOverrides', async () => {
    const workspace = createSimpleMockWorkspace({
      projectSourceCode: `
        import { Project } from '@apexdesigner/dsl';
        export class TestProject extends Project {
          version = '1.0.0';
          clientDependencyOverrides = {
            typescript: '^5.2.0',
            tslib: '^2.6.0',
          };
        }
      `,
    });

    const metadata = workspace.context.listMetadata('Project')[0];
    const result = (await clientPackageGenerator.generate(metadata, workspace.context)) as string;
    const pkg = JSON.parse(result);

    expect(pkg.overrides).toBeDefined();
    expect(pkg.overrides.typescript).toBe('^5.2.0');
    expect(pkg.overrides.tslib).toBe('^2.6.0');
  });

  it('should not include overrides when none defined', async () => {
    const workspace = createSimpleMockWorkspace({
      projectSourceCode: `
        import { Project } from '@apexdesigner/dsl';
        export class TestProject extends Project {
          version = '1.0.0';
        }
      `,
    });

    const metadata = workspace.context.listMetadata('Project')[0];
    const result = (await clientPackageGenerator.generate(metadata, workspace.context)) as string;
    const pkg = JSON.parse(result);

    expect(pkg.overrides).toBeUndefined();
  });

  it('should merge dependencies from library and main project', async () => {
    const workspace = createSimpleMockWorkspace({
      projectSourceCode: `
        import { Project } from '@apexdesigner/dsl';
        export class MainProject extends Project {
          version = '1.0.0';
          clientDependencies = {
            papaparse: '~5.4.1',
          };
        }
      `,
    });
    workspace.addMetadata('Project', 'BaseLibrary', {
      sourceCode: `
        import { Project } from '@apexdesigner/dsl';
        export class BaseLibrary extends Project {
          isLibrary = true;
          version = '1.0.0';
          clientDependencies = {
            '@angular/core': '~19.2.0',
            rxjs: '~7.8.1',
          };
        }
      `,
      libraryPackage: 'base-library',
    });

    const metadata = workspace.context.listMetadata('Project').find(p => p.name === 'MainProject')!;
    const result = (await clientPackageGenerator.generate(metadata, workspace.context)) as string;
    const pkg = JSON.parse(result);

    expect(pkg.dependencies['@angular/core']).toBe('~19.2.0');
    expect(pkg.dependencies.rxjs).toBe('~7.8.1');
    expect(pkg.dependencies.papaparse).toBe('~5.4.1');
  });

  it('should let main project override library dependency versions', async () => {
    const workspace = createSimpleMockWorkspace({
      projectSourceCode: `
        import { Project } from '@apexdesigner/dsl';
        export class MainProject extends Project {
          version = '1.0.0';
          clientDependencies = {
            '@angular/core': '~19.2.0',
          };
        }
      `,
    });
    workspace.addMetadata('Project', 'BaseLibrary', {
      sourceCode: `
        import { Project } from '@apexdesigner/dsl';
        export class BaseLibrary extends Project {
          isLibrary = true;
          version = '1.0.0';
          clientDependencies = {
            '@angular/core': '~19.1.0',
          };
        }
      `,
      libraryPackage: 'base-library',
    });

    const metadata = workspace.context.listMetadata('Project').find(p => p.name === 'MainProject')!;
    const result = (await clientPackageGenerator.generate(metadata, workspace.context)) as string;
    const pkg = JSON.parse(result);

    expect(pkg.dependencies['@angular/core']).toBe('~19.2.0');
  });

  it('should merge overrides from library projects', async () => {
    const workspace = createSimpleMockWorkspace({
      projectSourceCode: `
        import { Project } from '@apexdesigner/dsl';
        export class MainProject extends Project {
          version = '1.0.0';
        }
      `,
    });
    workspace.addMetadata('Project', 'BaseLibrary', {
      sourceCode: `
        import { Project } from '@apexdesigner/dsl';
        export class BaseLibrary extends Project {
          isLibrary = true;
          version = '1.0.0';
          clientDependencyOverrides = {
            tar: '^7.5.7',
          };
        }
      `,
      libraryPackage: 'base-library',
    });

    const metadata = workspace.context.listMetadata('Project').find(p => p.name === 'MainProject')!;
    const result = (await clientPackageGenerator.generate(metadata, workspace.context)) as string;
    const pkg = JSON.parse(result);

    expect(pkg.overrides).toBeDefined();
    expect(pkg.overrides.tar).toBe('^7.5.7');
  });

  it('should handle old JSON array format for clientDependencies', async () => {
    const workspace = createSimpleMockWorkspace({
      projectSourceCode: `
        import { Project } from '@apexdesigner/dsl';
        export class MainProject extends Project {
          version = '1.0.0';
          clientDependencies = {
            papaparse: '~5.4.1',
          };
        }
      `,
    });
    workspace.addMetadata('Project', 'LibraryProject', {
      sourceCode: `
        import { Project } from '@apexdesigner/dsl';
        export class LibraryProject extends Project {
          isLibrary = true;
          version = '1.0.0';
          clientDependencies = [
            { package: '@angular/core', versionSelector: '~19.2.0' },
            { package: 'rxjs', versionSelector: '~7.8.1' },
            { package: 'typescript', versionSelector: '~5.7.0', developmentOnly: true },
          ];
        }
      `,
      libraryPackage: 'library',
    });

    const metadata = workspace.context.listMetadata('Project').find(p => p.name === 'MainProject')!;
    const result = (await clientPackageGenerator.generate(metadata, workspace.context)) as string;
    const pkg = JSON.parse(result);

    expect(pkg.dependencies['@angular/core']).toBe('~19.2.0');
    expect(pkg.dependencies.rxjs).toBe('~7.8.1');
    expect(pkg.dependencies.papaparse).toBe('~5.4.1');
    expect(pkg.devDependencies.typescript).toBe('~5.7.0');
  });

  it('should include displayName and description when present', async () => {
    const workspace = createSimpleMockWorkspace({
      projectSourceCode: `
        import { Project } from '@apexdesigner/dsl';
        export class TestProject extends Project {
          packageName = 'test-project';
          version = '1.0.0';
          displayName = 'Test Project';
          description = 'A test project';
        }
      `,
    });

    const metadata = workspace.context.listMetadata('Project')[0];
    const result = (await clientPackageGenerator.generate(metadata, workspace.context)) as string;
    const pkg = JSON.parse(result);

    expect(pkg.displayName).toBe('Test Project');
    expect(pkg.description).toBe('A test project');
  });

  it('should include client scripts from clientScripts property', async () => {
    const workspace = createSimpleMockWorkspace({
      projectSourceCode: `
        import { Project } from '@apexdesigner/dsl';
        export class TestProject extends Project {
          version = '1.0.0';
          clientScripts = {
            ng: 'ng',
            start: 'ng serve',
            build: 'ng build',
          };
        }
      `,
    });

    const metadata = workspace.context.listMetadata('Project')[0];
    const result = (await clientPackageGenerator.generate(metadata, workspace.context)) as string;
    const pkg = JSON.parse(result);

    expect(pkg.scripts).toBeDefined();
    expect(pkg.scripts.ng).toBe('ng');
    expect(pkg.scripts.start).toBe('ng serve');
    expect(pkg.scripts.build).toBe('ng build');
  });

  it('should not include serverScripts in client package', async () => {
    const workspace = createSimpleMockWorkspace({
      projectSourceCode: `
        import { Project } from '@apexdesigner/dsl';
        export class TestProject extends Project {
          version = '1.0.0';
          serverScripts = {
            build: 'tsc',
            start: 'node dist/index.js',
          };
        }
      `,
    });

    const metadata = workspace.context.listMetadata('Project')[0];
    const result = (await clientPackageGenerator.generate(metadata, workspace.context)) as string;
    const pkg = JSON.parse(result);

    expect(pkg.scripts).toBeUndefined();
  });

  it('should merge clientScripts from library and main project', async () => {
    const workspace = createSimpleMockWorkspace({
      projectSourceCode: `
        import { Project } from '@apexdesigner/dsl';
        export class MainProject extends Project {
          version = '1.0.0';
          clientScripts = {
            start: 'ng serve --port 4300',
            lint: 'eslint .',
          };
        }
      `,
    });
    workspace.addMetadata('Project', 'BaseLibrary', {
      sourceCode: `
        import { Project } from '@apexdesigner/dsl';
        export class BaseLibrary extends Project {
          isLibrary = true;
          version = '1.0.0';
          clientScripts = {
            ng: 'ng',
            start: 'ng serve',
            build: 'ng build',
          };
        }
      `,
      libraryPackage: 'base-library',
    });

    const metadata = workspace.context.listMetadata('Project').find(p => p.name === 'MainProject')!;
    const result = (await clientPackageGenerator.generate(metadata, workspace.context)) as string;
    const pkg = JSON.parse(result);

    expect(pkg.scripts.ng).toBe('ng');
    expect(pkg.scripts.build).toBe('ng build');
    expect(pkg.scripts.start).toBe('ng serve --port 4300');
    expect(pkg.scripts.lint).toBe('eslint .');
  });

  it('should not include scripts when none defined', async () => {
    const workspace = createSimpleMockWorkspace({
      projectSourceCode: `
        import { Project } from '@apexdesigner/dsl';
        export class TestProject extends Project {
          version = '1.0.0';
        }
      `,
    });

    const metadata = workspace.context.listMetadata('Project')[0];
    const result = (await clientPackageGenerator.generate(metadata, workspace.context)) as string;
    const pkg = JSON.parse(result);

    expect(pkg.scripts).toBeUndefined();
  });

  it('should have correct output path', () => {
    const outputs = clientPackageGenerator.outputs({} as any, 'Project');
    expect(outputs).toEqual(['client/package.json']);
  });

  it('should be an aggregate generator', () => {
    expect(clientPackageGenerator.isAggregate).toBe(true);
  });
});
