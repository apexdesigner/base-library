import createDebug from 'debug';
import { getClassByBase, getClassDecorator } from '@apexdesigner/utilities';
import type { Validator } from '@apexdesigner/validator';

const debug = createDebug('ApexDesignerValidator:schemaFormComponent');

const REQUIRED_FIELD_INPUTS = ['control'];
const OPTIONAL_FIELD_INPUTS = ['label', 'placeholder', 'hideHelpText'];

const REQUIRED_SECTION_INPUTS = ['group'];
const OPTIONAL_SECTION_INPUTS = ['hideHelpTexts', 'placeholders'];

export const schemaFormComponent: Validator = {
  name: 'schema-form-component',
  appliesTo: ['Component'],
  validate(metadata, context, _fix): void {
    const compClass = getClassByBase(metadata.sourceFile, 'Component');
    if (!compClass) return;

    const opts = getClassDecorator(compClass, 'component');
    if (!opts) return;

    const fieldFormat = opts.fieldFormat as string | undefined;
    const sectionEntity = opts.sectionEntity;

    if (!fieldFormat && !sectionEntity) return;

    // Collect input property names
    const inputProps = new Set<string>();
    for (const prop of compClass.getProperties()) {
      const decorator = prop.getDecorator('property');
      if (!decorator) continue;
      const args = decorator.getArguments();
      if (args.length > 0 && args[0].getText().includes('isInput')) {
        inputProps.add(prop.getName());
      }
    }

    debug('component %s, fieldFormat %s, sectionEntity %s, inputs %j', metadata.name, fieldFormat, sectionEntity, [...inputProps]);

    if (fieldFormat) {
      for (const required of REQUIRED_FIELD_INPUTS) {
        if (!inputProps.has(required)) {
          context.addDiagnostic({
            code: 'MISSING_FIELD_INPUT',
            message: `fieldFormat component "${metadata.name}" is missing required input "${required}"`,
            path: metadata.path,
            severity: 'error',
          });
        }
      }
      for (const optional of OPTIONAL_FIELD_INPUTS) {
        if (!inputProps.has(optional)) {
          context.addDiagnostic({
            code: 'MISSING_FIELD_INPUT',
            message: `fieldFormat component "${metadata.name}" is missing recommended input "${optional}" — sf-field passes this to all field components`,
            path: metadata.path,
            severity: 'warning',
          });
        }
      }
    }

    if (sectionEntity) {
      for (const required of REQUIRED_SECTION_INPUTS) {
        if (!inputProps.has(required)) {
          context.addDiagnostic({
            code: 'MISSING_SECTION_INPUT',
            message: `sectionEntity component "${metadata.name}" is missing required input "${required}"`,
            path: metadata.path,
            severity: 'error',
          });
        }
      }
      for (const optional of OPTIONAL_SECTION_INPUTS) {
        if (!inputProps.has(optional)) {
          context.addDiagnostic({
            code: 'MISSING_SECTION_INPUT',
            message: `sectionEntity component "${metadata.name}" is missing recommended input "${optional}" — sf-section passes this to all section components`,
            path: metadata.path,
            severity: 'warning',
          });
        }
      }
    }
  },
};
