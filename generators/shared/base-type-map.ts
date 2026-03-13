import type { GenerationContext } from '@apexdesigner/generator';
import { getClassByBase } from '@apexdesigner/utilities';

/**
 * Build a map from base type name to its underlying native type.
 * e.g. Uuid → string, Json → any, Currency → number
 */
export function buildBaseTypeMap(context: GenerationContext): Map<string, string> {
  const map = new Map<string, string>();
  for (const bt of context.listMetadata('BaseType')) {
    const btClass = getClassByBase(bt.sourceFile, 'BaseType');
    if (!btClass) continue;
    const heritage = btClass.getExtends();
    if (!heritage) continue;
    const typeArgs = heritage.getTypeArguments();
    if (typeArgs.length > 0) {
      map.set(btClass.getName() || '', typeArgs[0].getText());
    }
  }
  return map;
}

/**
 * Resolve a property type through the base type map.
 * Uses the type node text (source-level name) to avoid resolved import paths.
 * Strips `| undefined` and resolves base types to their native type.
 */
export function resolvePropertyType(
  prop: { getTypeNode(): { getText(): string } | undefined; getType(): { getText(): string } },
  baseTypeMap: Map<string, string>
): string {
  let propType = prop.getTypeNode()?.getText() || prop.getType().getText();
  propType = propType.replace(' | undefined', '');
  return baseTypeMap.get(propType) || propType;
}
