import { describe, it, expect } from 'vitest';
import { serverPackageGenerator } from './server-package.generator.js';
import { createSimpleMockWorkspace } from '@apexdesigner/generator';

describe('serverPackageGenerator', () => {
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
    const result = (await serverPackageGenerator.generate(metadata, workspace.context)) as string;
    const pkg = JSON.parse(result);

    expect(pkg.name).toBe('test-project-server');
    expect(pkg.version).toBe('2.0.0');
    expect(pkg.private).toBe(true);
    expect(pkg.type).toBe('module');
    expect(pkg.main).toBe('dist/index.js');
    expect(pkg.types).toBe('dist/index.d.ts');
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
    const result = (await serverPackageGenerator.generate(metadata, workspace.context)) as string;
    const pkg = JSON.parse(result);

    expect(pkg.name).toBe('my-test-project-server');
  });

  it('should collect serverDependencies as prod deps', async () => {
    const workspace = createSimpleMockWorkspace({
      projectSourceCode: `
        import { Project } from '@apexdesigner/dsl';
        export class TestProject extends Project {
          version = '1.0.0';
          serverDependencies = {
            express: '^5.1.0',
            debug: '^4.4.3',
          };
        }
      `,
    });

    const metadata = workspace.context.listMetadata('Project')[0];
    const result = (await serverPackageGenerator.generate(metadata, workspace.context)) as string;
    const pkg = JSON.parse(result);

    expect(pkg.dependencies.express).toBe('^5.1.0');
    expect(pkg.dependencies.debug).toBe('^4.4.3');
  });

  it('should handle developmentOnly dependencies', async () => {
    const workspace = createSimpleMockWorkspace({
      projectSourceCode: `
        import { Project } from '@apexdesigner/dsl';
        export class TestProject extends Project {
          version = '1.0.0';
          serverDependencies = {
            express: '^5.1.0',
            '@types/express': { versionSelector: '^5.0.3', developmentOnly: true },
          };
        }
      `,
    });

    const metadata = workspace.context.listMetadata('Project')[0];
    const result = (await serverPackageGenerator.generate(metadata, workspace.context)) as string;
    const pkg = JSON.parse(result);

    expect(pkg.dependencies.express).toBe('^5.1.0');
    expect(pkg.dependencies['@types/express']).toBeUndefined();
    expect(pkg.devDependencies['@types/express']).toBe('^5.0.3');
    expect(pkg.devDependencies.express).toBeUndefined();
  });

  it('should collect serverDependencyOverrides', async () => {
    const workspace = createSimpleMockWorkspace({
      projectSourceCode: `
        import { Project } from '@apexdesigner/dsl';
        export class TestProject extends Project {
          version = '1.0.0';
          serverDependencyOverrides = {
            uuid: '^8.3.2',
          };
        }
      `,
    });

    const metadata = workspace.context.listMetadata('Project')[0];
    const result = (await serverPackageGenerator.generate(metadata, workspace.context)) as string;
    const pkg = JSON.parse(result);

    expect(pkg.overrides).toBeDefined();
    expect(pkg.overrides.uuid).toBe('^8.3.2');
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
    const result = (await serverPackageGenerator.generate(metadata, workspace.context)) as string;
    const pkg = JSON.parse(result);

    expect(pkg.overrides).toBeUndefined();
  });

  it('should merge dependencies from library and main project', async () => {
    const workspace = createSimpleMockWorkspace({
      projectSourceCode: `
        import { Project } from '@apexdesigner/dsl';
        export class MainProject extends Project {
          version = '1.0.0';
          serverDependencies = {
            express: '^5.1.0',
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
          serverDependencies = {
            debug: '^4.4.3',
            zod: '^4.1.0',
          };
        }
      `,
      libraryPackage: 'base-library',
    });

    const metadata = workspace.context.listMetadata('Project').find(p => p.name === 'MainProject')!;
    const result = (await serverPackageGenerator.generate(metadata, workspace.context)) as string;
    const pkg = JSON.parse(result);

    expect(pkg.dependencies.debug).toBe('^4.4.3');
    expect(pkg.dependencies.zod).toBe('^4.1.0');
    expect(pkg.dependencies.express).toBe('^5.1.0');
  });

  it('should let main project override library dependency versions', async () => {
    const workspace = createSimpleMockWorkspace({
      projectSourceCode: `
        import { Project } from '@apexdesigner/dsl';
        export class MainProject extends Project {
          version = '1.0.0';
          serverDependencies = {
            debug: '^4.4.3',
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
          serverDependencies = {
            debug: '^4.3.0',
          };
        }
      `,
      libraryPackage: 'base-library',
    });

    const metadata = workspace.context.listMetadata('Project').find(p => p.name === 'MainProject')!;
    const result = (await serverPackageGenerator.generate(metadata, workspace.context)) as string;
    const pkg = JSON.parse(result);

    // Main project's version should win
    expect(pkg.dependencies.debug).toBe('^4.4.3');
  });

  it('should include server scripts from serverScripts property', async () => {
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
    const result = (await serverPackageGenerator.generate(metadata, workspace.context)) as string;
    const pkg = JSON.parse(result);

    expect(pkg.scripts).toBeDefined();
    expect(pkg.scripts.build).toBe('tsc');
    expect(pkg.scripts.start).toBe('node dist/index.js');
  });

  it('should not include clientScripts in server package', async () => {
    const workspace = createSimpleMockWorkspace({
      projectSourceCode: `
        import { Project } from '@apexdesigner/dsl';
        export class TestProject extends Project {
          version = '1.0.0';
          clientScripts = {
            ng: 'ng',
            start: 'ng serve',
          };
        }
      `,
    });

    const metadata = workspace.context.listMetadata('Project')[0];
    const result = (await serverPackageGenerator.generate(metadata, workspace.context)) as string;
    const pkg = JSON.parse(result);

    expect(pkg.scripts).toBeUndefined();
  });

  it('should merge serverScripts from library and main project', async () => {
    const workspace = createSimpleMockWorkspace({
      projectSourceCode: `
        import { Project } from '@apexdesigner/dsl';
        export class MainProject extends Project {
          version = '1.0.0';
          serverScripts = {
            start: 'node --inspect dist/index.js',
            migrate: 'node dist/migrate.js',
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
          serverScripts = {
            build: 'tsc',
            start: 'node dist/index.js',
          };
        }
      `,
      libraryPackage: 'base-library',
    });

    const metadata = workspace.context.listMetadata('Project').find(p => p.name === 'MainProject')!;
    const result = (await serverPackageGenerator.generate(metadata, workspace.context)) as string;
    const pkg = JSON.parse(result);

    expect(pkg.scripts.build).toBe('tsc');
    expect(pkg.scripts.start).toBe('node --inspect dist/index.js');
    expect(pkg.scripts.migrate).toBe('node dist/migrate.js');
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
    const result = (await serverPackageGenerator.generate(metadata, workspace.context)) as string;
    const pkg = JSON.parse(result);

    expect(pkg.scripts).toBeUndefined();
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
    const result = (await serverPackageGenerator.generate(metadata, workspace.context)) as string;
    const pkg = JSON.parse(result);

    expect(pkg.displayName).toBe('Test Project');
    expect(pkg.description).toBe('A test project');
  });

  it('should have correct output path', () => {
    const outputs = serverPackageGenerator.outputs({} as any, 'Project');
    expect(outputs).toEqual(['server/package.json']);
  });

  it('should be an aggregate generator', () => {
    expect(serverPackageGenerator.isAggregate).toBe(true);
  });
});
