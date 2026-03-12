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

  describe('findOne route', () => {
    it('should generate a find-one route before the :id route', async () => {
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

      expect(result).toContain('"/find-one"');
      expect(result).toContain('findOne');

      // find-one must appear before /:id to avoid route conflict
      const findOneIndex = result.indexOf('"/find-one"');
      const paramIdIndex = result.indexOf('"/:id"');
      expect(findOneIndex).toBeLessThan(paramIdIndex);
    });
  });

  describe('view business objects', () => {
    it('should not generate create/update/delete routes for view BOs', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'LatestProcessDesign', {
        sourceCode: `
          import { BusinessObject, setView } from '@apexdesigner/dsl';
          export class LatestProcessDesign extends BusinessObject {
            id!: number;
            name?: string;
          }
          setView(LatestProcessDesign, \`SELECT * FROM process_design\`);
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = (await businessObjectRouteGenerator.generate(metadata, workspace.context)) as string;

      // Should have read routes
      expect(result).toContain('router.get("/",');
      expect(result).toContain('router.get("/:id",');
      expect(result).toContain('router.get("/find-one",');

      // Should NOT have write routes
      expect(result).not.toContain('router.post("/",');
      expect(result).not.toContain('router.patch("/:id",');
      expect(result).not.toContain('router.delete("/:id",');
    });

    it('should still generate read routes for view BOs', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'MyUserTask', {
        sourceCode: `
          import { BusinessObject, setView } from '@apexdesigner/dsl';
          export class MyUserTask extends BusinessObject {
            id!: number;
          }
          setView(MyUserTask, \`SELECT * FROM user_task WHERE user_id = :currentUserId\`);
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = (await businessObjectRouteGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('router.get("/",');
      expect(result).toContain('router.get("/find-one",');
      expect(result).toContain('router.get("/:id",');
    });
  });

  describe('parameter sources', () => {
    it('should extract Header<T> parameters from req.headers for class behaviors', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'Order', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class Order extends BusinessObject {
            id!: number;
          }
        `
      });
      workspace.addMetadata('Behavior', 'OrderExport', {
        sourceCode: `
          import { addBehavior, Header } from '@apexdesigner/dsl';
          import { Order } from '@business-objects';
          addBehavior(
            Order,
            { type: 'Class', httpMethod: 'Get' },
            async function exportOrders(authorization: Header<string>) {}
          );
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = (await businessObjectRouteGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('req.headers["authorization"]');
      expect(result).not.toContain('req.body.authorization');
    });

    it('should use custom path with path params for class behaviors', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'Order', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class Order extends BusinessObject {
            id!: number;
          }
        `
      });
      workspace.addMetadata('Behavior', 'OrderSearchByCategory', {
        sourceCode: `
          import { addBehavior } from '@apexdesigner/dsl';
          import { Order } from '@business-objects';
          addBehavior(
            Order,
            { type: 'Class', httpMethod: 'Post', path: '/api/orders/categories/:categoryId/search' },
            async function searchByCategory(categoryId: number, filters: any) {}
          );
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = (await businessObjectRouteGenerator.generate(metadata, workspace.context)) as string;

      // Route path should include :categoryId
      expect(result).toContain('"/categories/:categoryId/search"');
      expect(result).toContain('req.params.categoryId');
      expect(result).not.toContain('req.body.categoryId');
    });

    it('should extract Header<T> parameters from req.headers for instance behaviors', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'Order', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class Order extends BusinessObject {
            id!: number;
          }
        `
      });
      workspace.addMetadata('Behavior', 'OrderShip', {
        sourceCode: `
          import { addBehavior, Header } from '@apexdesigner/dsl';
          import { Order } from '@business-objects';
          addBehavior(
            Order,
            { type: 'Instance', httpMethod: 'Post' },
            async function ship(order: Order, authorization: Header<string>, details: any) {}
          );
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = (await businessObjectRouteGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('req.headers["authorization"]');
      expect(result).toContain('req.body');
      expect(result).not.toContain('req.body.authorization');
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
