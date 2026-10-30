import ReactNativeBlobUtil from 'react-native-blob-util';
import { nip05 } from 'nostr-tools';

// nostr-tools requests nostr.json with { redirect: 'manual' }, but React
// Native's fetch ignores that option and the OS HTTP client follows
// redirects, including to cleartext and LAN addresses. NIP-05 says
// redirects must be ignored, so nostr-tools gets a fetch that does not
// follow them and rejects a redirect response. Imported from index.js
// before App, so it applies to every nip05 call in the app.
export const fetchNip05 = async (url: string) => {
    const response = await ReactNativeBlobUtil.config({
        followRedirect: false
    }).fetch('get', url);
    const status = response.info().status;
    if (status >= 300 && status < 400) {
        throw new Error(`NIP-05 lookup was redirected (HTTP ${status})`);
    }
    return {
        status,
        json: async () => response.json()
    };
};

nip05.useFetchImplementation(fetchNip05);
