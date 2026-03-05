import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary } from '@apexdesigner/generator';
import { getBehaviorFunction, getBehaviorOptions } from '@apexdesigner/utilities';
import { kebabCase } from 'change-case';
import createDebug from 'debug';

const Debug = createDebug('BaseLibrary:generators:clientAppConfig');

const clientAppConfigGenerator: DesignGenerator = {
  name: 'client-app-config',

  triggers: [
    {
      metadataType: 'Project',
      condition: (metadata: DesignMetadata) => !isLibrary(metadata),
    },
    {
      metadataType: 'AppBehavior',
    },
  ],

  outputs: () => ['client/src/app/app.config.ts'],

  async generate(_metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');
    debug('generating app.config.ts');

    const params = context.parameterValues || {};
    debug('parameterValues', params);

    // Collect provider app behaviors
    const providers = context.listMetadata('AppBehavior').filter(behavior => {
      const options = getBehaviorOptions(behavior.sourceFile);
      return options?.type === 'Provider';
    });
    debug('providers %j', providers.length);

    // Collect interceptor app behaviors, sorted by sequence
    const interceptors = context.listMetadata('AppBehavior').filter(behavior => {
      const options = getBehaviorOptions(behavior.sourceFile);
      return options?.type === 'Interceptor';
    }).sort((a, b) => {
      const aSeq = (getBehaviorOptions(a.sourceFile)?.sequence as number) || 0;
      const bSeq = (getBehaviorOptions(b.sourceFile)?.sequence as number) || 0;
      return aSeq - bSeq;
    });
    debug('interceptors %j', interceptors.length);

    const imports: string[] = [
      `import { ApplicationConfig, inject, provideAppInitializer } from '@angular/core';`,
      `import { provideRouter } from '@angular/router';`,
    ];

    // HttpClient import — add withInterceptors if we have interceptors
    if (interceptors.length > 0) {
      imports.push(`import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';`);
    } else {
      imports.push(`import { provideHttpClient, HttpClient } from '@angular/common/http';`);
    }

    const extraProviders: string[] = [];

    // Mat form field defaults from project parameters
    const appearance = params.formFieldAppearance;
    const subscriptSizing = params.formFieldSubscriptSizing;
    const floatLabel = params.formFieldFloatLabel;
    debug('appearance', appearance);
    debug('subscriptSizing', subscriptSizing);
    debug('floatLabel', floatLabel);

    if (appearance || subscriptSizing || floatLabel) {
      imports.push(`import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';`);

      const options: string[] = [];
      if (appearance) options.push(`      appearance: '${appearance}',`);
      if (subscriptSizing) options.push(`      subscriptSizing: '${subscriptSizing}',`);
      if (floatLabel) options.push(`      floatLabel: '${floatLabel}',`);

      extraProviders.push(`    {
      provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
      useValue: {
${options.join('\n')}
      },
    },`);
    }

    // Import provider functions
    for (const provider of providers) {
      const func = getBehaviorFunction(provider.sourceFile);
      if (!func) continue;
      const fileName = kebabCase(provider.name);
      imports.push(`import { ${func.name} } from './providers/${fileName}';`);
      extraProviders.push(`    ${func.name}(),`);
    }

    // Import interceptor functions
    const interceptorNames: string[] = [];
    for (const interceptor of interceptors) {
      const func = getBehaviorFunction(interceptor.sourceFile);
      if (!func) continue;
      const fileName = kebabCase(interceptor.name);
      imports.push(`import { ${func.name} } from './interceptors/${fileName}.interceptor';`);
      interceptorNames.push(func.name);
    }

    // Build provideHttpClient line
    const httpClientLine = interceptorNames.length > 0
      ? `    provideHttpClient(withInterceptors([${interceptorNames.join(', ')}])),`
      : `    provideHttpClient(),`;

    const lines: string[] = [
      ...imports,
      ``,
      `import { BusinessObjectBase } from './business-objects/base';`,
      `import { routes } from './app.routes';`,
      ``,
      `export const appConfig: ApplicationConfig = {`,
      `  providers: [`,
      `    provideRouter(routes),`,
      httpClientLine,
      ...extraProviders,
      `    provideAppInitializer(() => {`,
      `      BusinessObjectBase.configure(inject(HttpClient));`,
      `    }),`,
      `  ],`,
      `};`,
    ];

    return lines.join('\n') + '\n';
  },
};

export { clientAppConfigGenerator };
