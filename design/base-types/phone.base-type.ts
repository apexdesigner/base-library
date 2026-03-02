import { BaseType, applyValidation } from "@apexdesigner/dsl";

export class Phone extends BaseType<string> {}

applyValidation(Phone, {
  pattern: "^\\+?[1-9]\\d{1,14}$",
  patternMessage: "Must be a valid phone number (E.164 format)",
});
