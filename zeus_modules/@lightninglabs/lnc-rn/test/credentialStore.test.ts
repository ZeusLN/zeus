import { expect } from 'chai';

import LncCredentialStore from '../lib/util/credentialStore';

describe('util/credentialStore', () => {
    it('starts empty and unpaired', () => {
        const store = new LncCredentialStore();
        expect(store.serverHost).to.equal('');
        expect(store.pairingPhrase).to.equal('');
        expect(store.localKey).to.equal('');
        expect(store.remoteKey).to.equal('');
        expect(store.isPaired).to.equal(false);
    });

    it('stores the pairing phrase passed to the constructor', () => {
        const store = new LncCredentialStore('secret stuff');
        expect(store.pairingPhrase).to.equal('secret stuff');
        expect(store.isPaired).to.equal(true);
    });

    it('stores values via setters', () => {
        const store = new LncCredentialStore();
        store.serverHost = 'mailbox.example.com:443';
        store.pairingPhrase = 'secret stuff';
        store.localKey = 'local-key-hex';
        store.remoteKey = 'remote-key-hex';
        expect(store.serverHost).to.equal('mailbox.example.com:443');
        expect(store.pairingPhrase).to.equal('secret stuff');
        expect(store.localKey).to.equal('local-key-hex');
        expect(store.remoteKey).to.equal('remote-key-hex');
    });

    it('is paired when only a remote key is present', () => {
        const store = new LncCredentialStore();
        store.remoteKey = 'remote-key-hex';
        expect(store.isPaired).to.equal(true);
    });

    it('is paired when only a pairing phrase is present', () => {
        const store = new LncCredentialStore();
        store.pairingPhrase = 'secret stuff';
        expect(store.isPaired).to.equal(true);
    });

    it('clear() resets all fields', () => {
        const store = new LncCredentialStore('secret stuff');
        store.serverHost = 'mailbox.example.com:443';
        store.localKey = 'local-key-hex';
        store.remoteKey = 'remote-key-hex';
        store.clear();
        expect(store.serverHost).to.equal('');
        expect(store.pairingPhrase).to.equal('');
        expect(store.localKey).to.equal('');
        expect(store.remoteKey).to.equal('');
        expect(store.isPaired).to.equal(false);
    });
});
