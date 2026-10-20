import NavigationService from '../NavigationService';
import { settingsStore } from '../stores/Stores';
import type { NwcActivityNotif } from './NostrConnectUtils';

// An NWC notification tapped while login is required or POS is active,
// opened by Wallet once the user has logged in, like a deferred deep link
let pendingLink: NwcActivityNotif | null = null;

export function openNwcActivityLink(link: NwcActivityNotif): void {
    if (settingsStore.externalInputAuthRequired()) {
        pendingLink = link;
        return;
    }
    NavigationService.navigateWhenReady('NWCConnectionActivity', {
        connectionId: link.connectionId,
        ...(link.failedActivityId && {
            failedActivityId: link.failedActivityId
        })
    });
}

export function processPendingNwcActivityLink(): void {
    if (pendingLink) {
        const link = pendingLink;
        pendingLink = null;
        openNwcActivityLink(link);
    }
}
