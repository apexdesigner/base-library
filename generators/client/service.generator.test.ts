import { describe, it, expect } from 'vitest';
import { serviceGenerator } from './service.generator.js';
import { createSimpleMockWorkspace } from '@apexdesigner/generator';

function getServiceOutput(result: Map<string, string>, serviceName: string): string {
  return result.get(`client/src/app/services/${serviceName}/${serviceName}.service.ts`)!;
}

describe('serviceGenerator', () => {
  describe('basic structure', () => {
    it('should generate an @Injectable service class', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('Service', 'AuthService', {
        sourceCode: `
          import { Service } from '@apexdesigner/dsl/service';
          export class AuthService extends Service {}
        `
      });

      const metadata = workspace.context.listMetadata('Service')[0];
      const result = (await serviceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getServiceOutput(result, 'auth');

      expect(ts).toContain("@Injectable({ providedIn: 'root' })");
      expect(ts).toContain('export class AuthService');
      expect(ts).not.toContain('extends Service');
      expect(ts).toContain("from '@angular/core'");
    });

    it('should remove DSL imports', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('Service', 'AuthService', {
        sourceCode: `
          import { Service, property, method } from '@apexdesigner/dsl/service';
          export class AuthService extends Service {}
        `
      });

      const metadata = workspace.context.listMetadata('Service')[0];
      const result = (await serviceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getServiceOutput(result, 'auth');

      expect(ts).not.toContain('@apexdesigner/dsl');
    });

    it('should remove design alias imports', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('Service', 'AuthService', {
        sourceCode: `
          import { Service } from '@apexdesigner/dsl/service';
          import { AppUserFormGroup } from '@business-objects-client';
          export class AuthService extends Service {}
        `
      });

      const metadata = workspace.context.listMetadata('Service')[0];
      const result = (await serviceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getServiceOutput(result, 'auth');

      expect(ts).not.toContain('@business-objects-client');
    });
  });

  describe('output paths', () => {
    it('should output to services directory with correct name', () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('Service', 'AuthService', {
        sourceCode: `
          import { Service } from '@apexdesigner/dsl/service';
          export class AuthService extends Service {}
        `
      });

      const metadata = workspace.context.listMetadata('Service')[0];
      const outputs = serviceGenerator.outputs(metadata);

      expect(outputs).toEqual(['client/src/app/services/auth/auth.service.ts']);
    });

    it('should handle multi-word service names', () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('Service', 'UserNotificationService', {
        sourceCode: `
          import { Service } from '@apexdesigner/dsl/service';
          export class UserNotificationService extends Service {}
        `
      });

      const metadata = workspace.context.listMetadata('Service')[0];
      const outputs = serviceGenerator.outputs(metadata);

      expect(outputs).toEqual(['client/src/app/services/user-notification/user-notification.service.ts']);
    });
  });

  describe('callOnLoad', () => {
    it('should generate a constructor that calls callOnLoad methods', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('Service', 'AuthService', {
        sourceCode: `
          import { Service, method } from '@apexdesigner/dsl/service';
          export class AuthService extends Service {
            @method({ callOnLoad: true })
            async initialize(): Promise<void> {}
          }
        `
      });

      const metadata = workspace.context.listMetadata('Service')[0];
      const result = (await serviceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getServiceOutput(result, 'auth');

      expect(ts).toContain('constructor()');
      expect(ts).toContain('this.initialize()');
      expect(ts).not.toContain('@method');
    });
  });

  describe('service injection', () => {
    it('should convert service-typed properties to inject() calls', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('Service', 'AuthService', {
        sourceCode: `
          import { Service } from '@apexdesigner/dsl/service';
          import { NotificationService } from '@services';
          export class AuthService extends Service {
            notificationService!: NotificationService;
          }
        `
      });
      workspace.addMetadata('Service', 'NotificationService', {
        sourceCode: `
          import { Service } from '@apexdesigner/dsl/service';
          export class NotificationService extends Service {}
        `
      });

      const metadata = workspace.context.listMetadata('Service').find(m => m.name === 'AuthService')!;
      const result = (await serviceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getServiceOutput(result, 'auth');

      expect(ts).toContain('inject(NotificationService)');
      expect(ts).toContain('inject');
      expect(ts).toContain("from '../notification/notification.service'");
    });

    it('should inject services from multiple separate @services imports', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('Service', 'AuthService', {
        sourceCode: `
          import { Service } from '@apexdesigner/dsl/service';
          import { NotificationService } from '@services';
          import { ComponentService } from '@services';
          export class AuthService extends Service {
            notificationService!: NotificationService;
            componentService!: ComponentService;
          }
        `
      });
      workspace.addMetadata('Service', 'NotificationService', {
        sourceCode: `
          import { Service } from '@apexdesigner/dsl/service';
          export class NotificationService extends Service {}
        `
      });
      // ComponentService is NOT a Service metadata — only known via @services import

      const metadata = workspace.context.listMetadata('Service').find(m => m.name === 'AuthService')!;
      const result = (await serviceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getServiceOutput(result, 'auth');

      expect(ts).toContain('notificationService = inject(NotificationService)');
      expect(ts).toContain('componentService = inject(ComponentService)');
      expect(ts).toContain("from '../notification/notification.service'");
      expect(ts).toContain("from '../component/component.service'");
    });
  });

  describe('auto-read persisted arrays', () => {
    it('should wrap await calls in async IIFE in constructor', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('Service', 'DataService', {
        sourceCode: `
          import { Service, property } from '@apexdesigner/dsl/service';
          import { ItemPersistedArray } from '@business-objects-client';
          export class DataService extends Service {
            @property({ read: 'Automatically' })
            items!: ItemPersistedArray;
          }
        `
      });

      const metadata = workspace.context.listMetadata('Service')[0];
      const result = (await serviceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getServiceOutput(result, 'data');

      expect(ts).toContain('(async () => {');
      expect(ts).toContain('await this.items.read()');
      expect(ts).toContain('})()');
    });
  });

  describe('injectLocally', () => {
    it('should use bare @Injectable() when injectLocally is true', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('Service', 'PanelService', {
        sourceCode: `
          import { Service } from '@apexdesigner/dsl/service';
          export class PanelService extends Service {
            injectLocally = true;
          }
        `
      });

      const metadata = workspace.context.listMetadata('Service')[0];
      const result = (await serviceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getServiceOutput(result, 'panel');

      expect(ts).toContain('@Injectable()');
      expect(ts).not.toContain("providedIn: 'root'");
    });

    it('should remove injectLocally property from output', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('Service', 'PanelService', {
        sourceCode: `
          import { Service } from '@apexdesigner/dsl/service';
          export class PanelService extends Service {
            injectLocally = true;
          }
        `
      });

      const metadata = workspace.context.listMetadata('Service')[0];
      const result = (await serviceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getServiceOutput(result, 'panel');

      expect(ts).not.toContain('injectLocally');
    });

    it('should use providedIn root when injectLocally is not set', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('Service', 'AuthService', {
        sourceCode: `
          import { Service } from '@apexdesigner/dsl/service';
          export class AuthService extends Service {}
        `
      });

      const metadata = workspace.context.listMetadata('Service')[0];
      const result = (await serviceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getServiceOutput(result, 'auth');

      expect(ts).toContain("@Injectable({ providedIn: 'root' })");
    });
  });

  describe('form group properties', () => {
    it('should initialize form group properties with new instances', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('Service', 'AuthService', {
        sourceCode: `
          import { Service, property } from '@apexdesigner/dsl/service';
          import { AppUserFormGroup } from '@business-objects-client';
          export class AuthService extends Service {
            @property({ read: 'Automatically' })
            currentUser!: AppUserFormGroup;
          }
        `
      });

      const metadata = workspace.context.listMetadata('Service')[0];
      const result = (await serviceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getServiceOutput(result, 'auth');

      expect(ts).toContain('new AppUserFormGroup()');
      expect(ts).toContain("from '../../business-objects/app-user-form-group'");
    });
  });
});
