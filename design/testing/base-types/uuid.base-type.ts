import { BaseType, setColumnDefaults } from "@apexdesigner/dsl";

export class Uuid extends BaseType<string> {}

setColumnDefaults(Uuid, "UUID");
