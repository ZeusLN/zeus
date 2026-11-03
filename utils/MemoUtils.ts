// Some LNURL-pay services store the percent-encoded comment/description
// in the invoice memo (e.g. spaces arrive as %20), which Zeus would
// then display verbatim. Decode such memos for display, leaving memos
// that merely contain a literal % untouched.
const percentEncodedSequence = /%[0-9A-Fa-f]{2}/;

export function decodeMemo(memo: string): string;
export function decodeMemo(memo?: string): string | undefined;
export function decodeMemo(memo?: string): string | undefined {
    if (!memo || !percentEncodedSequence.test(memo)) return memo;
    try {
        return decodeURIComponent(memo);
    } catch {
        // not actually percent-encoded (e.g. a bare % elsewhere in the
        // memo) - show the original text rather than throwing
        return memo;
    }
}

// The invoice memo with the receiver name from the invoice settings in
// front of it. No trailing separator when there is no memo.
export const withReceiverName = (
    receiverName?: string,
    memo?: string
): string => {
    if (!receiverName) return memo || '';
    if (!memo) return receiverName;
    return `${receiverName}:  ${memo}`;
};
