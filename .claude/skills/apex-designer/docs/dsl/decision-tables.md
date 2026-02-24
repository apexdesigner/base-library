# Decision Tables

A decision table defines business rules as a class with an `evaluate()` method. Decision table files are named `<name>.decision-table.ts` and located in `design/decision-tables/` by default.

## Decision Table Class

```typescript
import { DecisionTable } from "@apexdesigner/dsl/decision-table";

export class TaxBracket extends DecisionTable {
  evaluate(income: number): { rate: number } {
    if (income <= 50000) return { rate: 0.10 };
    if (income <= 100000) return { rate: 0.20 };
    return { rate: 0.30 };
  }
}
```

For rules that need external data, use async:

```typescript
import { DecisionTable } from "@apexdesigner/dsl/decision-table";
import { fetchCreditScore } from "@services";

export class RiskAssessment extends DecisionTable {
  async evaluate(applicant: Applicant): Promise<{ risk: string }> {
    const creditScore = await fetchCreditScore(applicant.id);

    if (creditScore < 500) return { risk: 'High' };
    if (creditScore < 700) return { risk: 'Medium' };
    return { risk: 'Low' };
  }
}
```

## Hit Policies

The hit policy determines how matching rules are processed. The pattern used in the `evaluate()` method body indicates the hit policy.

| DMN | Hit Policy | Description |
|-----|------------|-------------|
| U | [Unique](#unique-default) | Exactly one rule matches |
| A | [Any](#any) | Multiple rules match, same output |
| P | [Priority](#priority) | Multiple rules match, highest priority wins |
| F | [First](#first) | First matching rule wins |
| O | [Output Order](#output-order) | All matches sorted by priority |
| R | [Rule Order](#rule-order) | All matches in rule order |
| C | [Collect](#collect) | All matches returned |
| C+ | [Collect Sum](#collect-sum) | Sum of matching outputs |
| C< | [Collect Min](#collect-min) | Minimum of matching outputs |
| C> | [Collect Max](#collect-max) | Maximum of matching outputs |
| C# | [Collect Count](#collect-count) | Count of matching rules |

### Unique (Default)

Exactly one rule must match. The `unique()` helper validates this at runtime and throws if zero or multiple rules match. Collect matches and return with `unique()`:

```typescript
import { unique, between } from "@apexdesigner/dsl/decision-table";

export class TaxBracket extends DecisionTable {
  evaluate(income: number): { rate: number; category: string } {
    const matches: { rate: number; category: string }[] = [];

    // 10% rate for low income
    if (between(income, 0, 10000)) matches.push({ rate: 0.10, category: 'Low' });

    // 22% rate for middle income
    if (between(income, 10001, 40000)) matches.push({ rate: 0.22, category: 'Middle' });

    // 24% rate for upper income
    if (between(income, 40001, 85000)) matches.push({ rate: 0.24, category: 'Upper' });

    // 32% rate for high income
    if (income > 85000) matches.push({ rate: 0.32, category: 'High' });

    return unique(matches);
  }
}
```

### Any

Multiple rules can match, but all must produce the same output. The `anyOf()` helper validates all matches have identical outputs at runtime and throws if they differ:

```typescript
import { anyOf } from "@apexdesigner/dsl/decision-table";

export class EligibilityCheck extends DecisionTable {
  evaluate(applicant: Applicant): { eligible: boolean } {
    const matches: { eligible: boolean }[] = [];

    // Eligible: age 18+ with valid ID
    if (applicant.age >= 18 && applicant.hasValidId) matches.push({ eligible: true });

    // Eligible: parent consent on file
    if (applicant.hasParentConsent) matches.push({ eligible: true });

    // Not eligible: flagged account
    if (applicant.isFlagged) matches.push({ eligible: false });

    return anyOf(matches);
  }
}
```

### Priority

Multiple rules can match; the highest priority output wins. The `priority()` helper returns the output with highest priority based on base type value order (first value = highest priority). For multiple output columns, comparison is lexicographic: the first base-typed column determines priority, with subsequent columns as tiebreakers. Priority is determined by the order of values in a [base type](base-types.md):

```typescript
// design/base-types/risk-level.base-type.ts
import { BaseType, applyValidValues } from "@apexdesigner/dsl";

export class RiskLevel extends BaseType<string> {}

applyValidValues(RiskLevel, ['Critical', 'High', 'Medium', 'Low']);
```

```typescript
import { priority } from "@apexdesigner/dsl/decision-table";
import { RiskLevel } from "@base-types";

export class RiskAssessment extends DecisionTable {
  evaluate(applicant: Applicant): { risk: RiskLevel } {
    const matches: { risk: RiskLevel }[] = [];

    // Critical: negative balance and overdue
    if (applicant.balance < 0 && applicant.daysOverdue > 90) matches.push({ risk: 'Critical' });

    // High: bad credit
    if (applicant.creditScore < 500) matches.push({ risk: 'High' });

    // Medium: moderate credit
    if (applicant.creditScore < 700) matches.push({ risk: 'Medium' });

    // Low: good standing
    if (applicant.creditScore >= 700) matches.push({ risk: 'Low' });

    return priority(matches);
  }
}
```

### First

The first matching rule wins. Use early returns:

```typescript
export class RiskLevel extends DecisionTable {
  evaluate(applicant: Applicant): { risk: string } {
    // High risk: credit score below 500
    if (applicant.creditScore < 500) return { risk: 'High' };

    // Medium risk: credit score below 700
    if (applicant.creditScore < 700) return { risk: 'Medium' };

    // Low risk: good credit
    return { risk: 'Low' };
  }
}
```

### Output Order

Returns all matches sorted by output priority (from base type value order). The `outputOrder()` helper sorts results by the base type's value order:

```typescript
import { outputOrder } from "@apexdesigner/dsl/decision-table";
import { RiskLevel } from "@base-types";

export class AllRiskFactors extends DecisionTable {
  evaluate(applicant: Applicant): { risk: RiskLevel }[] {
    const matches: { risk: RiskLevel }[] = [];

    // Critical: negative balance and overdue
    if (applicant.balance < 0 && applicant.daysOverdue > 90) matches.push({ risk: 'Critical' });

    // High: bad credit
    if (applicant.creditScore < 500) matches.push({ risk: 'High' });

    // Medium: moderate credit
    if (applicant.creditScore < 700) matches.push({ risk: 'Medium' });

    // Low: good standing
    if (applicant.creditScore >= 700) matches.push({ risk: 'Low' });

    return outputOrder(matches);
  }
}
```

### Rule Order

Returns all matches in the order rules appear. Simply return the matches array:

```typescript
export class AllRiskFactors extends DecisionTable {
  evaluate(applicant: Applicant): { risk: string }[] {
    const matches: { risk: string }[] = [];

    // Critical: negative balance and overdue
    if (applicant.balance < 0 && applicant.daysOverdue > 90) matches.push({ risk: 'Critical' });

    // High: bad credit
    if (applicant.creditScore < 500) matches.push({ risk: 'High' });

    // Medium: moderate credit
    if (applicant.creditScore < 700) matches.push({ risk: 'Medium' });

    // Low: good standing
    if (applicant.creditScore >= 700) matches.push({ risk: 'Low' });

    return matches;
  }
}
```

### Collect

Return all matching outputs as an array (same as Rule Order, but semantically indicates arbitrary order):

```typescript
export class ApplicableDiscounts extends DecisionTable {
  evaluate(order: Order): { code: string }[] {
    const matches: { code: string }[] = [];

    // Loyalty discount
    if (order.customer.loyaltyYears > 5) matches.push({ code: 'LOYALTY10' });

    // Bulk discount
    if (order.quantity > 100) matches.push({ code: 'BULK15' });

    // Seasonal discount
    if (monthName(order.date) === 'December') matches.push({ code: 'HOLIDAY20' });

    return matches;
  }
}
```

### Collect Sum

Sum a numeric property across all matches:

```typescript
export class TotalDiscount extends DecisionTable {
  evaluate(order: Order): number {
    const matches: { discount: number }[] = [];

    if (order.customer.loyaltyYears > 5) matches.push({ discount: 10 });
    if (order.quantity > 100) matches.push({ discount: 15 });
    if (order.isHoliday) matches.push({ discount: 5 });

    return sum(matches, 'discount');
  }
}
```

### Collect Min

Get the minimum value of a numeric property across all matches:

```typescript
export class LowestRate extends DecisionTable {
  evaluate(applicant: Applicant): number {
    const matches: { rate: number }[] = [];

    if (applicant.hasPromo) matches.push({ rate: 3.5 });
    if (applicant.creditScore > 750) matches.push({ rate: 4.0 });
    if (applicant.isEmployee) matches.push({ rate: 3.0 });

    return min(matches, 'rate');
  }
}
```

### Collect Max

Get the maximum value of a numeric property across all matches:

```typescript
return max(matches, 'value');
```

### Collect Count

Count the number of matching rules:

```typescript
return count(matches);
```

## Helper Functions

### between

Check if a value is within a range (inclusive):

```typescript
import { between } from "@apexdesigner/dsl/decision-table";

if (between(income, 10000, 50000)) // true when 10000 <= income <= 50000
```

### in

Check if a value is in a set:

```typescript
import { in as isIn } from "@apexdesigner/dsl/decision-table";

if (isIn(status, ['Active', 'Pending', 'Review'])) // true when status matches any
```

### not

Negate a condition:

```typescript
import { not, between } from "@apexdesigner/dsl/decision-table";

if (not(between(age, 18, 65))) // true when age < 18 or age > 65
```

### monthNumber

Get the month as a 1-based number (1-12):

```typescript
import { monthNumber } from "@apexdesigner/dsl/decision-table";

if (monthNumber(order.date) === 12) // true in December
```

### monthName

Get the full month name:

```typescript
import { monthName } from "@apexdesigner/dsl/decision-table";

if (monthName(order.date) === 'December')
```

### monthAbbr

Get the abbreviated month name:

```typescript
import { monthAbbr } from "@apexdesigner/dsl/decision-table";

if (monthAbbr(order.date) === 'Dec')
```

### sum

Sum a numeric property across matches:

```typescript
import { sum } from "@apexdesigner/dsl/decision-table";

return sum(matches, 'discount'); // sum of all discount values
```

### min

Get the minimum value of a numeric property:

```typescript
import { min } from "@apexdesigner/dsl/decision-table";

return min(matches, 'rate'); // lowest rate value
```

### max

Get the maximum value of a numeric property:

```typescript
import { max } from "@apexdesigner/dsl/decision-table";

return max(matches, 'value'); // highest value
```

### count

Count the number of matches:

```typescript
import { count } from "@apexdesigner/dsl/decision-table";

return count(matches); // number of matching rules
```

## Rule Annotations

Use JSDoc comments to document rules. These appear in the generated decision table UI:

```typescript
export class ShippingCost extends DecisionTable {
  evaluate(order: Order): { cost: number; method: string } {
    const matches: { cost: number; method: string }[] = [];

    /** Free shipping for orders over $100 */
    if (order.total > 100) matches.push({ cost: 0, method: 'Standard' });

    /** Express shipping for priority customers */
    if (order.customer.isPriority) matches.push({ cost: 5, method: 'Express' });

    /** Default ground shipping */
    if (order.total <= 100) matches.push({ cost: 8, method: 'Ground' });

    return unique(matches);
  }
}
```
