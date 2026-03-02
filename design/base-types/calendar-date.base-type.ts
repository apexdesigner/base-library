import { BaseType, setPropertyDefaults } from "@apexdesigner/dsl";

export class CalendarDate extends BaseType<string> {}

setPropertyDefaults(CalendarDate, { presentAs: "date" });
