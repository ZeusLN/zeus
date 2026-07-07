// AddressUtils (source of CUSTODIAL_LNDHUBS) transitively imports the store
// graph and protobufs; stub them so this stays a fast, isolated unit test.
jest.mock('../stores/Stores', () => ({ nodeInfoStore: {} }));

import {
    redactSettings,
    REDACTED,
    REDACTED_HOST
} from './DiagnosticsRedaction';

describe('redactSettings', () => {
    const buildSettings = () => ({
        passphrase: 'super-secret-pin-phrase',
        duressPin: '0000',
        lspAccessKey: 'lsp-key',
        pos: { squareAccessToken: 'sq-token' },
        fiatEnabled: true,
        selectedNode: 0,
        nodes: [
            {
                implementation: 'lnd',
                host: 'my-private-node.example.com',
                port: '8080',
                macaroonHex: 'deadbeef',
                certVerification: true,
                nickname: 'home'
            },
            {
                implementation: 'lndhub',
                lndhubUrl: 'https://lndhub.io',
                username: 'alice',
                password: 'hunter2',
                accessKey: 'ak'
            },
            {
                implementation: 'lndhub',
                lndhubUrl: 'https://my-private-lndhub.example.com',
                username: 'bob',
                password: 'hunter2'
            },
            {
                implementation: 'embedded-lnd',
                host: 'localhost',
                port: '10009',
                seedPhrase: ['word1', 'word2', 'word3'],
                walletPassword: 'wallet-pw',
                embeddedLndNetwork: 'Mainnet'
            },
            {
                implementation: 'lightning-node-connect',
                pairingPhrase: 'a b c d',
                mailboxServer: 'mailbox.example.com'
            },
            {
                implementation: 'nostr-wallet-connect',
                nostrWalletConnectUrl:
                    'nostr+walletconnect://pubkey?secret=deadbeef'
            }
        ]
    });

    it('removes every secret value from the whole blob', () => {
        const out = redactSettings(buildSettings());

        expect(out.passphrase).toBe(REDACTED);
        expect(out.duressPin).toBe(REDACTED);
        expect(out.lspAccessKey).toBe(REDACTED);
        expect(out.pos.squareAccessToken).toBe(REDACTED);

        expect(out.nodes[0].macaroonHex).toBe(REDACTED);
        expect(out.nodes[1].username).toBe(REDACTED);
        expect(out.nodes[1].password).toBe(REDACTED);
        expect(out.nodes[1].accessKey).toBe(REDACTED);
        expect(out.nodes[3].seedPhrase).toBe(REDACTED);
        expect(out.nodes[3].walletPassword).toBe(REDACTED);
        expect(out.nodes[4].pairingPhrase).toBe(REDACTED);
        expect(out.nodes[5].nostrWalletConnectUrl).toBe(REDACTED);
    });

    it('masks a remote node host and keeps non-sensitive metadata', () => {
        const out = redactSettings(buildSettings());

        expect(out.nodes[0].host).toBe(REDACTED_HOST);
        expect(out.nodes[0].port).toBe(REDACTED_HOST);
        expect(out.nodes[0].nickname).toBe('home');
        expect(out.nodes[0].certVerification).toBe(true);
    });

    it('keeps a known custodial LNDHub host but redacts a private one', () => {
        const out = redactSettings(buildSettings());

        expect(out.nodes[1].lndhubUrl).toBe('https://lndhub.io');
        expect(out.nodes[2].lndhubUrl).toBe(REDACTED_HOST);
    });

    it('drops host/port for local embedded nodes', () => {
        const out = redactSettings(buildSettings());

        expect(out.nodes[3].host).toBeUndefined();
        expect(out.nodes[3].port).toBeUndefined();
        expect(out.nodes[3].embeddedLndNetwork).toBe('Mainnet');
    });

    it('masks LNC / NWC connection endpoints', () => {
        const out = redactSettings(buildSettings());

        expect(out.nodes[4].mailboxServer).toBe(REDACTED_HOST);
    });

    it('does not mutate the original settings object', () => {
        const original = buildSettings();
        redactSettings(original);

        expect(original.nodes[0].macaroonHex).toBe('deadbeef');
        expect(original.passphrase).toBe('super-secret-pin-phrase');
    });

    it('handles undefined / empty input safely', () => {
        expect(redactSettings(undefined)).toEqual({});
        expect(redactSettings({})).toEqual({});
    });
});
