# Validators

Validators check design source files and report diagnostics. They can automatically fix issues when called with `fix: true`.

## How Validators Work

A validator is called with:

- The design item being validated
- A context with access to in-memory caches of all design items
- An optional `fix: true` flag

The validator returns:

- **Diagnostics**, each indicating whether the issue can be auto-fixed. When called with `fix: true`, fixable issues are applied automatically by updating the design source file.
- **Affected items** that should be re-validated when a fix may affect them. For example, if a data source's `defaultIdType` changes, all business objects using that data source are returned as needing validation.

## Extensibility

A baseline set of validators ships with the core module. [Libraries](project.md#design-dependencies) can define additional validators.
Libraries and applications can override validators from dependencies by using the same name.

## Code Completion and Validation

These validators auto-complete design source by filling in what can be inferred from the design, so the developer doesn't have to write boilerplate. They also validate existing values and correct them when they don't match the expected type.

### Id Property

Adds an `id` property to business objects that don't have one. The type is determined by checking the business object's data source `defaultIdType`, falling back to the project's default data source, then to `number`.

```typescript
// before
export class Student extends BusinessObject {
  firstName?: string;
}

// after fix (data source has defaultIdType = Number)
export class Student extends BusinessObject {
  id!: number;

  firstName?: string;
}
```

Custom IDs marked with `@property({ isId: true })` are preserved.

### Foreign Keys

Adds foreign key properties for "Belongs To" and "References" relationships. The property is added after the relationship with a type matching the related business object's id type and a name of `{relationshipName}Id`.

```typescript
// before
export class Student extends BusinessObject {
  organization?: Organization;
}

// after fix (Organization has id: number)
export class Student extends BusinessObject {
  organization?: Organization;
  organizationId!: number;
}
```

Custom foreign key names specified with `@relationship({ foreignKey: "name" })` are used.

### Relationship Pairs

Adds the inverse side of a relationship on the related business object. The inverse defaults to "Has Many". Use `pairedType` on the defining side to control the inverse relationship type (see [business objects](business-objects.md#relationships)).

```typescript
// student.ts before
export class Student extends BusinessObject {
  organization?: Organization;
}

// organization.ts after fix
export class Organization extends BusinessObject {
  students?: Student[];
}
```

### Two-Way Binding

Adds a `<name>Change` EventEmitter for [component](components.md) properties with both `isInput` and `isOutput`.

```typescript
// before
export class StudentCardComponent extends Component {
  @property({ isInput: true, isOutput: true })
  student!: StudentFormGroup;
}

// after fix
export class StudentCardComponent extends Component {
  @property({ isInput: true, isOutput: true })
  student!: StudentFormGroup;
  studentChange: EventEmitter<StudentFormGroup>
}
```

### Template References

Adds properties and methods to a [page](pages.md) or [component](components.md) class when they are referenced in the [template](templates.md) but not declared on the class.

#### Missing Property

```typescript
// before
export class StudentsPage extends Page {

}

applyTemplate(StudentsPage, `
  <input [value]="searchText" />
`);

// after fix
export class StudentsPage extends Page {

  searchText!: string;

}
```

#### Missing Method

```typescript
// before
export class StudentsPage extends Page {

}

applyTemplate(StudentsPage, `
  <button (click)="search()">Search</button>
`);

// after fix
export class StudentsPage extends Page {

  search(): void {
  }

}
```

#### HTML Element Reference

```typescript
// before
export class StudentsPage extends Page {

}

applyTemplate(StudentsPage, `
  <input #searchInput type="text" />
`);

// after fix
export class StudentsPage extends Page {

  searchInput!: HTMLInputElement;

}
```

#### HTML Element Array Reference

```typescript
// before
export class StudentsPage extends Page {

}

applyTemplate(StudentsPage, `
  <for const="item" of="items">
    <input #itemInputs type="text" />
  </for>
`);

// after fix
export class StudentsPage extends Page {

  itemInputs!: HTMLInputElement[];

}
```

#### Component Reference

```typescript
// before
export class StudentsPage extends Page {

}

applyTemplate(StudentsPage, `
  <students-section #studentsSection [students]="students"></students-section>
`);

// after fix
import { StudentsSectionComponent } from "@components";

export class StudentsPage extends Page {

  studentsSection!: StudentsSectionComponent;

}
```

#### Component Array Reference

```typescript
// before
export class StudentsPage extends Page {

}

applyTemplate(StudentsPage, `
  <for const="student" of="students">
    <student-card #studentCards [student]="student"></student-card>
  </for>
`);

// after fix
import { StudentCardComponent } from "@components";

export class StudentsPage extends Page {

  studentCards!: StudentCardComponent[];

}
```

## Check-Only Validators

These validators report diagnostics without auto-fixing.

### Duplicate Routes

Reports an error when two [pages](pages.md) have the same `path`.

### Missing Data Source

Reports an error when a [business object](business-objects.md) has no [data source](data-sources.md) and no data source has [`isDefault`](data-sources.md#default-data-source) set. Only applies to non-library projects.

## Library Validators

Libraries can provide additional validators. These are examples of opinionated validators that could be provided by a [library](project.md#design-dependencies).

### Debug Server

Adds `npm debug` instrumentation to [behaviors](behaviors.md) and [app behaviors](app-behaviors.md). Creates a class-level debugger and method-level extensions.

```typescript
// before
addBehavior(
  Student,
  { type: "Before Create" },
  async function setDefaults(student: Partial<Student>) {
    if (!student.created) {
      student.created = new Date();
    }
  },
);

// after fix
const Debug = createDebug("MyApp:Student");

addBehavior(
  Student,
  { type: "Before Create" },
  async function setDefaults(student: Partial<Student>) {
    const debug = Debug.extend("setDefaults");
    debug('student %j',student);

    if (!student.created) {
      student.created = new Date();
      debug('student.created %j',student.created);
    }
  },
);
```

### Debug Client

Adds `npm debug` instrumentation to [pages](pages.md), [components](components.md), and [services](services.md). Creates a class-level debugger and method-level extensions.

```typescript
// before
export class OrganizationPage extends Page {

  @method({ callOnLoad: true })
  async initialize(): Promise<void> {
    this.isAdmin = await this.authService.hasRole("Administrator");
  }

}

// after fix
const Debug = createDebug("OrganizationPage");

export class OrganizationPage extends Page {

  @method({ callOnLoad: true })
  async initialize(): Promise<void> {
    const debug = Debug.extend("initialize");

    this.isAdmin = await this.authService.hasRole("Administrator");
    debug('this.isAdmin',this.isAdmin);
  }

}
```
