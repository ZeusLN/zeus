import type { Node } from '../stores/SettingsStore';

// Wallet configs carry no id of their own. These fields tell two stored
// configs apart and are not changed by the per-wallet settings screens
// (Esplora, RGS, scorer, VSS, custodial warning) or by the picture picker.
// The data directories of embedded wallets are random UUIDs.
const IDENTITY_FIELDS: string[] = [
    'implementation',
    'nickname',
    'host',
    'port',
    'url',
    'macaroonHex',
    'rune',
    'accessKey',
    'lndhubUrl',
    'username',
    'pairingPhrase',
    'nostrWalletConnectUrl',
    'lndDir',
    'ldkNodeDir'
];

// Missing, null and empty fields are the same: a config read back from
// storage has lost its undefined keys, and the form saves cleared fields
// as ''.
const fieldValue = (node: any, field: string) => {
    const value = node?.[field];
    return value == null || value === '' ? '' : String(value);
};

export const isSameWallet = (a?: Node | null, b?: Node | null): boolean => {
    if (!a || !b) return false;
    return IDENTITY_FIELDS.every(
        (field) => fieldValue(a, field) === fieldValue(b, field)
    );
};

// Where `node` is stored in `nodes` now, or -1. A list index taken earlier
// can be stale (the list changed since it was read), so `hintIndex` is only
// used while it still holds `node`. Otherwise the config is looked up, and
// -1 is returned when it is gone or when several stored configs match.
export const resolveWalletIndex = (
    nodes: Array<Node> | undefined | null,
    node?: Node | null,
    hintIndex?: number | null
): number => {
    const list = nodes || [];
    if (hintIndex != null && isSameWallet(list[hintIndex], node)) {
        return hintIndex;
    }
    const matches = list
        .map((stored, i) => (isSameWallet(stored, node) ? i : -1))
        .filter((i) => i !== -1);
    return matches.length === 1 ? matches[0] : -1;
};
