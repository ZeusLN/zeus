// utils/CloverUtils.ts — Clover inventory (products) read adapter for Zeus.
// Read-only: GET items + tax_rates (no push/payments/tenders). Docs read
// 2026-09-26: items expand [tags, categories, taxRates, modifierGroups,
// itemStock, options]; tax_rates rate int64 percent-based; {elements:[]}
// wrapper; limit 100/1000; money in cents; unitQty x1000 PER_UNIT only.
// Conventions (zeus_verify.md): unitQty/1000 PER_UNIT-gate, encode,
// 15s timeout, NaN-guards. Square parity: Square maps RAW orders via
// `new Order(order)`; here we map RAW items. Own implementation.
export const CLOVER_PROD_HOST = 'https://api.clover.com';
export const CLOVER_SANDBOX_HOST = 'https://apisandbox.dev.clover.com';
export const CLOVER_TIMEOUT_MS = 15000;
export const CLOVER_DEFAULT_LIMIT = 100;
export const CLOVER_MAX_LIMIT = 1000;
export const CLOVER_MAX_PAGES = 10;
export interface CloverZeusProduct {
    id: string; name: string; quantity: number;
    base_price_money: { amount: number }; taxPercentage: string; hidden: boolean;
}
export interface CloverTaxRate {
    id: string; name: string; rate: number; percent: number; isDefault: boolean;
}
export interface CloverOpts {
    devMode?: boolean; limit?: number;
    timeoutMs?: number; maxPages?: number; fetchImpl?: any;
}
export const getCloverHost = (devMode?: boolean): string =>
    devMode ? CLOVER_SANDBOX_HOST : CLOVER_PROD_HOST;
// NaN-guard: non-numeric input becomes `fallback`, never NaN.
export const numOr = (value: any, fallback = 0): number => {
    const n = Number(value);
    return isFinite(n) ? n : fallback;
};
export const clampLimit = (limit: any): number =>
    Math.min(Math.max(Math.floor(numOr(limit, CLOVER_DEFAULT_LIMIT)), 1), CLOVER_MAX_LIMIT);
export const unwrapElements = (payload: any): any[] => {
    const raw = payload?.elements ?? payload?.items ?? payload?.orders ?? [];
    return Array.isArray(raw) ? raw : [];
};
// fetch with timeout gate (AbortController + clearTimeout, returnable). fetchImpl injectable.
export const cloverFetchWithTimeout = (
    url: string, token: string,
    timeoutMs: number = CLOVER_TIMEOUT_MS, fetchImpl: any = fetch
): Promise<any> => {
    const controller = new AbortController();
    let timer: any;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
            controller.abort();
            reject(new Error('Clover request timed out'));
        }, timeoutMs);
    });
    const req = fetchImpl(url, { method: 'GET', headers: {
        Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        signal: controller.signal });
    return Promise.race([req, timeout]).then(
        (res: any) => { clearTimeout(timer); return res; },
        (err: any) => { clearTimeout(timer); throw err; }
    );
};
export const buildCloverItemsUrl = (
    host: string, merchantId: string,
    limit: number = CLOVER_DEFAULT_LIMIT, offset: number = 0
): string =>
    `${host}/v3/merchants/${encodeURIComponent(String(merchantId))}` +
    `/items?expand=${encodeURIComponent('taxRates')}` +
    `&limit=${clampLimit(limit)}&offset=${Math.floor(Math.max(numOr(offset, 0), 0))}`;
export const buildCloverTaxRatesUrl = (
    host: string, merchantId: string,
    limit: number = CLOVER_DEFAULT_LIMIT, offset: number = 0
): string =>
    `${host}/v3/merchants/${encodeURIComponent(String(merchantId))}` +
    `/tax_rates?limit=${clampLimit(limit)}&offset=${Math.floor(Math.max(numOr(offset, 0), 0))}`;
// PER_UNIT-gate: stale unitQty on EACH/VARIABLE items stays quantity 1.
export const mapCloverItemQuantity = (item: any): number => {
    if (item?.priceType === 'PER_UNIT' && item?.unitQty != null && !isNaN(Number(item.unitQty))) {
        const q = Number(item.unitQty) / 1000;
        if (isFinite(q) && q > 0) return q;
    }
    return 1;
};
// First finite expanded taxRates[].rate (int64, 1e5 scale: 1500000 = 15%
// per docs VAT example; live-merchant recheck pending).
export const pickItemTaxPercent = (item: any): string => {
    for (const r of unwrapElements(item?.taxRates)) {
        const n = Number(r?.rate);
        if (isFinite(n)) return String(n / 100000);
    }
    return '';
};
// Prices stay in cents (order-adapter parity); no /100 conversion.
export const mapCloverItemToZeusProduct = (item: any): CloverZeusProduct => ({
    id: String(item?.id ?? ''), name: item?.name || 'Item',
    quantity: mapCloverItemQuantity(item),
    base_price_money: { amount: numOr(item?.price, 0) },
    taxPercentage: pickItemTaxPercent(item), hidden: item?.hidden === true
});
export const mapCloverTaxRate = (rate: any): CloverTaxRate => {
    const raw = numOr(rate?.rate, 0);
    return { id: String(rate?.id ?? ''), name: rate?.name || 'Tax',
        rate: raw, percent: raw / 100000, isDefault: rate?.isDefault === true };
};
// Shared paged GET over {elements:[...]}; stops on short page / maxPages.
// Warns on truncation when catalog exceeds maxPages*pageSize.
export const getCloverPaged = async (
    urlOf: (offset: number) => string, token: string, pageSize: number,
    map: (e: any) => any, skip: (e: any) => boolean, opts: CloverOpts = {}
): Promise<any[]> => {
    const { timeoutMs = CLOVER_TIMEOUT_MS, maxPages = CLOVER_MAX_PAGES, fetchImpl = fetch } = opts;
    if (!token) throw new Error('Clover token missing');
    const out: any[] = [];
    let offset = 0;
    for (let page = 0; page < maxPages; page++) {
        const res = await cloverFetchWithTimeout(urlOf(offset), token, timeoutMs, fetchImpl);
        const status = res?.status ?? (res?.ok === false ? 0 : 200);
        if (status !== 200) throw new Error(`Clover request failed: ${status}`);
        const batch = unwrapElements(await res.json());
        for (const e of batch) if (!skip(e)) out.push(map(e));
        if (batch.length < pageSize) break;
        offset += pageSize;
    }
    if (offset >= maxPages * pageSize) {
        console.warn(`Clover catalog truncated at ${maxPages * pageSize} items (maxPages=${maxPages}, pageSize=${pageSize}); increase maxPages/limit to fetch more.`);
    }
    return out;
};
// Paged items -> Zeus products; hidden + out-of-stock skipped (R11 parity).
export const getCloverItems = (
    merchantId: string, token: string, opts: CloverOpts = {}
): Promise<CloverZeusProduct[]> => {
    if (!merchantId || !token) return Promise.reject(new Error('Clover credentials missing'));
    const size = clampLimit(opts.limit);
    const urlOf = (off: number) => buildCloverItemsUrl(getCloverHost(opts.devMode), merchantId, size, off);
    return getCloverPaged(urlOf, token, size, mapCloverItemToZeusProduct,
        (e: any) => e?.hidden === true || e?.available === false, opts);
};
export const getCloverTaxRates = (
    merchantId: string, token: string, opts: CloverOpts = {}
): Promise<CloverTaxRate[]> => {
    if (!merchantId || !token) return Promise.reject(new Error('Clover credentials missing'));
    const size = clampLimit(opts.limit);
    const urlOf = (off: number) => buildCloverTaxRatesUrl(getCloverHost(opts.devMode), merchantId, size, off);
    return getCloverPaged(urlOf, token, size, mapCloverTaxRate, () => false, opts);
};
