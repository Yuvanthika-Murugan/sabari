/**
 * Field formats and checks shared by every form. The server re-checks the same
 * rules (backend/src/Core/Input.php), so these only give earlier feedback.
 */

/** What a field may contain. Characters outside the format can't be typed or pasted. */
export type FieldFormat =
  | 'decimal'   // amounts / percentages: digits and one '.', at most 2 decimals
  | 'integer'   // counts, ages, instalment numbers: digits only
  | 'digits'    // PIN, account number: digits only (leading zeros kept)
  | 'name'      // person / place names: letters (any script), space . ' -
  | 'upper'     // PAN, IFSC, GST: A-Z and 0-9, upper-cased
  | 'code'      // branch code: A-Z 0-9 - /, upper-cased
  | 'alnum'     // series / PSO / agreement no: letters, digits - /, case kept
  | 'reference';// UTR / cheque / txn refs: letters, digits - / _

const cleaners: Record<FieldFormat, (v: string) => string> = {
  decimal: v => {
    const [whole, ...rest] = v.replace(/[^\d.]/g, '').split('.');
    return rest.length ? `${whole}.${rest.join('').slice(0, 2)}` : whole;
  },
  integer: v => v.replace(/\D/g, ''),
  digits: v => v.replace(/\D/g, ''),
  name: v => v.replace(/[^\p{L}\p{M} .'-]/gu, '').replace(/\s{2,}/g, ' '),
  upper: v => v.toUpperCase().replace(/[^A-Z0-9]/g, ''),
  code: v => v.toUpperCase().replace(/[^A-Z0-9/-]/g, ''),
  alnum: v => v.replace(/[^A-Za-z0-9/-]/g, ''),
  reference: v => v.replace(/[^A-Za-z0-9/_-]/g, ''),
};

export const cleanValue = (format: FieldFormat, v: string) => cleaners[format](v);

/** On-screen keyboard to show on phones for each format. */
export const keyboardFor = (format?: FieldFormat): 'decimal' | 'numeric' | 'text' | undefined =>
  format === 'decimal' ? 'decimal' : format === 'integer' || format === 'digits' ? 'numeric' : format ? 'text' : undefined;

/** A check returns an error message, or '' when the value is fine. Empty values are left to `required`. */
export type Check = (v: string) => string;

export const checks = {
  pan: (v: string) => /^[A-Z]{5}\d{4}[A-Z]$/.test(v) ? '' : 'Must be a valid PAN (e.g. ABCDE1234F)',
  ifsc: (v: string) => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v) ? '' : 'Must be a valid IFSC (e.g. HDFC0001234)',
  gst: (v: string) => /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v) ? '' : 'Must be a valid GSTIN (e.g. 33ABCDE1234F1Z5)',
  pincode: (v: string) => /^[1-9]\d{5}$/.test(v) ? '' : 'Must be a 6-digit PIN code',
  account: (v: string) => /^\d{9,18}$/.test(v) ? '' : 'Account number must be 9 to 18 digits',
  name: (v: string) => /\p{L}/u.test(v) ? '' : 'Enter a name using letters',
};
