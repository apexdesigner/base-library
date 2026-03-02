import { BaseType, setPropertyDefaults } from "@apexdesigner/dsl";

export class Duration extends BaseType<string> {}

setPropertyDefaults(Duration, { presentAs: "duration" });
