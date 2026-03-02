import { BaseType, setPropertyDefaults } from "@apexdesigner/dsl";

export class Email extends BaseType<string> {}

setPropertyDefaults(Email, { presentAs: "email" });
