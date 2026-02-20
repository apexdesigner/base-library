import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary } from '@apexdesigner/generator';
import createDebug from 'debug';

const Debug = createDebug('ad3:generators:clientAppConfig');

const clientAppConfigGenerator: DesignGenerator = {
  name: 'client-app-config',

  triggers: [
    {
      metadataType: 'Project',
      condition: (metadata: DesignMetadata) => !isLibrary(metadata),
    },
  ],

  outputs: () => ['client/src/app/app.config.ts'],

  async generate(_metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');
    debug('generating app.config.ts');

    const params = context.parameterValues || {};
    debug('parameterValues', params);

    const imports: string[] = [
      `import { APP_INITIALIZER, ApplicationConfig, inject } from '@angular/core';`,
      `import { provideRouter } from '@angular/router';`,
      `import { provideHttpClient, HttpClient } from '@angular/common/http';`,
    ];

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

    const lines: string[] = [
      ...imports,
      ``,
      `import { BusinessObjectBase } from './business-objects/base';`,
      `import { routes } from './app.routes';`,
      ``,
      `export const appConfig: ApplicationConfig = {`,
      `  providers: [`,
      `    provideRouter(routes),`,
      `    provideHttpClient(),`,
      ...extraProviders,
      `    {`,
      `      provide: APP_INITIALIZER,`,
      `      useFactory: () => {`,
      `        BusinessObjectBase.configure(inject(HttpClient));`,
      `        return () => {};`,
      `      },`,
      `      multi: true,`,
      `    },`,
      `  ],`,
      `};`,
    ];

    return lines.join('\n') + '\n';
  },
};

export { clientAppConfigGenerator };
