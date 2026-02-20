import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary } from '@apexdesigner/generator';
import { getClassByBase, getObjectLiteralValue, getArrayLiteralValue, getClassPropertyInitializer } from '@apexdesigner/utilities';
import { Node } from 'ts-morph';
import { kebabCase } from 'change-case';
import createDebug from 'debug';

const Debug = createDebug('ad3:generators:clientPackage');

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

interface ClientDependencyValue {
  versionSelector: string;
  developmentOnly?: boolean;
}

// Old JSON format (from compiled npm packages)
interface ClientDependencyItem {
  package: string;
  versionSelector: string;
  developmentOnly?: boolean;
}

type ClientDependencies = Record<string, string | ClientDependencyValue>;
type ClientDependenciesValue = ClientDependencies | ClientDependencyItem[];

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

const clientPackageGenerator: DesignGenerator = {
  name: 'client-package',
  isAggregate: true,

  triggers: [
    {
      metadataType: 'Project',
    }
  ],

  outputs: () => [
    'client/package.json'
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

      // Try multiple ways to get clientDependencies:
      // 1. From metadata object directly (compiled JSON from npm packages)
      // 2. From array literal in source (old TS array format)
      // 3. From object literal in source (new TS object format)
      const metadataClientDeps = (project as any).clientDependencies as ClientDependenciesValue | undefined;
      const arrayClientDeps = getArrayLiteralValue(projectClass, 'clientDependencies') as
        | ClientDependencyItem[]
        | undefined;
      const objectClientDeps = getObjectLiteralValue(projectClass, 'clientDependencies') as
        | ClientDependencies
        | undefined;

      const rawClientDeps = metadataClientDeps || arrayClientDeps || objectClientDeps;

      if (rawClientDeps) {
        if (Array.isArray(rawClientDeps)) {
          // Old format: array of { package, versionSelector, developmentOnly }
          debug('  clientDependencies (array format) length %j', rawClientDeps.length);
          for (const dep of rawClientDeps) {
            const developmentOnly = dep.developmentOnly ?? false;
            if (developmentOnly) {
              debug('  [dev] %s: %s', dep.package, dep.versionSelector);
              devDependenciesMap.set(dep.package, dep.versionSelector);
            } else {
              debug('  [prod] %s: %s', dep.package, dep.versionSelector);
              dependenciesMap.set(dep.package, dep.versionSelector);
            }
          }
        } else {
          // New format: object { packageName: "version" | { versionSelector, developmentOnly } }
          debug('  clientDependencies (object format) count: %j', Object.keys(rawClientDeps).length);
          for (const [rawPkgName, value] of Object.entries(rawClientDeps)) {
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
      }

      // Merge clientDependencyOverrides (later projects override earlier ones)
      const metadataOverrides = (project as any).clientDependencyOverrides as Record<string, unknown> | undefined;
      const sourceOverrides = getObjectLiteralValue(projectClass, 'clientDependencyOverrides') as
        | Record<string, unknown>
        | undefined;
      const clientOverrides = metadataOverrides || sourceOverrides;

      if (clientOverrides) {
        for (const [rawPkg, ver] of Object.entries(clientOverrides)) {
          const pkg = stripQuotes(rawPkg);
          debug('  override %s: %j', pkg, ver);
          overrides[pkg] = ver;
        }
      }

      // Merge client scripts (later projects override earlier ones)
      const clientScripts = getScriptsFromClass(project.sourceFile, 'clientScripts');
      if (clientScripts) {
        debug('  client scripts: %j', Object.keys(clientScripts));
        scripts = { ...scripts, ...clientScripts };
      }
    }

    const pkg: Record<string, unknown> = {
      name: packageName,
      version,
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

export { clientPackageGenerator };
