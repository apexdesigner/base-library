import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary } from '@apexdesigner/generator';
import { getClassByBase, getObjectLiteralValue, getClassPropertyInitializer } from '@apexdesigner/utilities';
import { Node } from 'ts-morph';
import { kebabCase } from 'change-case';
import createDebug from 'debug';

const Debug = createDebug('ad3:generators:serverPackage');

function getStringPropertyValue(sourceFile: DesignMetadata['sourceFile'], propertyName: string): string | undefined {
  const cls = getClassByBase(sourceFile, 'Project');
  if (!cls) return undefined;
  const initializer = getClassPropertyInitializer(cls, propertyName);
  if (initializer && Node.isStringLiteral(initializer)) {
    return initializer.getLiteralValue();
  }
  return undefined;
}

function stripQuotes(str: string): string {
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    return str.slice(1, -1);
  }
  return str;
}

interface ServerDependency {
  versionSelector: string;
  developmentOnly?: boolean;
}

/** Extract scripts from a class property (clientScripts or serverScripts) */
function getScriptsFromClass(sourceFile: DesignMetadata['sourceFile'], propertyName: string): Record<string, string> | undefined {
  const cls = getClassByBase(sourceFile, 'Project');
  if (!cls) return undefined;

  const scriptsObj = getObjectLiteralValue(cls, propertyName) as Record<string, string> | undefined;
  if (!scriptsObj) return undefined;

  const scripts: Record<string, string> = {};
  for (const [rawKey, value] of Object.entries(scriptsObj)) {
    const key = stripQuotes(rawKey);
    if (key && typeof value === 'string') {
      scripts[key] = value;
    }
  }
  return Object.keys(scripts).length > 0 ? scripts : undefined;
}

const serverPackageGenerator: DesignGenerator = {
  name: 'server-package',
  isAggregate: true,

  triggers: [
    {
      metadataType: 'Project',
    }
  ],

  outputs: () => [
    'server/package.json'
  ],

  async generate(_metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');

    // Get all projects from context
    const allProjects = context.listMetadata('Project');
    debug('allProjects %j', allProjects.map(p => p.name));

    // Find the main project (not a library)
    const mainProject = allProjects.find(p => !isLibrary(p));
    if (!mainProject) {
      throw new Error('Project not found');
    }
    debug('mainProject.name %j', mainProject.name);

    // Get main project properties
    const packageName = getStringPropertyValue(mainProject.sourceFile, 'packageName') || kebabCase(mainProject.name);
    const version = getStringPropertyValue(mainProject.sourceFile, 'version') || '0.0.1';
    const description = getStringPropertyValue(mainProject.sourceFile, 'description');
    const displayName = getStringPropertyValue(mainProject.sourceFile, 'displayName');

    debug('packageName %j, version %j', packageName, version);

    // Initialize dependency maps and scripts
    const dependenciesMap = new Map<string, string>();
    const devDependenciesMap = new Map<string, string>();
    let overrides: Record<string, unknown> = {};
    let scripts: Record<string, string> = {};

    // Build project array: libraries first (in reverse order), main project last
    const libraryProjects = allProjects.filter(p => isLibrary(p));
    const orderedProjects = [...libraryProjects].reverse();
    orderedProjects.push(mainProject);

    debug('orderedProjects %j', orderedProjects.map(p => p.name));

    // Iterate through projects and collect dependencies
    for (const project of orderedProjects) {
      debug('Processing project: %j', project.name);

      const projectClass = getClassByBase(project.sourceFile, 'Project');
      if (!projectClass) continue;

      const serverDependencies = getObjectLiteralValue(projectClass, 'serverDependencies') as
        | Record<string, string | ServerDependency>
        | undefined;

      if (serverDependencies) {
        debug('  serverDependencies count: %j', Object.keys(serverDependencies).length);

        for (const [rawPkgName, value] of Object.entries(serverDependencies)) {
          const pkgName = stripQuotes(rawPkgName);
          if (!pkgName) continue;

          let versionSelector: string;
          let developmentOnly = false;

          if (typeof value === 'string') {
            versionSelector = value;
          } else if (typeof value === 'object' && value !== null) {
            versionSelector = value.versionSelector;
            developmentOnly = value.developmentOnly === true;
          } else {
            continue;
          }

          if (!versionSelector) continue;

          if (developmentOnly) {
            debug('  [dev] %s: %s', pkgName, versionSelector);
            devDependenciesMap.set(pkgName, versionSelector);
          } else {
            debug('  [prod] %s: %s', pkgName, versionSelector);
            dependenciesMap.set(pkgName, versionSelector);
          }
        }
      }

      // Merge serverDependencyOverrides (later projects override earlier ones)
      const serverDependencyOverrides = getObjectLiteralValue(projectClass, 'serverDependencyOverrides') as
        | Record<string, unknown>
        | undefined;

      if (serverDependencyOverrides) {
        debug('  serverDependencyOverrides: %j', serverDependencyOverrides);
        overrides = { ...overrides, ...serverDependencyOverrides };
      }

      // Merge server scripts (later projects override earlier ones)
      const serverScripts = getScriptsFromClass(project.sourceFile, 'serverScripts');
      if (serverScripts) {
        debug('  server scripts: %j', Object.keys(serverScripts));
        scripts = { ...scripts, ...serverScripts };
      }
    }

    const pkg: Record<string, unknown> = {
      name: `${packageName}-server`,
      version,
      private: true,
      type: 'module',
      main: 'dist/index.js',
      types: 'dist/index.d.ts',
    };

    if (displayName) {
      pkg.displayName = displayName;
    }

    if (description) {
      pkg.description = description;
    }

    if (Object.keys(scripts).length > 0) {
      pkg.scripts = scripts;
    }

    if (dependenciesMap.size > 0) {
      pkg.dependencies = Object.fromEntries(dependenciesMap);
    }

    if (devDependenciesMap.size > 0) {
      pkg.devDependencies = Object.fromEntries(devDependenciesMap);
    }

    if (Object.keys(overrides).length > 0) {
      pkg.overrides = overrides;
    }

    debug('dependencies count %j', dependenciesMap.size);
    debug('devDependencies count %j', devDependenciesMap.size);

    return JSON.stringify(pkg, null, 2);
  }
};

export { serverPackageGenerator };
