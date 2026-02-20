/**
 * Project generators for ad3-supplier-management
 */

// @types generators
export { dataSourceTypeGenerator } from "./@types/data-source-type.generator.js";
export { businessObjectTypeGenerator } from "./@types/business-object-type.generator.js";
export { pageTypeGenerator } from "./@types/page-type.generator.js";
export { businessObjectClientTypeGenerator } from "./@types/business-object-client-type.generator.js";
export { mixinTypeGenerator } from "./@types/mixin-type.generator.js";
export { designTsconfigGenerator } from "./@types/design-tsconfig.generator.js";
export { businessObjectFormGroupTypeGenerator } from "./@types/business-object-form-group-type.generator.js";
export { componentTypeGenerator } from "./@types/component-type.generator.js";

// Client generators
export { persistedFormGroupGenerator } from "./client/persisted-form-group.generator.js";
export { businessObjectBaseGenerator } from "./client/business-object-base.generator.js";
export { businessObjectClientGenerator } from "./client/business-object-client.generator.js";
export { clientPackageGenerator } from "./client/client-package.generator.js";
export { clientTsconfigGenerator } from "./client/client-tsconfig.generator.js";
export { clientAngularJsonGenerator } from "./client/client-angular-json.generator.js";
export { clientIndexHtmlGenerator } from "./client/client-index-html.generator.js";
export { clientRoutesGenerator } from "./client/client-routes.generator.js";
export { pageComponentGenerator } from "./client/page-component.generator.js";
export { componentGenerator } from "./client/component.generator.js";
export { clientMainGenerator } from "./client/client-main.generator.js";
export { clientAppConfigGenerator } from "./client/client-app-config.generator.js";
export { clientStylesGenerator } from "./client/client-styles.generator.js";
export { clientProxyConfigGenerator } from "./client/client-proxy-config.generator.js";
export { businessObjectFormGroupGenerator } from "./client/business-object-form-group.generator.js";

// Server generators
export { serverGenerator } from "./server/server.generator.js";
export { serverTsconfigGenerator } from "./server/server-tsconfig.generator.js";
export { serverPackageGenerator } from "./server/server-package.generator.js";
export { dataSourceGenerator } from "./server/data-source.generator.js";
export { businessObjectSchemaGenerator } from "./server/business-object-schema.generator.js";
export { businessObjectGenerator } from "./server/business-object.generator.js";
export { businessObjectRouteGenerator } from "./server/business-object-route.generator.js";
export { routesIndexGenerator } from "./server/routes-index.generator.js";
export { appBehaviorGenerator } from "./server/app-behavior.generator.js";
