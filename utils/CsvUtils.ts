// Spreadsheets evaluate a cell starting with one of these as a formula
const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r'];

const PLAIN_NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;

const isNumeric = (value: string) => PLAIN_NUMBER.test(value);

// also checked after leading whitespace, which some spreadsheets skip
const startsLikeFormula = (value: string) =>
    FORMULA_TRIGGERS.some(
        (trigger) =>
            value.startsWith(trigger) || value.trimStart().startsWith(trigger)
    );

// Prefixes text that would be evaluated as a formula with ', so a memo like
// =HYPERLINK(...) opens as text. Numbers such as -2000 are left alone.
const escapeFormula = (value: string) =>
    startsLikeFormula(value) && !isNumeric(value) ? `'${value}` : value;

// Quotes every field and doubles any quote inside it (RFC 4180), so values
// containing commas, quotes or line breaks stay in their own column.
// Missing values become empty fields.
export const toCsvRow = (fields: Array<unknown>): string =>
    fields
        .map(
            (field) =>
                `"${escapeFormula(String(field ?? '')).replace(/"/g, '""')}"`
        )
        .join(',');
