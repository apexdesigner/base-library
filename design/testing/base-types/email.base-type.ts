import { BaseType, setColumnDefaults } from "@apexdesigner/dsl";

export class Email extends BaseType<string> {}

setColumnDefaults(Email, "VARCHAR(255)");
