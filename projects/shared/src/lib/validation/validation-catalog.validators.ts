import { AbstractControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { ValidationCatalogKey, VALIDATION_CATALOG, ValidationRule } from './validation-catalog';

function decimalCount(value: number): number {
  const text = value.toString();
  const dot = text.indexOf('.');
  return dot === -1 ? 0 : text.length - dot - 1;
}

function validatorsForRule(rule: ValidationRule): ValidatorFn[] {
  switch (rule.kind) {
    case 'string': {
      const validators: ValidatorFn[] = [];
      if (rule.minLength !== undefined) {
        validators.push(Validators.minLength(rule.minLength));
      }
      if (rule.maxLength !== undefined) {
        validators.push(Validators.maxLength(rule.maxLength));
      }
      return validators;
    }
    case 'pattern':
      return [Validators.pattern(new RegExp(rule.pattern))];
    case 'number': {
      const validators: ValidatorFn[] = [];
      if (rule.min !== undefined) {
        validators.push(Validators.min(rule.min));
      }
      if (rule.max !== undefined) {
        validators.push(Validators.max(rule.max));
      }
      if (rule.maxDecimals !== undefined) {
        const maxDecimals = rule.maxDecimals;
        validators.push((control: AbstractControl): ValidationErrors | null => {
          const value = control.value;
          if (value === null || value === undefined || value === '') {
            return null;
          }
          return decimalCount(Number(value)) > maxDecimals
            ? { maxDecimals: { maxDecimals } }
            : null;
        });
      }
      return validators;
    }
  }
}

/**
 * The "validator factory" §27 calls for: turns a named `VALIDATION_CATALOG`
 * entry into Angular `ValidatorFn`s, so every form mirrors the same rule the
 * server enforces without re-typing the regex/length/range at each call site.
 */
export function catalogValidators(key: ValidationCatalogKey): ValidatorFn[] {
  return validatorsForRule(VALIDATION_CATALOG[key]);
}

/** Convenience: `Validators.required` plus the named catalog rule's validators, composed. */
export function requiredCatalogValidators(key: ValidationCatalogKey): ValidatorFn[] {
  return [Validators.required, ...catalogValidators(key)];
}

/**
 * Cross-field rule mirroring `CreateLeadCommandValidator`'s "at least one of
 * phone/email required" (and the identical rule in `CaptureWebToLeadCommandValidator`).
 * Attach at the `FormGroup` level; the error key is `atLeastOneRequired`.
 */
export function atLeastOneRequired(...controlNames: string[]): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const hasValue = controlNames.some((name) => {
      const value = group.get(name)?.value;
      return value !== null && value !== undefined && String(value).trim().length > 0;
    });
    return hasValue ? null : { atLeastOneRequired: { fields: controlNames } };
  };
}

/** §27: "no future DOB" / "entry_date ≤ today" style rule — rejects any date strictly after today. */
export function dateNotInFuture(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (!value) {
      return null;
    }
    const date = value instanceof Date ? value : new Date(value);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return date.getTime() > today.getTime() ? { dateNotInFuture: true } : null;
  };
}
