import { getParams } from 'js-lnurl';
import { decodelnurl } from 'js-lnurl/lib/helpers';

import { localeString } from './LocaleUtils';

// js-lnurl parses the LNURL query string with query-string@6, which decodes
// every key and value through decode-uri-component@0.2.2. When the native
// decodeURIComponent throws, that package falls back to a split-and-retry
// decoder whose cost grows superlinearly in the number of malformed escape
// sequences (GHSA-vcc3-ghjq-m6fr). Measured end to end through getParams():
// 200 escapes blocks the JS thread for 0.5s, 600 for 5.3s, and the ~6600 that
// fit inside the 20000 character bech32 payload decodelnurl accepts run for
// minutes. Hermes is slower still.
//
// getParams() runs that parse before it issues any network request, so a
// scanned QR code, deep link, or share intent is on its own enough to wedge
// the app. There is no clean dependency fix today: decode-uri-component 0.5.0
// and the query-string 9 that depends on it are both ESM-only, and js-lnurl
// 0.6.0 still pins query-string ^6.12.1.
//
// The fallback splits each key and value into runs of consecutive `%XX`
// escapes. Runs that decode are handled natively; only a run that fails to
// decode goes through the slow path, which costs superlinear in the number of
// escapes in that run (valid ones included). Genuine LNURLs are well-formed,
// and sloppy-but-real ones carry at most a stray escape or two, so keep the
// lenient behaviour for a small budget and reject beyond it. The cost is
// superlinear per run, so capping the total number of escapes across failing
// runs caps the total work at a few milliseconds.
const MAX_ESCAPES_IN_UNDECODABLE_RUNS = 32;

// Same run boundaries as decode-uri-component. A run never spans `&`, `=` or
// `?`, so runs found in the whole URL are the runs query-string's pieces hold.
const ESCAPE_RUN = /(?:%[0-9a-fA-F]{2})+/g;

/**
 * True when the escape runs in `url` that cannot be decoded hold more escape
 * sequences than decode-uri-component can expand cheaply.
 */
export const hasUndecodableEscapes = (url: string): boolean => {
    let undecodableEscapes = 0;
    for (const run of url.match(ESCAPE_RUN) || []) {
        try {
            decodeURIComponent(run);
        } catch {
            // every escape in a run is three characters
            undecodableEscapes += run.length / 3;
        }
    }
    return undecodableEscapes > MAX_ESCAPES_IN_UNDECODABLE_RUNS;
};

/**
 * getParams() from js-lnurl, guarded against the decode-uri-component blowup
 * described above. Rejects before any parsing or network request when the
 * decoded LNURL cannot be decoded cheaply.
 */
export const getLnurlParams = async (lnurl: string) => {
    let decoded;
    try {
        decoded = decodelnurl(lnurl);
    } catch {
        // Not decodable as an LNURL at all. Let js-lnurl report that itself so
        // the error the caller sees does not change.
    }

    if (decoded && hasUndecodableEscapes(decoded)) {
        throw new Error(
            localeString('utils.handleAnything.invalidLnurlParams')
        );
    }

    return getParams(lnurl);
};
