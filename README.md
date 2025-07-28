# Apex Designer Base Library

A foundational library for Apex Designer applications containing essential base types, interface definitions, and user management components.

## Features

- **Base Types**: Complete set including Any, String, Number, Boolean, Email, Phone, URL, Date, etc.
- **Interface Definitions**: Context, Filter, Where, WhereCondition for query operations
- **User Management**: User, Role, and UserRole business objects with full CRUD operations
- **Library Package**: Designed to be consumed by other Apex Designer projects

## Installation

```bash
npm install @apexdesigner/base-library
```

## Usage

This library is designed to be imported as a dependency in other Apex Designer projects:

```json
{
  "designDependencies": [
    {
      "package": "@apexdesigner/base-library",
      "versionSelector": "^1.0.0",
      "developmentOnly": false
    }
  ]
}
```

## Components

### Base Types
- Any, String, Number, Boolean
- Email, Phone, URL, PostalCode
- Date, DateWithoutTime
- MultilineString, Object, Percentage

### Interface Definitions
- **Context**: Server-side call stack context with request/response
- **Filter**: Query filtering with where, order, fields, include, limit, offset
- **Where**: Logical AND/OR query conditions
- **WhereCondition**: Field-level comparison operators (eq, neq, gt, lt, in, etc.)

### Business Objects
- **User**: Basic user with email
- **Role**: System roles with name and description
- **UserRole**: Junction table linking users to roles

## License

MIT
