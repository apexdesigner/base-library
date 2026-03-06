import { describe, it, expect } from 'vitest';
import { businessObjectRouteGenerator } from './business-object-route.generator.js';
import { createSimpleMockWorkspace } from '@apexdesigner/generator';

describe('businessObjectRouteGenerator', () => {
  describe('triggers', () => {
    it('should have a Behavior trigger so output regenerates when behaviors change', () => {
      const behaviorTrigger = businessObjectRouteGenerator.triggers.find(t => t.metadataType === 'Behavior');
      expect(behaviorTrigger).toBeDefined();
    });
  });

  describe('outputs', () => {
    it('should resolve behavior metadata to parent BO route file', () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'ProcessDesign', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class ProcessDesign extends BusinessObject {}
        `
      });
      workspace.addMetadata('Behavior', 'ProcessDesignUpload', {
        sourceCode: `
          import { addBehavior } from '@apexdesigner/dsl';
          import { ProcessDesign } from '@business-objects';
          addBehavior(
            ProcessDesign,
            { type: 'Class', httpMethod: 'Post' },
            async function upload(options: any) {}
          );
        `
      });

      const behaviorMeta = workspace.context.listMetadata('Behavior')[0];
      const outputs = businessObjectRouteGenerator.outputs(behaviorMeta);

      expect(outputs).toEqual(['server/src/routes/process-designs.ts']);
    });
  });

  describe('id coercion from req.params.id', () => {
    it('should use Number() to parse id for number id BO', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'Order', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class Order extends BusinessObject {
            id!: number;
          }
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = (await businessObjectRouteGenerator.generate(metadata, workspace.context)) as string;

      expect(result).not.toContain('String(req.params.id)');
      expect(result).toContain('Number(req.params.id)');
    });

    it('should not pass req.body to behaviors with no parameters', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'ProcessInstance', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class ProcessInstance extends BusinessObject {
            id!: string;
          }
        `
      });
      workspace.addMetadata('Behavior', 'ProcessInstancePause', {
        sourceCode: `
          import { addBehavior } from '@apexdesigner/dsl';
          import { ProcessInstance } from '@business-objects';
          addBehavior(
            ProcessInstance,
            { type: 'Instance', httpMethod: 'Post' },
            async function pause(processInstance: ProcessInstance) {
              debug("pausing");
            }
          );
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = (await businessObjectRouteGenerator.generate(metadata, workspace.context)) as string;

      // Should call pause() with no args, not pause(req.body)
      expect(result).toContain('.pause()');
      expect(result).not.toContain('.pause(req.body)');
    });

    it('should use String() to coerce id for string id BO', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'ProcessDesign', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          type Uuid = string;
          export class ProcessDesign extends BusinessObject {
            id!: Uuid;
          }
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = (await businessObjectRouteGenerator.generate(metadata, workspace.context)) as string;

      expect(result).not.toContain('Number(req.params.id)');
      expect(result).toContain('String(req.params.id)');
    });
  });

  describe('role enforcement', () => {
    it('should add hasRole check for CRUD routes when applyDefaultRoles is set', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'User', {
        sourceCode: `
          import { BusinessObject, applyDefaultRoles } from '@apexdesigner/dsl';
          import { Administrator } from '@roles';
          export class User extends BusinessObject {
            id!: number;
            email!: string;
          }
          applyDefaultRoles(User, [Administrator]);
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = (await businessObjectRouteGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('import { missingRole } from "./missing-role.js"');
      expect(result).toContain('if (missingRole(res, "Administrator")) return;');
    });

    it('should not add hasRole check when no default roles are set', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'Order', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class Order extends BusinessObject {
            id!: number;
          }
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = (await businessObjectRouteGenerator.generate(metadata, workspace.context)) as string;

      expect(result).not.toContain('missingRole');
    });

    it('should use behavior-level roles instead of default roles when specified', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'User', {
        sourceCode: `
          import { BusinessObject, applyDefaultRoles } from '@apexdesigner/dsl';
          import { Administrator } from '@roles';
          export class User extends BusinessObject {
            id!: number;
          }
          applyDefaultRoles(User, [Administrator]);
        `
      });
      workspace.addMetadata('Behavior', 'UserCurrentUser', {
        sourceCode: `
          import { addBehavior } from '@apexdesigner/dsl';
          import { User } from '@business-objects';
          import { Authenticated } from '@roles';
          addBehavior(
            User,
            { type: 'Class', httpMethod: 'Get', roles: [Authenticated] },
            async function currentUser() { return null; }
          );
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = (await businessObjectRouteGenerator.generate(metadata, workspace.context)) as string;

      // currentUser route should not have missingRole check (Authenticated = any logged-in user)
      const currentUserRoute = result.split('current-user')[1]?.split('router.')[0] || '';
      expect(currentUserRoute).not.toContain('missingRole');

      // CRUD routes should still have Administrator check
      expect(result).toContain('if (missingRole(res, "Administrator")) return;');
    });

    it('should check multiple roles with OR logic', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'Report', {
        sourceCode: `
          import { BusinessObject, applyDefaultRoles } from '@apexdesigner/dsl';
          import { Administrator, Editor } from '@roles';
          export class Report extends BusinessObject {
            id!: number;
          }
          applyDefaultRoles(Report, [Administrator, Editor]);
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = (await businessObjectRouteGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('if (missingRole(res, "Administrator", "Editor")) return;');
    });
  });

  it('should unwrap scalar parameters from req.body for instance behaviors', async () => {
    const workspace = createSimpleMockWorkspace();
    workspace.addMetadata('BusinessObject', 'UserTask', {
      sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class UserTask extends BusinessObject {
            id!: number;
          }
        `
    });
    workspace.addMetadata('Behavior', 'UserTaskClaim', {
      sourceCode: `
          import { addBehavior } from '@apexdesigner/dsl';
          import { UserTask } from '@business-objects';
          addBehavior(
            UserTask,
            { type: 'Instance', httpMethod: 'Post' },
            async function claim(userTask: UserTask, userId?: number) {}
          );
        `
    });

    const metadata = workspace.context.listMetadata('BusinessObject')[0];
    const result = (await businessObjectRouteGenerator.generate(metadata, workspace.context)) as string;

    // Should unwrap scalar param from req.body, not pass req.body directly
    expect(result).toContain('.claim(req.body.userId)');
    expect(result).not.toContain('.claim(req.body)');
  });
});
