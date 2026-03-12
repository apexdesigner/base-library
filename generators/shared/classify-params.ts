import { kebabCase } from 'change-case';

export interface BehaviorParam {
  name: string;
  type: string;
  isOptional: boolean;
}

export interface ClassifiedParam extends BehaviorParam {
  source: 'path' | 'header' | 'body';
  /** For header params, the kebab-case header name */
  headerName?: string;
  /** For header params, the inner type (e.g. string from Header<string>) */
  innerType?: string;
}

export interface ClassifiedParams {
  all: ClassifiedParam[];
  path: ClassifiedParam[];
  header: ClassifiedParam[];
  body: ClassifiedParam[];
}

/**
 * Classify behavior parameters by their source: path, header, or body.
 *
 * - Path params: names matching `:paramName` tokens in the route path
 * - Header params: type starts with `Header<`
 * - Body params: everything else
 */
export function classifyBehaviorParams(params: BehaviorParam[], path?: string): ClassifiedParams {
  // Extract :paramName tokens from path
  const pathParamNames = new Set<string>();
  if (path) {
    for (const match of path.matchAll(/:(\w+)/g)) {
      pathParamNames.add(match[1]);
    }
  }

  const all: ClassifiedParam[] = [];
  const pathParams: ClassifiedParam[] = [];
  const headerParams: ClassifiedParam[] = [];
  const bodyParams: ClassifiedParam[] = [];

  for (const param of params) {
    if (pathParamNames.has(param.name)) {
      const classified: ClassifiedParam = { ...param, source: 'path' };
      all.push(classified);
      pathParams.push(classified);
    } else if (param.type?.startsWith('Header<')) {
      const innerType = param.type.slice(7, -1);
      const classified: ClassifiedParam = {
        ...param,
        source: 'header',
        headerName: kebabCase(param.name),
        innerType
      };
      all.push(classified);
      headerParams.push(classified);
    } else {
      const classified: ClassifiedParam = { ...param, source: 'body' };
      all.push(classified);
      bodyParams.push(classified);
    }
  }

  return { all, path: pathParams, header: headerParams, body: bodyParams };
}
