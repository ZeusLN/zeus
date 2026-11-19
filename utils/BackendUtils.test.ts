jest.mock('../stores/Stores');

const mockSignMessage = jest.fn();
const mockLnurlAuth = jest.fn();
function mockBackend() {
    return {
        __esModule: true,
        default: class {
            signMessage = (...args: any[]) => mockSignMessage(...args);
            lnurlAuth = (...args: any[]) => mockLnurlAuth(...args);
        }
    };
}
jest.mock('../backends/LND', () => mockBackend());
jest.mock('../backends/LightningNodeConnect', () => mockBackend());
jest.mock('../backends/EmbeddedLND', () => mockBackend());
jest.mock('../backends/LdkNode', () => mockBackend());
jest.mock('../backends/CLNRest', () => mockBackend());
jest.mock('../backends/LndHub', () => mockBackend());
jest.mock('../backends/NostrWalletConnect', () => mockBackend());

import { settingsStore } from '../stores/Stores';
import BackendUtils from './BackendUtils';
import { LNURLAUTH_CANONICAL_PHRASE } from './LnurlAuthUtils';

describe('BackendUtils.signMessage', () => {
    beforeEach(() => {
        settingsStore.implementation = 'embedded-lnd';
        mockSignMessage.mockReset().mockResolvedValue({ signature: 'sig' });
        mockLnurlAuth.mockReset().mockResolvedValue({ signature: 'auth' });
    });

    it('passes other messages to the backend', async () => {
        await expect(BackendUtils.signMessage('hello')).resolves.toEqual({
            signature: 'sig'
        });
        expect(mockSignMessage).toHaveBeenCalledWith('hello');
    });

    it('refuses the LNURL-auth phrase without calling the backend', async () => {
        await expect(
            BackendUtils.signMessage(LNURLAUTH_CANONICAL_PHRASE)
        ).rejects.toThrow('LNURL-auth');
        await expect(
            BackendUtils.signMessage(
                ` ${LNURLAUTH_CANONICAL_PHRASE.toLowerCase()}\n`
            )
        ).rejects.toThrow('LNURL-auth');
        expect(mockSignMessage).not.toHaveBeenCalled();
    });

    it('still lets lnurlAuth sign the phrase', async () => {
        await expect(
            BackendUtils.lnurlAuth(LNURLAUTH_CANONICAL_PHRASE)
        ).resolves.toEqual({ signature: 'auth' });
        expect(mockLnurlAuth).toHaveBeenCalledWith(LNURLAUTH_CANONICAL_PHRASE);
    });
});
