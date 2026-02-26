import { describe, it, expect } from 'vitest';
import { serviceTypeGenerator } from './service-type.generator.js';
import { createSimpleMockWorkspace } from '@apexdesigner/generator';

describe('serviceTypeGenerator', () => {
  it('should generate type declaration for a service', async () => {
    const workspace = createSimpleMockWorkspace();
    workspace.addMetadata('Service', 'AuthService', {
      sourceCode: `
        import { Service } from '@apexdesigner/dsl/service';
        export class AuthService extends Service {}
      `,
    });

    const metadata = workspace.context.listMetadata('Service')[0];
    const result = (await serviceTypeGenerator.generate(metadata, workspace.context)) as string;

    expect(result).toContain('export declare class AuthService {}');
  });

  it('should include properties and methods in type declaration', async () => {
    const workspace = createSimpleMockWorkspace();
    workspace.addMetadata('Service', 'AuthService', {
      sourceCode: `
        import { Service } from '@apexdesigner/dsl/service';
        export class AuthService extends Service {
          message!: string;
          count!: number;
          greet(name: string): void {}
        }
      `,
    });

    const metadata = workspace.context.listMetadata('Service')[0];
    const result = (await serviceTypeGenerator.generate(metadata, workspace.context)) as string;

    expect(result).toContain('message: string;');
    expect(result).toContain('count: number;');
    expect(result).toContain('greet(name: string): void;');
  });

  it('should output to the correct path', () => {
    const workspace = createSimpleMockWorkspace();
    workspace.addMetadata('Service', 'AuthService', {
      sourceCode: `
        import { Service } from '@apexdesigner/dsl/service';
        export class AuthService extends Service {}
      `,
    });

    const metadata = workspace.context.listMetadata('Service')[0];
    const outputs = serviceTypeGenerator.outputs(metadata);

    expect(outputs).toEqual(['design/@types/services/auth-service.d.ts']);
  });
});
