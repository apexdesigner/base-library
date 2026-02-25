# Client-Side Debug

Use the `debug` npm package for conditional logging in components, pages, and services. Debug output only appears when enabled in the browser console — no performance cost in production.

## DSL Design File

```typescript
import createDebug from "debug";
import { Component, property, applyTemplate } from "@apexdesigner/dsl/component";

const debug = createDebug("OrderListComponent");

export class OrderListComponent extends Component {
  @property({ isInput: true })
  orders!: any[];

  selectOrder(order: any): void {
    debug("order", order);

    this.selectedOrder = order;
  }
}
```

Key differences from non-DSL code:

- Use **lowercase** `debug` — the generator renames it to `Debug` and adds `.extend('methodName')` per method automatically
- Use `debug()` directly in methods — no need to call `.extend()` yourself
- Don't use `%j` on the client — the browser console lets you inspect objects interactively

## What Gets Generated

The generator transforms your code:

**Design file:**
```typescript
const debug = createDebug("OrderListComponent");

selectOrder(order: any): void {
  debug("order", order);
  this.selectedOrder = order;
}
```

**Generated output:**
```typescript
const Debug = createDebug("OrderListComponent");

selectOrder(order: any): void {
  const debug = Debug.extend('selectOrder');
  debug("order", order);

  this.selectedOrder = order;
}
```

This gives you namespaced output like `OrderListComponent:selectOrder order {id: 1, ...}` in the console.

## Enabling in the Browser

Open the browser console and set `localStorage.debug`:

```javascript
// Enable for a specific component
localStorage.debug = 'OrderListComponent:*';

// Enable for all components
localStorage.debug = '*';

// Enable for a specific method
localStorage.debug = 'OrderListComponent:selectOrder';

// Disable
localStorage.debug = '';
```

Refresh the page after setting. Debug output appears with color-coded namespaces.

## Rules

Follow the conventions in the [debug skill](./.claude/skills/debug/SKILL.md), with these client-specific notes:

- **No `%j`** — browser console inspects objects natively; only use `%j` when you need to capture object state at a point in time (timing issues)
- **One item per statement** — `debug('order', order)` not `debug('order=%s items=%s', order, items)`
- **Blank line after debug group** — separates logging from logic
- **Log early returns** — helps trace why execution stopped

---

[← Back to Patterns](./README.md)
