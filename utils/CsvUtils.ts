// Quotes every field and doubles any quote inside it (RFC 4180), so values
// containing commas, quotes or line breaks stay in their own column.
// Missing values become empty fields.
export const toCsvRow = (fields: Array<unknown>): string =>
    fields
        .map((field) => `"${String(field ?? '').replace(/"/g, '""')}"`)
        .join(',');
