# Testing

The testing directory provides business objects, pages, components, and behaviors used to exercise the base library's generators and runtime features.

## Data Sources

The [test postgres](data-sources/test-postgres.data-source.ts) data source connects to a PostgreSQL database for persistence testing. The [test file](data-sources/test-file.data-source.ts) data source uses file-based storage.

## Business Objects

The [Test Item](business-objects/test-item/test-item.business-object.ts) business object is the primary entity used across tests. It has a [startup](business-objects/test-item/test-item.startup.behavior.ts) behavior for lifecycle testing, a [process](business-objects/test-item/test-item.process.behavior.ts) behavior for workflow testing, and an [after read](business-objects/test-item/test-item.after-read.behavior.ts) behavior that verifies the afterRead lifecycle hook fires on find, findOne, and findById. The [export](business-objects/test-item/test-item.export.behavior.ts) instance behavior tests GET with a Header parameter. The [search by category](business-objects/test-item/test-item.search-by-category.behavior.ts) class behavior tests POST with a path parameter, Header parameter, and body parameter via a custom route path.

The [Test Category](business-objects/test-category/test-category.business-object.ts) business object provides a parent entity for hierarchical relationships. The [Test Item Detail](business-objects/test-item-detail/test-item-detail.business-object.ts) business object provides a child entity for one-to-many testing. The [Test Assignment](business-objects/test-assignment/test-assignment.business-object.ts) business object tests many-to-many join patterns. The [Test Setting](business-objects/test-setting/test-setting.business-object.ts) business object tests singleton-style records.

## App Behaviors

The [admin report](app-behaviors/admin-report.app-behavior.ts) app behavior tests role-protected API routes. The [system health check](app-behaviors/system-health-check.app-behavior.ts) app behavior tests public health endpoints. The [slow operation](app-behaviors/slow-operation.app-behavior.ts) app behavior validates the addTest timeout option with a 7-second wait and 10-second timeout. The [lookup by category](app-behaviors/lookup-by-category.app-behavior.ts) app behavior tests GET with a path parameter and Header parameter. The [submit with token](app-behaviors/submit-with-token.app-behavior.ts) app behavior tests POST with a Header parameter and body parameter.

## Roles

The [editor](roles/editor.role.ts) and [viewer](roles/viewer.role.ts) roles test role-based access control.

## Pages

The [home](pages/home.page.ts) page is the default landing page. The [test items](pages/test-items.page.ts) and [test item](pages/test-item.page.ts) pages test list and detail views. The [test categories](pages/test-categories.page.ts) and [test category](pages/test-category.page.ts) pages test parent entity views. The [test settings](pages/test-settings.page.ts) and [test setting](pages/test-setting.page.ts) pages test singleton views. The [test select fields](pages/test-select-fields.page.ts) page tests the select-user and select-role form fields. The [manage roles](pages/manage-roles.page.ts) page tests the role assignment UI. The [test](pages/test.page.ts) page serves as a general test harness. The [service test sender](pages/service-test-sender.page.ts) and [service test receiver](pages/service-test-receiver.page.ts) pages test inter-service communication.

## Services and Components

The [test item tracker](services/test-item-tracker.service.ts) service tests client-side state management. The [test dialog](components/test-dialog.component.ts) component tests dialog interactions.
