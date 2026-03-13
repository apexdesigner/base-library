/**
 * Project generators for ad3-supplier-management
 */

// @types generators
export { dataSourceTypeGenerator } from './@types/data-source-type.generator.js';
export { businessObjectTypeGenerator } from './@types/business-object-type.generator.js';
export { pageTypeGenerator } from './@types/page-type.generator.js';
export { businessObjectClientTypeGenerator } from './@types/business-object-client-type.generator.js';
export { mixinTypeGenerator } from './@types/mixin-type.generator.js';
export { businessObjectFormGroupTypeGenerator } from './@types/business-object-form-group-type.generator.js';
export { componentTypeGenerator } from './@types/component-type.generator.js';
export { serviceTypeGenerator } from './@types/service-type.generator.js';

// Client generators
export { persistedFormGroupGenerator } from './client/persisted-form-group.generator.js';
export { businessObjectClientGenerator } from './client/business-object-client.generator.js';
export { clientPackageGenerator } from './client/client-package.generator.js';
export { clientAngularJsonGenerator } from './client/client-angular-json.generator.js';
export { clientIndexHtmlGenerator } from './client/client-index-html.generator.js';
export { clientRoutesGenerator } from './client/client-routes.generator.js';
export { pageComponentGenerator } from './client/page-component.generator.js';
export { componentGenerator } from './client/component.generator.js';
export { clientAppConfigGenerator } from './client/client-app-config.generator.js';
export { clientStylesGenerator } from './client/client-styles.generator.js';
export { businessObjectFormGroupGenerator } from './client/business-object-form-group.generator.js';
export { serviceGenerator } from './client/service.generator.js';
export { componentServiceGenerator } from './client/component-service.generator.js';
export { businessObjectServiceGenerator } from './client/business-object-service.generator.js';
export { appServiceGenerator } from './client/app-service.generator.js';
export { clientProviderGenerator } from './client/client-provider.generator.js';
export { clientInterceptorGenerator } from './client/client-interceptor.generator.js';
export { clientGuardGenerator } from './client/client-guard.generator.js';
export { clientInterfaceDefinitionsGenerator } from './client/client-interface-definitions.generator.js';
// Server generators
export { serverGenerator } from './server/server.generator.js';
export { serverPackageGenerator } from './server/server-package.generator.js';
export { dataSourceGenerator } from './server/data-source.generator.js';
export { businessObjectSchemaGenerator } from './server/business-object-schema.generator.js';
export { businessObjectGenerator } from './server/business-object.generator.js';
export { businessObjectRouteGenerator } from './server/business-object-route.generator.js';
export { appBehaviorRouteGenerator } from './server/app-behavior-route.generator.js';
export { routesIndexGenerator } from './server/routes-index.generator.js';
export { appGenerator } from './server/app.generator.js';
export { appLifecycleGenerator } from './server/app-lifecycle.generator.js';
export { boAfterStartGenerator } from './server/bo-after-start.generator.js';
export { businessObjectTestGenerator } from './server/business-object-test.generator.js';
export { appTestGenerator } from './server/app-test.generator.js';
export { appLifecycleTestGenerator } from './server/app-lifecycle-test.generator.js';
export { roleDefinitionsGenerator } from './server/role-definitions.generator.js';
export { interfaceDefinitionSchemaGenerator } from './server/interface-definition-schema.generator.js';
export { publicRoutesGenerator } from './server/public-routes.generator.js';
export { serverInterfaceDefinitionsGenerator } from './server/server-interface-definitions.generator.js';
export { serverFunctionGenerator } from './server/function.generator.js';
export { functionTestGenerator } from './server/function-test.generator.js';
export { boFilterGenerator } from './server/bo-filter.generator.js';
export { designTsconfigGenerator } from './design-tsconfig.generator.js';
