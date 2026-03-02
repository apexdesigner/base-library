import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary } from '@apexdesigner/generator';
import { getBehaviorFunction, getBehaviorOptions, getBehaviorParent } from '@apexdesigner/utilities';
import { kebabCase, pascalCase } from 'change-case';
import createDebug from 'debug';

const Debug = createDebug('ad3:generators:server');

const serverGenerator: DesignGenerator = {
  name: 'server',

  triggers: [
    {
      metadataType: 'Project',
      condition: (metadata) => !isLibrary(metadata),
    },
    {
      metadataType: 'Behavior',
      condition: (metadata) => {
        const options = getBehaviorOptions(metadata.sourceFile);
        return options?.type === 'After Start';
      },
    },
  ],

  outputs: () => [
    'server/src/env.ts',
    'server/src/index.ts',
  ],

  async generate(metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');
    debug('START generate for %j', metadata.name);

    const projectMeta = context.listMetadata('Project').find(p => !isLibrary(p));
    const debugNamespace = pascalCase((projectMeta?.name || metadata.name).replace(/Project$/, ''));

    // Check if any data sources exist (for shutdown handler)
    const allDataSources = context.listMetadata('DataSource');
    const hasDataSources = allDataSources.length > 0;
    debug('found %d data sources', allDataSources.length);

    // Find After Start lifecycle app behaviors
    const appBehaviors = context.listMetadata('AppBehavior');
    const afterStartBehaviors: { name: string; kebab: string }[] = [];

    for (const behavior of appBehaviors) {
      const options = getBehaviorOptions(behavior.sourceFile);
      if (!options) continue;
      if (!options.lifecycleStage) continue;

      const validStages = ['After Start'];
      if (!validStages.includes(options.lifecycleStage as string)) {
        throw new Error(`AppBehavior "${behavior.name}" has unsupported lifecycleStage "${options.lifecycleStage}" (valid values: ${validStages.join(', ')})`);
      }

      const func = getBehaviorFunction(behavior.sourceFile);
      if (!func) continue;

      afterStartBehaviors.push({
        name: func.name,
        kebab: kebabCase(behavior.name),
      });
      debug('found After Start behavior: %j', func.name);
    }

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
        importPath: `./business-objects/${kebabCase(parent)}.${kebabCase(func.name)}.js`,
      });
      debug('found After Start BO behavior: %j', func.name);
    }

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

    // Import After Start app behaviors (sorted for deterministic output)
    afterStartBehaviors.sort((a, b) => a.name.localeCompare(b.name));
    afterStartBoBehaviors.sort((a, b) => a.name.localeCompare(b.name));

    for (const behavior of afterStartBehaviors) {
      lines.push(`import { ${behavior.name} } from "./app-behaviors/${behavior.kebab}.js";`);
    }

    // Import After Start BO behaviors
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
    lines.push('app.use("/api", router);');
    lines.push('');
    lines.push('const server = app.listen(port);');
    lines.push('');
    lines.push('server.on("listening", async () => {');
    lines.push('  console.log("Server listening on port", port);');
    lines.push('  debug("Server listening on port %d", port);');

    // Call After Start behaviors (app + BO)
    for (const behavior of afterStartBehaviors) {
      lines.push('');
      lines.push(`  try {`);
      lines.push(`    await ${behavior.name}();`);
      lines.push(`  } catch (err) {`);
      lines.push(`    debug("Error in ${behavior.name}: %O", err);`);
      lines.push(`  }`);
    }

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
