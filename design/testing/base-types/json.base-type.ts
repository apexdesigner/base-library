import { BaseType, setPropertyDefaults } from "@apexdesigner/dsl";

export class Json extends BaseType<any> {}

setPropertyDefaults(Json, { column: "jsonb", presentAs: "json" });
