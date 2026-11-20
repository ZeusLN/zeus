import NavigationService from '../NavigationService';
import { settingsStore } from '../stores/Stores';
import type { NwcActivityNotif } from './NostrConnectUtils';

// An NWC notification tapped while login is required or POS is active,
// opened by Wallet once the user has logged in, like a deferred deep link.
// The connection belongs to the wallet selected at the tap, so the link is
// dropped if the user logs in to another wallet.
let pendingLink: { link: NwcActivityNotif; selectedNode: number } | null = null;

const selectedNode = () => settingsStore.settings?.selectedNode || 0;

function openOrQueue(link: NwcActivityNotif, walletIndex: number): void {
    if (settingsStore.externalInputAuthRequired()) {
        pendingLink = { link, selectedNode: walletIndex };
        return;
    }
    NavigationService.navigateWhenReady('NWCConnectionActivity', {
        connectionId: link.connectionId,
        ...(link.failedActivityId && {
            failedActivityId: link.failedActivityId
        })
    });
}

export function openNwcActivityLink(link: NwcActivityNotif): void {
    openOrQueue(link, selectedNode());
}

export function processPendingNwcActivityLink(): void {
    if (pendingLink) {
        const { link, selectedNode: walletIndex } = pendingLink;
        pendingLink = null;
        if (walletIndex !== selectedNode()) return;
        openOrQueue(link, walletIndex);
    }
}
