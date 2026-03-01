import { BaseType, setPropertyDefaults } from "@apexdesigner/dsl";

export class Uuid extends BaseType<string> {}

setPropertyDefaults(Uuid, { column: "UUID" });
