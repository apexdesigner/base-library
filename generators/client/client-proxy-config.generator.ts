import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary } from '@apexdesigner/generator';
import createDebug from 'debug';

const Debug = createDebug('ad3:generators:clientProxyConfig');

const clientProxyConfigGenerator: DesignGenerator = {
  name: 'client-proxy-config',

  triggers: [
    {
      metadataType: 'Project',
      condition: (metadata) => !isLibrary(metadata),
    },
  ],

  outputs: () => ['client/proxy.conf.json'],

  async generate(_metadata: DesignMetadata, _context: GenerationContext) {
    const debug = Debug.extend('generate');
    debug('generating proxy.conf.json');

    const config = {
      '/api': {
        target: 'http://localhost:3000',
        secure: false,
      },
    };

    return JSON.stringify(config, null, 2);
  },
};

export { clientProxyConfigGenerator };
