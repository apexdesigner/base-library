# Agents

An agent defines an AI-powered participant that can be used in [processes](processes.md) as a standalone task or as a collaborator in a [user task](processes.md#user-task). Agent files are named `<name>.agent.ts` and located in `design/agents/` by default.

## Class

An agent file exports a class that extends `Agent`. Properties define the typed inputs and outputs.

```typescript
// order-classification.agent.ts

import { Agent, property } from "@apexdesigner/dsl/agent";
import { Order } from "@business-objects";

/** Order Classification Agent */
export class OrderClassificationAgent extends Agent {
  @property({ isInput: true })
  order?: Order;

  @property({ isOutput: true, required: true })
  category?: 'standard' | 'priority' | 'bulk';

  @property({ isOutput: true, required: true })
  reasoning?: string;
}
```

Input properties (`isInput: true`) define what data the agent receives from the process. Output properties (`isOutput: true`) define the structured result the agent produces. These are type-checked at the call site in [processes](processes.md).

## System Prompt

Use `applySystemPrompt()` after the class to define the agent's identity and instructions:

```typescript
import { applySystemPrompt } from "@apexdesigner/dsl/agent";

applySystemPrompt(OrderClassificationAgent, `
  You are an order classification specialist. Analyze the order
  details and categorize it as standard, priority, or bulk based
  on the quantity, total value, and customer type.
`);
```

## Tools

Use `applyTools()` to give the agent access to [behaviors](behaviors.md) and [app behaviors](app-behaviors.md). The behavior's function name, typed inputs, and typed outputs are used to describe the tool to the AI model:

```typescript
import { applyTools } from "@apexdesigner/dsl/agent";
import { lookupInventory } from "@app-behaviors";
import { getLinkedResources } from "@behaviors";

applyTools(OrderClassificationAgent, [lookupInventory, getLinkedResources]);
```

## Agent Config

Use `applyAgentConfig()` to set model and provider settings. The config is unstructured — [validators](validators.md) check values against the AI provider configured in the project.

```typescript
import { applyAgentConfig } from "@apexdesigner/dsl/agent";

applyAgentConfig(OrderClassificationAgent, {
  model: 'sonnet-4-5',
  temperature: 0.2,
  maxTokens: 4096,
  maxIterations: 10,
});
```

## Validation

Add a validation function to check agent output. Return a string to reject the output — the message is sent back to the agent as feedback for retry. Return nothing to accept. The function name is generated per agent to provide typed outputs.

```typescript
import { validateOrderClassificationAgent } from "@agents";

validateOrderClassificationAgent(OrderClassificationAgent, (outputs) => {
  if (outputs.category === 'priority' && !outputs.reasoning) {
    return 'Priority classifications require reasoning';
  }
});
```

The validation function is generated per agent with typed outputs, so autocomplete works without manual type imports. See [generated types](#generated-types).

## Generated Types

The resolver generates type declarations from the agent's input and output properties into `@agents`:

```typescript
// design/@types/agents/order-classification-agent.d.ts

export interface OrderClassificationAgentOutput {
  category: 'standard' | 'priority' | 'bulk';
  reasoning: string;
}

export declare function OrderClassificationAgent(inputs: {
  order: Order;
}): AgentTaskDefinition<OrderClassificationAgentOutput>;

export declare function validateOrderClassificationAgent(
  target: typeof OrderClassificationAgent,
  fn: (outputs: OrderClassificationAgentOutput) => string | void,
): void;
```

The generated function is used in [processes](processes.md) for type-checked inputs and outputs. The validation function provides typed outputs for autocomplete without manual type imports. This follows the same pattern as [mixin apply functions](mixins.md#configuration).

## Complete Example

```typescript
import { Agent, property, applySystemPrompt, applyTools, applyAgentConfig } from "@apexdesigner/dsl/agent";
import { Order, Customer } from "@business-objects";
import { lookupInventory, checkCreditScore } from "@app-behaviors";
import { validateProcurementReviewAgent } from "@agents";

/** Procurement Review Agent */
export class ProcurementReviewAgent extends Agent {
  @property({ isInput: true })
  order?: Order;

  @property({ isInput: true })
  customer?: Customer;

  @property({ isOutput: true, required: true })
  decision?: 'approved' | 'rejected' | 'needs_escalation';

  @property({ isOutput: true, required: true })
  notes?: string;

  @property({ isOutput: true })
  suggestedDiscount?: number;
}

applySystemPrompt(ProcurementReviewAgent, `
  You are a procurement specialist who reviews orders
  for compliance with company purchasing policies.
  Be thorough but concise in your analysis.
`);

applyTools(ProcurementReviewAgent, [lookupInventory, checkCreditScore]);

applyAgentConfig(ProcurementReviewAgent, {
  model: 'sonnet-4-5',
  temperature: 0.2,
  maxTokens: 4096,
  maxIterations: 10,
});

validateProcurementReviewAgent(ProcurementReviewAgent, (outputs) => {
  if (outputs.decision === 'approved' && !outputs.notes) {
    return 'Approved decisions require notes';
  }
  if (outputs.suggestedDiscount > 30) {
    return 'Discount cannot exceed 30%';
  }
});
```
