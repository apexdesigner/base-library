# Functions

A function encapsulates reusable logic that is not tied to a specific [business object](business-objects.md). Unlike [behaviors](behaviors.md) (attached to a business object) and [app behaviors](app-behaviors.md) (application-level concerns like endpoints and middleware), functions are plain callable utilities. By default, a function is generated into both client and server; use the [`layer`](#layer) option to restrict it to one. Function files are named `<name>.function.ts` and by default are created in `design/functions/`.

## Structure

A function file calls `addFunction()` with options and a named function. The function can be sync or async. JSDoc comments above `addFunction()` provide the display name, description, and document the inputs and output.

```typescript
// calculate-shipping.function.ts

import { addFunction } from "@apexdesigner/dsl";
import { Order } from "@business-objects";

/**
 * Calculate Shipping
 *
 * Determines the shipping cost for an order based on
 * weight, destination, and shipping method.
 *
 * @param order - The order to calculate shipping for
 * @param method - Shipping method: standard, express, or overnight
 * @returns The calculated shipping cost in cents
 */
addFunction(
  {},
  async function calculateShipping(
    order: Order,
    method: "standard" | "express" | "overnight",
  ): Promise<number> {
    // ...
  },
);
```

The JSDoc is parsed as follows:

- **First line** — display name (e.g. "Calculate Shipping")
- **Remaining text** — description
- **`@param`** — input names and descriptions
- **`@returns`** — output description

## Inputs and Output

Inputs are the function parameters. Outputs are the return type. Parameters and return types can be native types (`string`, `number`, `boolean`, `Date`), [base types](base-types.md), [interface definitions](interface-definitions.md), [business objects](business-objects.md), or [external types](external-types.md):

```typescript
import { addFunction } from "@apexdesigner/dsl";
import { Customer, Order } from "@business-objects";
import { ShippingEstimate } from "@interface-definitions";

/**
 * Estimate Shipping Options
 *
 * Returns available shipping options with estimated
 * delivery dates and costs.
 *
 * @param order - The order to ship
 * @param customer - The customer receiving the order
 * @returns Available shipping options with costs and dates
 */
addFunction(
  {},
  async function estimateShippingOptions(
    order: Order,
    customer: Customer,
  ): Promise<ShippingEstimate[]> {
    // ...
  },
);
```

Primitive types and sync functions work as well:

```typescript
import { addFunction } from "@apexdesigner/dsl";

/**
 * Format Currency
 *
 * Formats a number as a currency string.
 *
 * @param amount - The amount in cents
 * @param currencyCode - ISO 4217 currency code
 * @returns Formatted currency string
 */
addFunction(
  {},
  function formatCurrency(
    amount: number,
    currencyCode: string,
  ): string {
    // ...
  },
);
```

## Importing Functions

Functions are imported from `@functions` and can be used in [behaviors](behaviors.md), [app behaviors](app-behaviors.md), [components](components.md), [data flows](data-flows.md), and other functions.

In a behavior:

```typescript
// order/order.set-shipping-cost.behavior.ts

import { addBehavior } from "@apexdesigner/dsl";
import { Order } from "@business-objects";
import { calculateShipping } from "@functions";

addBehavior(
  Order,
  {
    type: "Before Create",
  },
  async function setShippingCost(this: Order) {
    this.shippingCost = await calculateShipping(this, "standard");
  },
);
```

In a component:

```typescript
// shipping-estimate.component.ts

import { Component, property } from "@apexdesigner/dsl/component";
import { Order } from "@business-objects";
import { calculateShipping } from "@functions";

export class ShippingEstimateComponent extends Component {
  @property()
  order: Order;

  async onInit() {
    this.estimate = await calculateShipping(this.order, "standard");
  }
}
```

## Layer

By default, a function is generated into both client and server. Use `layer` to restrict it to one:

```typescript
// Client-only
addFunction(
  { layer: "Client" },
  function formatCurrency(amount: number, currencyCode: string): string {
    // ...
  },
);
```

```typescript
// Server-only
addFunction(
  { layer: "Server" },
  async function hashPassword(password: string): Promise<string> {
    // ...
  },
);
```

When `layer` is omitted, the function is available on both client and server.

## Testing

Use `addTest()` in a function file to define tests. Tests use [test fixtures](test-fixtures.md) and CRUD APIs to set up data, with vitest assertions:

```typescript
// calculate-shipping.function.ts

import { addFunction, addTest } from "@apexdesigner/dsl";
import { Order } from "@business-objects";
import { expect } from "vitest";

/**
 * Calculate Shipping
 *
 * Determines the shipping cost for an order based on
 * weight, destination, and shipping method.
 *
 * @param order - The order to calculate shipping for
 * @param method - Shipping method: standard, express, or overnight
 * @returns The calculated shipping cost in cents
 */
addFunction(
  {},
  async function calculateShipping(
    order: Order,
    method: "standard" | "express" | "overnight",
  ): Promise<number> {
    // ...
  },
);

addTest("should calculate standard shipping", async () => {
  const order = await Order.testFixtures.simple();
  const cost = await calculateShipping(order, "standard");
  expect(cost).toBeGreaterThan(0);
});

addTest("should charge more for overnight", async () => {
  const order = await Order.testFixtures.simple();
  const standard = await calculateShipping(order, "standard");
  const overnight = await calculateShipping(order, "overnight");
  expect(overnight).toBeGreaterThan(standard);
});
```

## Complete Example

```typescript
// validate-tax-id.function.ts

import { addFunction, addTest } from "@apexdesigner/dsl";
import { Customer } from "@business-objects";
import { TaxValidationResult } from "@interface-definitions";
import { expect } from "vitest";

/**
 * Validate Tax ID
 *
 * Validates a customer's tax identification number against
 * the appropriate regional tax authority.
 *
 * @param customer - The customer whose tax ID to validate
 * @param region - The tax region to validate against
 * @returns Validation result with status and any error details
 */
addFunction(
  {},
  async function validateTaxId(
    customer: Customer,
    region: string,
  ): Promise<TaxValidationResult> {
    // ...
  },
);

addTest("should validate a correct US tax ID", async () => {
  const customer = await Customer.testFixtures.withTaxId();
  const result = await validateTaxId(customer, "US");
  expect(result.valid).toBe(true);
});

addTest("should reject an invalid tax ID", async () => {
  const customer = await Customer.create({ taxId: "invalid" });
  const result = await validateTaxId(customer, "US");
  expect(result.valid).toBe(false);
  expect(result.errors).toHaveLength(1);
});
```
