// BACKEND_CAPABILITIES is test data that stands for what each backend
// reports. This keeps it in step with the backends: a capability a backend
// changes, or a fixture that drifts, fails here instead of letting the
// activity filter tests pass against made-up data.
//
// Import-time scaffolding for the native modules the backends pull in, as in
// the backend tests. CoreLightningRequestHandler has to be stubbed because it
// and CLNRest import each other.
jest.mock('react-native-blob-util', () => ({
    __esModule: true,
    default: { fetch: jest.fn(), config: jest.fn() }
}));
jest.mock('../stores/Stores');
jest.mock('./TorUtils', () => ({
    doTorRequest: jest.fn(),
    isOnionHttpsUrl: jest.fn(),
    RequestMethod: {}
}));
jest.mock('../backends/CoreLightningRequestHandler', () => ({}));
jest.mock('../lndmobile/LndMobileInjection', () => ({
    __esModule: true,
    default: { index: {}, channel: {}, wallet: {}, onchain: {}, wtclient: {} }
}));
jest.mock('../lndmobile/onchain', () => ({}));
jest.mock('../lndmobile/wallet', () => ({}));
jest.mock('./LndMobileUtils', () => ({ LndMobileEventEmitter: {} }));
jest.mock('../ldknode/LdkNodeInjection', () => ({
    __esModule: true,
    default: {}
}));

import CLNRest from '../backends/CLNRest';
import EmbeddedLND from '../backends/EmbeddedLND';
import LdkNode from '../backends/LdkNode';
import LndHub from '../backends/LndHub';
import LND from '../backends/LND';
import NostrWalletConnect from '../backends/NostrWalletConnect';
import { BACKEND_CAPABILITIES } from './backendCapabilityFixtures';

// What the activity filters read from a backend. supportsLightningAddress is
// not here: BackendUtils works it out from other capabilities, a backend does
// not report it. supportsAMP is only compared where it does not depend on
// the node version.
const CAPABILITIES = [
    'isLNDBased',
    'supportsOnchainSends',
    'supportsOnchainReceiving',
    'supportsKeysend',
    'supportsCircularRebalancing',
    'supportsLSPScustomMessage',
    'supportsLSPS1rest',
    'supportsLSPS7native',
    'supportsCashuWallet'
];

const BACKENDS: [string, () => any][] = [
    ['lnd', () => new LND()],
    ['embedded-lnd', () => new EmbeddedLND()],
    ['cln-rest', () => new CLNRest()],
    ['ldk-node', () => new LdkNode()],
    ['lndhub', () => new LndHub()],
    ['nostr-wallet-connect', () => new NostrWalletConnect()]
];

describe('BACKEND_CAPABILITIES', () => {
    it.each(BACKENDS)('matches what %s reports', (name, create) => {
        const backend = create();
        const fixture = BACKEND_CAPABILITIES[name];

        CAPABILITIES.forEach((capability) => {
            const reported =
                typeof backend[capability] === 'function'
                    ? !!backend[capability]()
                    : false;
            expect([capability, reported]).toEqual([
                capability,
                !!fixture[capability]
            ]);
        });
    });
});
