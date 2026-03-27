import createDebug from "debug";
import {
  getClassByBase,
  getClassPropertyInitializer,
} from "@apexdesigner/utilities";
import { SyntaxKind } from "ts-morph";
import type { Validator } from "@apexdesigner/validator";

const debug = createDebug("ApexDesignerValidator:dataSourceConfiguration");

const VALID_PERSISTENCE_TYPES = ["Postgres", "Memory", "File", "Custom"];

const CUSTOM_HANDLER_NAMES = new Set([
  "find",
  "findOne",
  "findById",
  "findOrCreate",
  "count",
  "create",
  "createMany",
  "update",
  "updateById",
  "delete",
  "deleteById",
  "upsert",
]);

export const dataSourceConfiguration: Validator = {
  name: "data-source-configuration",
  appliesTo: ["DataSource"],
  validate(metadata, context, _fix): void {
    const dataSourceClass = getClassByBase(metadata.sourceFile, "DataSource");
    if (!dataSourceClass) return;

    const configurationInitializer = getClassPropertyInitializer(
      dataSourceClass,
      "configuration",
    );

    debug("configurationInitializer %j", !!configurationInitializer);

    if (!configurationInitializer) {
      context.addDiagnostic({
        code: "MISSING_CONFIGURATION",
        message:
          'DataSource is missing a "configuration" property with persistenceType',
        path: metadata.path,
        severity: "error",
      });
      return;
    }

    if (
      configurationInitializer.getKind() !==
      SyntaxKind.ObjectLiteralExpression
    ) {
      context.addDiagnostic({
        code: "INVALID_CONFIGURATION",
        message:
          '"configuration" must be an object literal with a persistenceType property',
        path: metadata.path,
        severity: "error",
      });
      return;
    }

    const objectLiteral = configurationInitializer.asKindOrThrow(
      SyntaxKind.ObjectLiteralExpression,
    );

    // Extract persistenceType and other property names
    let persistenceType = "";
    const propertyNames: string[] = [];

    for (const property of objectLiteral.getProperties()) {
      if (property.getKind() !== SyntaxKind.PropertyAssignment) continue;
      const propertyAssignment = property.asKindOrThrow(
        SyntaxKind.PropertyAssignment,
      );
      const propertyName = propertyAssignment.getName();

      if (propertyName === "persistenceType") {
        persistenceType =
          propertyAssignment
            .getInitializer()
            ?.getText()
            .replace(/['"]/g, "") || "";
      } else {
        propertyNames.push(propertyName);
      }
    }

    debug("persistenceType %j", persistenceType);
    debug("propertyNames %j", propertyNames);

    if (!persistenceType) {
      context.addDiagnostic({
        code: "MISSING_PERSISTENCE_TYPE",
        message: `configuration is missing persistenceType (valid values: ${VALID_PERSISTENCE_TYPES.join(", ")})`,
        path: metadata.path,
        severity: "error",
      });
      return;
    }

    if (!VALID_PERSISTENCE_TYPES.includes(persistenceType)) {
      context.addDiagnostic({
        code: "INVALID_PERSISTENCE_TYPE",
        message: `"${persistenceType}" is not a valid persistenceType (valid values: ${VALID_PERSISTENCE_TYPES.join(", ")})`,
        path: metadata.path,
        severity: "error",
      });
      return;
    }

    if (persistenceType === "File") {
      const hasRootDir = propertyNames.includes("rootDir");
      debug("hasRootDir %j", hasRootDir);

      if (!hasRootDir) {
        context.addDiagnostic({
          code: "MISSING_ROOT_DIR",
          message:
            'File data source requires a rootDir property in configuration',
          path: metadata.path,
          severity: "error",
        });
      }
    }

    if (persistenceType === "Custom") {
      const handlerNames = propertyNames.filter((name) =>
        CUSTOM_HANDLER_NAMES.has(name),
      );
      debug("handlerNames %j", handlerNames);

      if (handlerNames.length === 0) {
        context.addDiagnostic({
          code: "MISSING_CUSTOM_HANDLERS",
          message:
            "Custom data source requires at least one handler function (find, findById, create, etc.)",
          path: metadata.path,
          severity: "error",
        });
      }
    }
  },
};
