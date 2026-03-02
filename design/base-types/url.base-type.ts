import { BaseType, applyValidation } from "@apexdesigner/dsl";

export class Url extends BaseType<string> {}

applyValidation(Url, {
  pattern: "^https?://\\S+$",
  patternMessage: "Must be a valid URL",
});
