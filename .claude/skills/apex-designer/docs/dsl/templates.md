# Templates

Templates define the markup for [pages](pages.md) and [components](components.md). They are set using `applyTemplate()` after the class body.

```typescript
applyTemplate(StudentCardComponent, `
  <flex-column>
    <h3>{{student.firstName}} {{student.lastName}}</h3>
  </flex-column>
`);
```

## Text Interpolation

Use `{{}}` to render dynamic values:

```html
<span>{{student.firstName}} {{student.lastName}}</span>
<span>Item {{index + 1}} of {{total}}</span>
```

## Static Values

Plain attributes pass static string values:

```html
<mat-progress-bar mode="indeterminate"></mat-progress-bar>
<apex-breadcrumb-level label="Organizations" path="/organizations"></apex-breadcrumb-level>
<mat-icon class="material-icons-outlined">edit</mat-icon>
```

## Value Binding

Use `[]` to bind a property to an expression:

```html
<apex-breadcrumb-level [label]="organization.name"></apex-breadcrumb-level>
<flex-row [grow]="true" [gap]="40"></flex-row>
<apex-delete-button [object]="organization" afterDeleteRoute="/organizations"></apex-delete-button>
```

Class and style bindings:

```html
<div [class.active]="isActive"></div>
<div [class.first]="isFirst" [class.last]="isLast"></div>
<div [style.width.px]="columnWidth"></div>
```

## Triggers

Use `()` to bind to events:

```html
<button (click)="save()">Save</button>
<input (keyup.enter)="search()" />
<flex-column (scroll)="onScroll($event)">...</flex-column>
```

## Two-Way Binding

Use `[()]` to bind a property in both directions. This combines a value binding with a change trigger:

```html
<student-card [(student)]="selectedStudent"></student-card>
```

This is equivalent to:

```html
<student-card [student]="selectedStudent" (studentChange)="selectedStudent = $event"></student-card>
```

Two-way binding works with components that declare a property with both `isInput` and `isOutput`. See [component input and output properties](components.md#input-and-output-properties).

## Template References

Use `#` to create a camelCase reference to an element or component. The [template references validator](validators.md#template-references) adds the corresponding property to the class.

### HTML Element

```html
<input #searchInput type="text" />
<button (click)="searchInput.focus()">Focus</button>
```

### HTML Element Array

A reference inside a `<for>` loop creates an array:

```html
<for const="item" of="items">
  <input #itemInputs type="text" />
</for>
```

### Component

```html
<students-section #studentsSection [students]="students"></students-section>
<button (click)="studentsSection.refresh()">Refresh</button>
```

Component references can be used to call [exposed methods](pages.md#exposed-to-parent) on child components.

### Component Array

A reference inside a `<for>` loop creates an array:

```html
<for const="student" of="students">
  <student-card #studentCards [student]="student"></student-card>
</for>
```

## Control Flow

### Conditional Rendering

```html
<if condition="user.isActive">
  <div>User is active</div>
</if>
```

With else:

```html
<if condition="user.isActive">
  <div>User is active</div>
  <else>
    <div>User is inactive</div>
  </else>
</if>
```

With else-if:

```html
<if condition="status === 'active'">
  <div>Active</div>
  <else-if condition="status === 'pending'">
    <div>Pending</div>
  </else-if>
  <else>
    <div>Unknown status</div>
  </else>
</if>
```

### Loops

```html
<for const="item" of="items">
  <div>{{item.name}}</div>
</for>
```

With trackBy:

```html
<for const="item" of="items" trackBy="item.id">
  <div>{{item.name}}</div>
</for>
```

With index:

```html
<for const="item" of="items" index="i">
  <div>{{i}}: {{item.name}}</div>
</for>
```

With all special variables:

```html
<for
  const="item"
  of="items"
  index="i"
  first="isFirst"
  last="isLast"
  odd="isOdd"
  even="isEven"
  count="total">
  <div [class.first]="isFirst" [class.odd]="isOdd">
    Item {{i + 1}} of {{total}}: {{item.name}}
  </div>
</for>
```

Available special variable attributes:

- `index` — zero-based index
- `first` — boolean, true for first item
- `last` — boolean, true for last item
- `odd` — boolean, true for odd indices
- `even` — boolean, true for even indices
- `count` — total number of items

With empty state:

```html
<for const="item" of="items">
  <div>{{item.name}}</div>
  <when-empty>
    <div>No items to display</div>
  </when-empty>
</for>
```

### Switch

```html
<switch expression="status">
  <case valueExpression="'active'">
    <div>Status is active</div>
  </case>
  <case valueExpression="'pending'">
    <div>Status is pending</div>
  </case>
  <default>
    <div>Unknown status</div>
  </default>
</switch>
```