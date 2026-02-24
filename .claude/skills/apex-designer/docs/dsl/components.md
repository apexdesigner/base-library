# Components

A component is a reusable UI element. Component files are named `<name>.component.ts` and by default are created in `design/components/`.

## Class

A component file exports a class that extends `Component`. The class name uses the entity name with a `Component` suffix (e.g., `StudentCardComponent`).
```typescript
// student-card.component.ts

import { Component } from "@apexdesigner/dsl/component";

export class StudentCardComponent extends Component {}
```

## Component Decorator

The `@component()` decorator is optional. Use it when the component needs special behavior. The selector is derived from the class name in kebab-case.

### Custom Element

Set `isCustomElement` to generate a web component (custom element):

```typescript
@component({ isCustomElement: true })
export class StudentCardComponent extends Component {}
```

### Dialog

Set `isDialog` to mark the component as a dialog/modal:

```typescript
@component({ isDialog: true })
export class ConfirmDeleteComponent extends Component {}
```

### Allow Children

Set `allowChildren` to indicate the component accepts nested child content:

```typescript
@component({ allowChildren: true })
export class CardComponent extends Component {}
```

This tells the generator (and editor tooling) that other components and content can be projected inside this component.

To access specific child component types programmatically, declare a property typed as an array of that component. Use `onChangeCall` to react when children change:

```typescript
import { Component, component, property } from "@apexdesigner/dsl/component";
import { BreadcrumbLevelComponent } from "@components";

@component({ allowChildren: true })
export class BreadcrumbComponent extends Component {

  @property({ onChangeCall: "onLevelsChanged" })
  levels: BreadcrumbLevelComponent[];

  onLevelsChanged(): void {
    // runs whenever child components are added or removed
  }

}
```

## Properties

Properties are declared as class members. Use `@property()` only when configuration is needed.

### Data Properties

Business object properties are typed using generated client types from `@business-objects-client`. `read`, `save`, read options, property triggers, and form field options work the same as [pages](pages.md#data-properties).

```typescript
import { property } from "@apexdesigner/dsl/component";
import { StudentFormGroup } from "@business-objects-client";

export class StudentCardComponent extends Component {

  @property({ read: "Automatically", save: "Automatically" })
  student!: StudentFormGroup;

}
```

### Input and Output Properties

Use `isInput` for properties passed in from a parent page or component:

```typescript
export class StudentCardComponent extends Component {

  @property({ isInput: true })
  student!: StudentFormGroup;

}
```

Use `isOutput` for event properties emitted to the parent:

```typescript
export class StudentCardComponent extends Component {

  @property({ isOutput: true })
  onSelect!: EventEmitter<StudentFormGroup>;

}
```

Set both for two-way binding. The resolver automatically adds a `<name>Change` output property:

```typescript
export class StudentCardComponent extends Component {

  @property({ isInput: true, isOutput: true })
  student!: StudentFormGroup;
  studentChange: EventEmitter<StudentFormGroup> // automatically added by the resolver

}
```

### Service Injection

Services are injected as properties:

```typescript
import { AuthService } from "@services";

export class StudentCardComponent extends Component {

  authService!: AuthService;

}
```

## Methods

Methods are declared as class members. Use `@method()` only when configuration is needed.

Lifecycle hooks, debounce, and `exposedToParent` work the same as [pages](pages.md#methods).

```typescript
import { method } from "@apexdesigner/dsl/component";

export class StudentCardComponent extends Component {

  @method({ callOnLoad: true })
  async initialize(): Promise<void> {
    // ...
  }

}
```

## Template

Use `applyTemplate()` after the class to define the component markup. See [templates](templates.md) for the full template syntax reference.

```typescript
import { Component, property, applyTemplate } from "@apexdesigner/dsl/component";
import { StudentFormGroup } from "@business-objects-client";

export class StudentCardComponent extends Component {

  @property({ isInput: true })
  student!: StudentFormGroup;

}

applyTemplate(StudentCardComponent, `
  <apex-flex-column>
    <h3>{{student.firstName}} {{student.lastName}}</h3>
    <span>{{student.email}}</span>
  </apex-flex-column>
`);
```

## Styles

Use `applyStyles()` for component-specific CSS:

```typescript
import { Component, applyStyles } from "@apexdesigner/dsl/component";

export class StudentCardComponent extends Component {}

applyStyles(StudentCardComponent, `
  :host {
    display: flex;
    flex-direction: column;
  }
`);
```

## Complete Example

```typescript
import { Component, property, method, applyTemplate, applyStyles } from "@apexdesigner/dsl/component";
import { StudentFormGroup } from "@business-objects-client";
import { AuthService } from "@services";

export class StudentCardComponent extends Component {

  @property({ isInput: true })
  student!: StudentFormGroup;

  @property({ isOutput: true })
  onSelect!: EventEmitter<StudentFormGroup>;

  isAdmin!: boolean;

  authService!: AuthService;

  @method({ callOnLoad: true })
  async initialize(): Promise<void> {
    this.isAdmin = await this.authService.hasRole("Administrator");
  }

  selectStudent(): void {
    this.onSelect.emit(this.student);
  }

}

applyTemplate(StudentCardComponent, `
  <apex-flex-column (click)="selectStudent()">
    <h3>{{student.firstName}} {{student.lastName}}</h3>
    <span>{{student.email}}</span>
    <if condition="isAdmin">
      <apex-delete-button [object]="student"></apex-delete-button>
    </if>
  </apex-flex-column>
`);

applyStyles(StudentCardComponent, `
  :host {
    display: flex;
    flex-direction: column;
    cursor: pointer;
  }
`);
```
