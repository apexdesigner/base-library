# Data Flows

A data flow defines a computation as a single class where methods are named values. The dependency graph between methods determines execution order — the generator resolves it automatically. Data flow files are named `<name>.data-flow.ts` and located in `design/data-flows/` by default.

## Class

```typescript
// prepare-invoice.data-flow.ts

import { DataFlow } from "@apexdesigner/dsl/data-flow";

/** Prepare Invoice */
export class PrepareInvoice extends DataFlow {
}
```

## Input

The `@input()` decorator marks the method where external data enters the flow. The method parameters define the data flow's input type:

```typescript
import { DataFlow, input } from "@apexdesigner/dsl/data-flow";
import { OrderItems } from "@business-objects";

/** Prepare Invoice */
export class PrepareInvoice extends DataFlow {
  @input()
  items(orderId: number) {
    return OrderItems.find({ where: { orderId }, order: 'sequence' });
  }
}
```

Multiple inputs are handled by the parameter signature:

```typescript
export class PrepareInvoice extends DataFlow {
  @input()
  items(orderId: number, region: string) {
    return OrderItems.find({ where: { orderId, region }, order: 'sequence' });
  }

  // ...
}
```

Other methods access input data by calling the input method — they never access raw input parameters directly:

```typescript
export class PrepareInvoice extends DataFlow {
  @input()
  items(orderId: number) {
    return OrderItems.find({ where: { orderId }, order: 'sequence' });
  }

  pricedItems() {
    return lookup(this.items(), PriceList, {
      on: { partNumber: 'partNumber' },
    });
  }

  // ...
}
```

## Output

The `@output()` decorator marks the method whose return value is exposed to the caller. The return type defines the data flow's output type:

```typescript
export class PrepareInvoice extends DataFlow {
  // ...

  @output()
  invoice(): Invoice {
    return {
      lineItems: this.extendedItems(),
      subtotal: this.subtotal(),
      tax: this.tax(),
      total: this.total(),
    };
  }
}
```

## Methods as Values

Each method defines a named value — like a range in a spreadsheet. Dependencies are expressed by calling other methods. The generator resolves execution order, caches results, and parallelizes independent methods automatically.

```typescript
export class PrepareInvoice extends DataFlow {
  @input()
  items(orderId: number) {
    return OrderItems.find({ where: { orderId }, order: 'sequence' });
  }

  pricedItems() {
    return lookup(this.items(), PriceList, {
      on: { partNumber: 'partNumber' },
    });
  }

  extendedItems() {
    return extend(this.pricedItems(), {
      extended: item => item.quantity * item.price,
    });
  }

  subtotal() {
    return sum(this.extendedItems(), 'extended');
  }

  tax() {
    return this.subtotal() * 0.08;
  }

  total() {
    return this.subtotal() + this.tax();
  }

  @output()
  invoice(): Invoice {
    return {
      lineItems: this.extendedItems(),
      subtotal: this.subtotal(),
      tax: this.tax(),
      total: this.total(),
    };
  }
}
```

The generator:

- **Resolves order** — topological sort of the dependency graph
- **Caches results** — each method is computed exactly once, even if referenced by multiple methods
- **Parallelizes** — independent methods (e.g. two separate queries) run concurrently
- **Handles async** — I/O methods (business object queries) are awaited transparently
- **Validates connectivity** — all methods must be connected to the graph; orphan methods are flagged as errors

## Data Sources

### Business Objects

Methods can query [business objects](business-objects.md) using the standard query API:

```typescript
export class PrepareInvoice extends DataFlow {
  @input()
  items(orderId: number) {
    return OrderItems.find({ where: { orderId }, order: 'sequence' });
  }

  prices() {
    return PriceList.find();
  }

  // ...
}
```

### Data Flows

A data flow can reference another data flow as a data source. The return type flows through from the referenced data flow's `@output()` method:

```typescript
import { PrepareInvoice } from "@data-flows";

export class MonthlyReport extends DataFlow {
  @input()
  invoices(month: string) {
    return PrepareInvoice({ month });
  }

  // ...
}
```

### Custom Sources

For external APIs or other data sources not backed by a business object, use standard HTTP calls:

```typescript
import axios from 'axios';

export class ImportExchangeRates extends DataFlow {
  @input()
  rates(baseCurrency: string) {
    return axios.get(`https://api.exchangerate.host/latest?base=${baseCurrency}`)
      .then(response => response.data.rates);
  }

  // ...
}
```

## Transform Functions

Transform functions operate on datasets. They are strongly typed — field names are checked against the item type, and return types are inferred through generics.

| Function | Returns | Description |
|----------|---------|-------------|
| `lookup` | array | Left join against a business object or array |
| `extend` | array | Add computed fields to each record |
| `filter` | array | Remove records by predicate |
| `sort` | array | Order by fields |
| `map` | array | Transform each record to a new shape |
| `pivot` | array | Group by fields and aggregate |
| `flatten` | array | Reshape nested data |
| `deduplicate` | array | Remove duplicates by key |
| `cumulative` | array | Add running totals |
| `rank` | array | Add rank by a field |
| `concat` | array | Combine two datasets |
| `validate` | array | Check records, separate invalid |
| `distinct` | array | Unique values of a field |
| `sum` | scalar | Sum a numeric field |
| `count` | scalar | Count records |
| `avg` | scalar | Average a numeric field |
| `min` | scalar | Minimum value of a field |
| `max` | scalar | Maximum value of a field |
| `first` | scalar | First record from dataset |
| `last` | scalar | Last record from dataset |

### lookup

Left join against a business object or an in-memory array. When given a business object class, it automatically builds an efficient `IN` query from the join keys:

```typescript
export class PrepareInvoice extends DataFlow {
  // ...

  pricedItems() {
    return lookup(this.items(), PriceList, {
      on: { partNumber: 'partNumber' },
    });
  }
}
```

### extend

Add computed fields to each record — like adding formula columns in a spreadsheet:

```typescript
export class PrepareInvoice extends DataFlow {
  // ...

  extendedItems() {
    return extend(this.pricedItems(), {
      extended: item => item.quantity * item.price,
    });
  }
}
```

### pivot

Group by fields and aggregate — like an Excel pivot table:

```typescript
export class MonthlyReport extends DataFlow {
  // ...

  regionSummary() {
    return pivot(this.orders(), {
      groupBy: ['region', 'category'],
      values: {
        totalRevenue: sum('netAmount'),
        orderCount: count(),
        avgOrder: avg('netAmount'),
      },
    });
  }
}
```

### sum

Scalar aggregation over a dataset:

```typescript
export class PrepareInvoice extends DataFlow {
  // ...

  subtotal() {
    return sum(this.extendedItems(), 'extended');
  }
}
```

## Complex Logic

For logic that doesn't fit inline, use the same patterns available to other design types:

### Behavior Files

Associate a [behavior](behaviors.md) file with the data flow for complex transformations:

```typescript
import { computeOrderPricing } from "@behaviors";

export class PrepareInvoice extends DataFlow {
  // ...

  pricedItems() {
    return computeOrderPricing(this.items());
  }
}
```

### Decision Tables

Reference a [decision table](decision-tables.md) for rule-based logic:

```typescript
import { DiscountRules } from "@decision-tables";

export class PrepareInvoice extends DataFlow {
  // ...

  discountedItems() {
    return applyDecisionTable(this.extendedItems(), DiscountRules);
  }
}
```

## Process Integration

Call a data flow from a [process](processes.md) using `createDataFlowTask()`. It has the same mechanics as a service task but is visually distinct in the process diagram:

```typescript
import { Process, messageStart, end } from "@apexdesigner/dsl/process";
import { PrepareInvoice } from "@data-flows";
import { NewOrderMessage } from "@process-messages";

export class InvoiceProcess extends Process {
  order?: Order;
  invoice?: Invoice;

  @messageStart()
  onNewOrder(message: NewOrderMessage) {
    this.order = message.order;
    this.prepareInvoice();
  }

  prepareInvoice() {
    createDataFlowTask(PrepareInvoice({ orderId: this.order.id }))
      .then((invoice) => {
        this.invoice = invoice;
        this.complete();
      });
  }

  @end()
  complete() {}
}
```

## Generated Types

The resolver generates type declarations from the data flow's input parameters and output return types into `@data-flows`:

```typescript
// design/@types/data-flows/prepare-invoice.d.ts

export interface PrepareInvoiceOutput {
  invoice: Invoice;
}

export declare function PrepareInvoice(inputs: {
  orderId: number;
}): DataFlowTaskDefinition<PrepareInvoiceOutput>;
```

## Strong Typing

Transform functions use TypeScript generics to flow types through the chain:

- `lookup()` infers the merged type from both sides of the join
- `extend()` infers added fields from the derivation functions
- `sum()` constrains the field name to numeric keys on the item type
- `pivot()` infers the grouped output shape from the aggregation config
- `filter()` and `sort()` preserve the input type
- `map()` infers the output type from the transform function

An invalid field name like `sum(this.extendedItems(), 'extendeed')` is a TypeScript error.

## Complete Example

```typescript
import { DataFlow, input, output } from "@apexdesigner/dsl/data-flow";
import { lookup, extend, sum } from "@apexdesigner/dsl/data-flow";
import { OrderItems, PriceList } from "@business-objects";

/** Prepare Invoice */
export class PrepareInvoice extends DataFlow {
  @input()
  items(orderId: number) {
    return OrderItems.find({ where: { orderId }, order: 'sequence' });
  }

  pricedItems() {
    return lookup(this.items(), PriceList, {
      on: { partNumber: 'partNumber' },
    });
  }

  extendedItems() {
    return extend(this.pricedItems(), {
      extended: item => item.quantity * item.price,
    });
  }

  subtotal() {
    return sum(this.extendedItems(), 'extended');
  }

  tax() {
    return this.subtotal() * 0.08;
  }

  total() {
    return this.subtotal() + this.tax();
  }

  @output()
  invoice(): Invoice {
    return {
      lineItems: this.extendedItems(),
      subtotal: this.subtotal(),
      tax: this.tax(),
      total: this.total(),
    };
  }
}
```
