// Kept free of store imports so that utils which do not load the stores
// (KeypadUtils, Bolt11Utils) can use these.

// 100_000_000
export const SATS_PER_BTC = 100000000;
// 21,000,000 BTC supply cap
export const MAX_BTC = 21000000;
export const MAX_SATS = MAX_BTC * SATS_PER_BTC;
