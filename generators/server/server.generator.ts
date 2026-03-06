import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary } from '@apexdesigner/generator';
import { getBehaviorFunction, getBehaviorOptions, getBehaviorParent } from '@apexdesigner/utilities';
import { kebabCase, pascalCase } from 'change-case';
import createDebug from 'debug';

const Debug = createDebug('BaseLibrary:generators:server');

const serverGenerator: DesignGenerator = {
  name: 'server',

  triggers: [
    {
      metadataType: 'Project',
      condition: metadata => !isLibrary(metadata)
    },
    {
      metadataType: 'AppBehavior'
    },
    {
      metadataType: 'Behavior',
      condition: metadata => {
        const options = getBehaviorOptions(metadata.sourceFile);
        return options?.type === 'After Start';
      }
    }
  ],

  outputs: () => ['server/src/env.ts', 'server/src/index.ts'],

  async generate(metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');
    debug('START generate for %j', metadata.name);

    const projectMeta = context.listMetadata('Project').find(p => !isLibrary(p));
    const debugNamespace = pascalCase((projectMeta?.name || metadata.name).replace(/Project$/, ''));

    // Check if any data sources exist (for shutdown handler)
    const allDataSources = context.listMetadata('DataSource');
    const hasDataSources = allDataSources.length > 0;
    debug('found %d data sources', allDataSources.length);

    // Collect lifecycle and middleware app behaviors
    const appBehaviors = context.listMetadata('AppBehavior');

    interface LifecycleBehavior {
      name: string;
      kebab: string;
      sequence: number;
    }
    const startupBehaviors: LifecycleBehavior[] = [];
    const middlewareBehaviors: LifecycleBehavior[] = [];
    const runningBehaviors: LifecycleBehavior[] = [];
    const shutdownBehaviors: LifecycleBehavior[] = [];

    for (const behavior of appBehaviors) {
      const options = getBehaviorOptions(behavior.sourceFile);
      if (!options) continue;

      const func = getBehaviorFunction(behavior.sourceFile);
      if (!func) continue;

      const entry: LifecycleBehavior = {
        name: func.name,
        kebab: kebabCase(behavior.name),
        sequence: (options.sequence as number) ?? 500
      };

      if (options.type === 'Lifecycle Behavior') {
        if (options.stage === 'Startup') startupBehaviors.push(entry);
        else if (options.stage === 'Running') runningBehaviors.push(entry);
        else if (options.stage === 'Shutdown') shutdownBehaviors.push(entry);
      } else if (options.type === 'Middleware') {
        middlewareBehaviors.push(entry);
      }
    }

    // Sort by sequence
    startupBehaviors.sort((a, b) => a.sequence - b.sequence);
    middlewareBehaviors.sort((a, b) => a.sequence - b.sequence);
    runningBehaviors.sort((a, b) => a.sequence - b.sequence);
    shutdownBehaviors.sort((a, b) => a.sequence - b.sequence);

    debug(
      'startupBehaviors %j',
      startupBehaviors.map(b => b.name)
    );
    debug(
      'middlewareBehaviors %j',
      middlewareBehaviors.map(b => b.name)
    );
    debug(
      'runningBehaviors %j',
      runningBehaviors.map(b => b.name)
    );
    debug(
      'shutdownBehaviors %j',
      shutdownBehaviors.map(b => b.name)
    );

    // Find After Start lifecycle BO behaviors
    const allBehaviors = context.listMetadata('Behavior');
    const afterStartBoBehaviors: { name: string; importPath: string }[] = [];

    for (const behavior of allBehaviors) {
      const options = getBehaviorOptions(behavior.sourceFile);
      if (!options) continue;
      if (options.type !== 'After Start') continue;

      const parent = getBehaviorParent(behavior.sourceFile);
      const func = getBehaviorFunction(behavior.sourceFile);
      if (!parent || !func) continue;

      afterStartBoBehaviors.push({
        name: func.name,
        importPath: `./business-objects/${kebabCase(parent)}.${kebabCase(func.name)}.js`
      });
      debug('found After Start BO behavior: %j', func.name);
    }

    // All lifecycle/middleware behaviors for imports
    const allAppBehaviors = [...startupBehaviors, ...middlewareBehaviors, ...runningBehaviors, ...shutdownBehaviors];

    // --- env.ts ---
    const envLines: string[] = [];
    envLines.push('import { readFileSync } from "fs";');
    envLines.push('');
    envLines.push('// Load .env file if present (variables already in env take precedence)');
    envLines.push('try {');
    envLines.push('  for (const line of readFileSync(".env", "utf-8").split("\\n")) {');
    envLines.push('    const match = line.match(/^([^#][^=]*)=(.*)/);');
    envLines.push('    if (match) process.env[match[1].trim()] ??= match[2].trim();');
    envLines.push('  }');
    envLines.push('} catch {}');

    // --- index.ts ---
    const lines: string[] = [];

    lines.push('import "./env.js";');
    lines.push('import express from "express";');
    lines.push('import createDebug from "debug";');
    lines.push('import router from "./routes/index.js";');

    // Import data source for shutdown
    if (hasDataSources) {
      lines.push('import { dataSource } from "./data-sources/index.js";');
    }

    // Import app behaviors (deduplicate by name, sorted alphabetically)
    const importedBehaviors = [...allAppBehaviors].sort((a, b) => a.name.localeCompare(b.name));
    for (const behavior of importedBehaviors) {
      lines.push(`import { ${behavior.name} } from "./app-behaviors/${behavior.kebab}.js";`);
    }

    // Import After Start BO behaviors
    afterStartBoBehaviors.sort((a, b) => a.name.localeCompare(b.name));
    for (const behavior of afterStartBoBehaviors) {
      lines.push(`import { ${behavior.name} } from "${behavior.importPath}";`);
    }

    lines.push('');
    lines.push(`const debug = createDebug("${debugNamespace}:Server");`);
    lines.push('');
    lines.push('const app = express();');
    lines.push('const port = Number(process.env.PORT) || 3000;');
    lines.push('');
    lines.push('app.use(express.json());');

    // Register middleware behaviors (sorted by sequence, before routes)
    for (const behavior of middlewareBehaviors) {
      lines.push(`app.use(${behavior.name});`);
    }

    lines.push('app.use("/api", router);');
    lines.push('');

    // Startup behaviors run before listening
    for (const behavior of startupBehaviors) {
      lines.push(`await ${behavior.name}();`);
    }
    if (startupBehaviors.length > 0) {
      lines.push('');
    }

    lines.push('const server = app.listen(port);');
    lines.push('');
    lines.push('server.on("listening", async () => {');
    lines.push('  console.log("Server listening on port", port);');
    lines.push('  debug("Server listening on port %d", port);');

    // Call Running lifecycle behaviors
    for (const behavior of runningBehaviors) {
      lines.push('');
      lines.push(`  try {`);
      lines.push(`    await ${behavior.name}();`);
      lines.push(`  } catch (err) {`);
      lines.push(`    debug("Error in ${behavior.name}: %O", err);`);
      lines.push(`  }`);
    }

    // Call After Start BO behaviors
    for (const behavior of afterStartBoBehaviors) {
      lines.push('');
      lines.push(`  try {`);
      lines.push(`    await ${behavior.name}();`);
      lines.push(`  } catch (err) {`);
      lines.push(`    debug("Error in ${behavior.name}: %O", err);`);
      lines.push(`  }`);
    }

    lines.push('});');
    lines.push('');
    lines.push('server.on("error", (err) => {');
    lines.push('  console.error("Server error:", err);');
    lines.push('  process.exitCode = 1;');
    lines.push('});');
    lines.push('');
    lines.push('const shutdown = async () => {');
    // Call Shutdown lifecycle behaviors
    for (const behavior of shutdownBehaviors) {
      lines.push(`  try {`);
      lines.push(`    await ${behavior.name}();`);
      lines.push(`  } catch (err) {`);
      lines.push(`    debug("Error in ${behavior.name}: %O", err);`);
      lines.push(`  }`);
    }
    lines.push('  server.closeAllConnections();');
    if (hasDataSources) {
      lines.push('  await dataSource.close();');
    }
    lines.push('  server.close(() => process.exit(0));');
    lines.push('};');
    lines.push('process.on("SIGINT", shutdown);');
    lines.push('process.on("SIGTERM", shutdown);');

    debug('Generated server entry point');

    const outputs = new Map<string, string>();
    outputs.set('server/src/env.ts', envLines.join('\n') + '\n');
    outputs.set('server/src/index.ts', lines.join('\n') + '\n');
    return outputs;
  }
};

export { serverGenerator };
