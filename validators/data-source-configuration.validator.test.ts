import { describe, it, expect, beforeEach } from "vitest";
import { dataSourceConfiguration } from "./data-source-configuration.validator.js";
import { createTestContext } from "@apexdesigner/validator";

describe("data-source-configuration validator", () => {
  let testContext: ReturnType<typeof createTestContext>;

  beforeEach(() => {
    testContext = createTestContext();
  });

  it("should have correct name and appliesTo", () => {
    expect(dataSourceConfiguration.name).toBe("data-source-configuration");
    expect(dataSourceConfiguration.appliesTo).toEqual(["DataSource"]);
  });

  it("should pass for a valid Postgres data source", () => {
    const metadata = testContext.addDesignObject(`
      import { DataSource } from '@apexdesigner/dsl';

      export class MainDS extends DataSource {
        defaultIdType = Number;
        isDefault = true;
        configuration = {
          persistenceType: 'Postgres'
        };
      }
    `);

    dataSourceConfiguration.validate(metadata, testContext.context, false);

    expect(testContext.diagnostics).toEqual([]);
  });

  it("should pass for a valid File data source with rootDir", () => {
    const metadata = testContext.addDesignObject(`
      import { DataSource } from '@apexdesigner/dsl';

      export class FileDS extends DataSource {
        defaultIdType = String;
        configuration = {
          persistenceType: 'File',
          rootDir: './data'
        };
      }
    `);

    dataSourceConfiguration.validate(metadata, testContext.context, false);

    expect(testContext.diagnostics).toEqual([]);
  });

  it("should pass for a valid Memory data source", () => {
    const metadata = testContext.addDesignObject(`
      import { DataSource } from '@apexdesigner/dsl';

      export class MemDS extends DataSource {
        defaultIdType = Number;
        configuration = {
          persistenceType: 'Memory'
        };
      }
    `);

    dataSourceConfiguration.validate(metadata, testContext.context, false);

    expect(testContext.diagnostics).toEqual([]);
  });

  it("should pass for a valid Custom data source with handlers", () => {
    const metadata = testContext.addDesignObject(`
      import { DataSource } from '@apexdesigner/dsl';
      import { myFind } from '@functions';

      export class ApiDS extends DataSource {
        defaultIdType = String;
        configuration = {
          persistenceType: 'Custom',
          find: myFind
        };
      }
    `);

    dataSourceConfiguration.validate(metadata, testContext.context, false);

    expect(testContext.diagnostics).toEqual([]);
  });

  it("should error when configuration property is missing", () => {
    const metadata = testContext.addDesignObject(`
      import { DataSource } from '@apexdesigner/dsl';

      export class MainDS extends DataSource {
        defaultIdType = Number;
        isDefault = true;
      }
    `);

    dataSourceConfiguration.validate(metadata, testContext.context, false);

    const diagnostic = testContext.diagnostics.find(
      (d) => d.code === "MISSING_CONFIGURATION",
    );
    expect(diagnostic).toBeDefined();
    expect(diagnostic!.severity).toBe("error");
    expect(diagnostic!.path).toBe(metadata.path);
  });

  it("should error when configuration is not an object literal", () => {
    const metadata = testContext.addDesignObject(`
      import { DataSource } from '@apexdesigner/dsl';

      export class MainDS extends DataSource {
        defaultIdType = Number;
        configuration = 'not-an-object';
      }
    `);

    dataSourceConfiguration.validate(metadata, testContext.context, false);

    const diagnostic = testContext.diagnostics.find(
      (d) => d.code === "INVALID_CONFIGURATION",
    );
    expect(diagnostic).toBeDefined();
    expect(diagnostic!.severity).toBe("error");
  });

  it("should error when persistenceType is missing from configuration", () => {
    const metadata = testContext.addDesignObject(`
      import { DataSource } from '@apexdesigner/dsl';

      export class MainDS extends DataSource {
        defaultIdType = Number;
        configuration = {
          host: 'localhost'
        };
      }
    `);

    dataSourceConfiguration.validate(metadata, testContext.context, false);

    const diagnostic = testContext.diagnostics.find(
      (d) => d.code === "MISSING_PERSISTENCE_TYPE",
    );
    expect(diagnostic).toBeDefined();
    expect(diagnostic!.severity).toBe("error");
    expect(diagnostic!.message).toContain("persistenceType");
  });

  it("should error when persistenceType is not a recognized value", () => {
    const metadata = testContext.addDesignObject(`
      import { DataSource } from '@apexdesigner/dsl';

      export class MainDS extends DataSource {
        defaultIdType = Number;
        configuration = {
          persistenceType: 'MongoDB'
        };
      }
    `);

    dataSourceConfiguration.validate(metadata, testContext.context, false);

    const diagnostic = testContext.diagnostics.find(
      (d) => d.code === "INVALID_PERSISTENCE_TYPE",
    );
    expect(diagnostic).toBeDefined();
    expect(diagnostic!.severity).toBe("error");
    expect(diagnostic!.message).toContain("MongoDB");
    expect(diagnostic!.message).toContain("Postgres");
  });

  it("should error when File data source is missing rootDir", () => {
    const metadata = testContext.addDesignObject(`
      import { DataSource } from '@apexdesigner/dsl';

      export class FileDS extends DataSource {
        defaultIdType = String;
        configuration = {
          persistenceType: 'File'
        };
      }
    `);

    dataSourceConfiguration.validate(metadata, testContext.context, false);

    const diagnostic = testContext.diagnostics.find(
      (d) => d.code === "MISSING_ROOT_DIR",
    );
    expect(diagnostic).toBeDefined();
    expect(diagnostic!.severity).toBe("error");
    expect(diagnostic!.message).toContain("rootDir");
  });

  it("should error when Custom data source has no handlers", () => {
    const metadata = testContext.addDesignObject(`
      import { DataSource } from '@apexdesigner/dsl';

      export class ApiDS extends DataSource {
        defaultIdType = String;
        configuration = {
          persistenceType: 'Custom'
        };
      }
    `);

    dataSourceConfiguration.validate(metadata, testContext.context, false);

    const diagnostic = testContext.diagnostics.find(
      (d) => d.code === "MISSING_CUSTOM_HANDLERS",
    );
    expect(diagnostic).toBeDefined();
    expect(diagnostic!.severity).toBe("error");
    expect(diagnostic!.message).toContain("handler");
  });
});
