import { Pipe, PipeTransform } from '@angular/core';

/**
 * Formats money via `Intl.NumberFormat` per PRD §12 ("number/date/currency via
 * Intl API per firm locale") and §14 (`numeric(18,2)`, 2-dp). Currency code and
 * locale default to the India tenant baseline; both are override-able per firm
 * once Settings (Module 15) supplies them.
 */
@Pipe({ name: 'lfCurrency' })
export class LfCurrencyPipe implements PipeTransform {
  transform(value: number | null | undefined, currency = 'INR', locale = 'en-IN'): string {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return '—';
    }

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
}
