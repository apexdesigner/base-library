import { BaseType, applyValidation } from "@apexdesigner/dsl";

export class Email extends BaseType<string> {}

applyValidation(Email, {
  pattern: "^[^@]+@[^@]+\\.[^@]+$",
  patternMessage: "Must be a valid email address",
});
