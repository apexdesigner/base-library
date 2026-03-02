import { BaseType, applyValidation } from "@apexdesigner/dsl";

export class ZipCode extends BaseType<string> {}

applyValidation(ZipCode, {
  pattern: "^\\d{5}(-\\d{4})?$",
  patternMessage: "Must be a valid US ZIP code",
});
