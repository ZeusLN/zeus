import { observable, action, runInAction } from 'mobx';
import { lnrpc } from '../zeus_modules/@lightninglabs/lnc-core';
import { listPeers, disconnectPeer } from '../utils/BackendUtils';

export type Peer = lnrpc.Peer;

export default class PeersStore {
    @observable peers: Peer[] = [];
    @observable loading: boolean = false;
    @observable error: string | null = null;

    @action
    resetPeers() {
        console.log('Resetting peers...');
        this.peers = [];
        this.loading = false;
        this.error = null;
    }

    @action
    async fetchPeers() {
        console.log('Starting fetchPeers...');
        this.loading = true;
        this.error = null;

        try {
            const response = await listPeers();
            console.log('listPeers API response:', response);

            runInAction(() => {
                this.peers = response.map((peer: any) => ({
                    ...peer,
                    pubKey: peer.pub_key
                }));
                console.log('Normalized peers in store:', this.peers);
                this.loading = false;
            });
        } catch (error: unknown) {
            console.error('Error in fetchPeers:', error);

            runInAction(() => {
                this.error =
                    error instanceof Error
                        ? error.message
                        : 'Failed to fetch peers';
                this.loading = false;
            });
        }
    }

    @action
    async disconnectPeer(pubkey: string) {
        console.log(`Attempting to disconnect peer with pubkey: ${pubkey}`);
        console.log('Current peers in store:', this.peers);

        this.loading = true;
        this.error = null;

        try {
            const peerExists = this.peers.some(
                (peer) => peer.pubKey === pubkey
            );
            if (!peerExists) {
                console.warn(
                    `Peer with pubkey ${pubkey} not found in the store.`
                );
                throw new Error(`Peer with pubkey ${pubkey} is not connected.`);
            }

            const success = await disconnectPeer(pubkey);
            console.log(
                `disconnectPeer API response for pubkey ${pubkey}:`,
                success
            );

            if (success) {
                runInAction(() => {
                    this.peers = this.peers.filter(
                        (peer) => peer.pubKey !== pubkey
                    );
                    console.log('Updated peers after disconnect:', this.peers);
                    this.loading = false;
                });
                return true;
            } else {
                throw new Error('Failed to disconnect peer');
            }
        } catch (error: unknown) {
            console.error(
                `Error in disconnectPeer for pubkey ${pubkey}:`,
                error
            );

            runInAction(() => {
                this.error =
                    error instanceof Error
                        ? error.message
                        : 'Failed to disconnect peer';
                this.loading = false;
            });
            return false;
        }
    }
}
