import { BaseType, setPropertyDefaults } from '@apexdesigner/dsl';

/**
 * Calendar Date
 *
 * Date value for calendar selection.
 */
export class CalendarDate extends BaseType<string> {}

setPropertyDefaults(CalendarDate, { presentAs: 'date', column: { type: 'date' } });
