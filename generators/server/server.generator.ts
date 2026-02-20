import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary } from '@apexdesigner/generator';
import { getBehaviorFunction, getBehaviorOptions } from '@apexdesigner/utilities';
import { kebabCase, pascalCase, camelCase } from 'change-case';
import createDebug from 'debug';

const Debug = createDebug('ad3:generators:server');

const serverGenerator: DesignGenerator = {
  name: 'server',

  triggers: [
    {
      metadataType: 'Project',
      condition: (metadata) => !isLibrary(metadata),
    }
  ],

  outputs: () => [
    'server/src/index.ts'
  ],

  async generate(metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');
    debug('START generate for %j', metadata.name);

    const debugNamespace = pascalCase(metadata.name);

    // Find After Start lifecycle app behaviors
    const appBehaviors = context.listMetadata('AppBehavior');
    const afterStartBehaviors: { name: string; kebab: string }[] = [];

    for (const behavior of appBehaviors) {
      const options = getBehaviorOptions(behavior.sourceFile);
      if (!options) continue;
      if (options.lifecycleStage !== 'After Start') continue;

      const func = getBehaviorFunction(behavior.sourceFile);
      if (!func) continue;

      afterStartBehaviors.push({
        name: func.name,
        kebab: kebabCase(behavior.name),
      });
      debug('found After Start behavior: %j', func.name);
    }

    const lines: string[] = [];

    lines.push('import { readFileSync } from "fs";');
    lines.push('import express from "express";');
    lines.push('import createDebug from "debug";');
    lines.push('import router from "./routes/index.js";');
    lines.push('');
    lines.push('// Load .env file if present (variables already in env take precedence)');
    lines.push('try {');
    lines.push('  for (const line of readFileSync(".env", "utf-8").split("\\n")) {');
    lines.push('    const match = line.match(/^([^#][^=]*)=(.*)/);');
    lines.push('    if (match) process.env[match[1].trim()] ??= match[2].trim();');
    lines.push('  }');
    lines.push('} catch {}');

    // Import After Start app behaviors
    for (const behavior of afterStartBehaviors) {
      lines.push(`import { ${behavior.name} } from "./app-behaviors/${behavior.kebab}.js";`);
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

    // Call After Start behaviors
    for (const behavior of afterStartBehaviors) {
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
    lines.push('const shutdown = () => server.close(() => process.exit(0));');
    lines.push('process.on("SIGINT", shutdown);');
    lines.push('process.on("SIGTERM", shutdown);');

    const content = lines.join('\n');
    debug('Generated server entry point');

    return content;
  }
};

export { serverGenerator };
