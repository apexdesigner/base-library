import { BaseType, setPropertyDefaults } from "@apexdesigner/dsl";

export class Percentage extends BaseType<number> {}

setPropertyDefaults(Percentage, { presentAs: "percentage" });
