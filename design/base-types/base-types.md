# Base Types

The base-types directory defines application-level type wrappers with validation and formatting constraints.

The [email](email.base-type.ts), [phone](phone.base-type.ts), [url](url.base-type.ts), and [zip code](zip-code.base-type.ts) base types provide validated string formats for common contact and address fields. The [uuid](uuid.base-type.ts) base type wraps universally unique identifiers.

The [currency](currency.base-type.ts) and [percentage](percentage.base-type.ts) base types handle numeric values with appropriate formatting. The [duration](duration.base-type.ts) base type represents time spans. The [calendar date](calendar-date.base-type.ts) base type wraps date values without a time component.

The [json](json.base-type.ts) base type stores arbitrary JSON data. The [semantic version](semantic-version.base-type.ts) base type validates version strings following the semver convention.
