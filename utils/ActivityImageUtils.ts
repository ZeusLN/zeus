import type Contact from '../models/Contact';
import CashuToken from '../models/CashuToken';
import Payment from '../models/Payment';
import Transaction from '../models/Transaction';
import { getPhoto } from './PhotoUtils';

export function getActivityContactPhoto(
    item: any,
    contacts: Contact[],
    lnurl?: { lnurl: string; metadata?: { metadata: string } }
): string | undefined {
    if (!contacts.length) return undefined;

    let matches: Contact[] = [];
    if (item instanceof Payment) {
        if (lnurl) {
            matches = contacts.filter((contact) =>
                contact.lnAddress?.some(
                    (address) => address && address === lnurl.lnurl
                )
            );
            if (!matches.length) {
                let metadata: unknown;
                try {
                    metadata = JSON.parse(lnurl.metadata?.metadata || '[]');
                } catch {
                    return undefined;
                }
                if (Array.isArray(metadata)) {
                    const identifiers = metadata
                        .filter(
                            (entry) =>
                                Array.isArray(entry) &&
                                entry.length === 2 &&
                                (entry[0] === 'text/identifier' ||
                                    entry[0] === 'text/plain') &&
                                typeof entry[1] === 'string' &&
                                entry[1].trim()
                        )
                        .map((entry) => entry[1].trim().toLowerCase());
                    matches = contacts.filter((contact) =>
                        contact.lnAddress?.some(
                            (address) =>
                                address &&
                                identifiers.includes(address.toLowerCase())
                        )
                    );
                }
            }
            // A service node pubkey does not identify its LNURL recipient.
        } else if (contacts.some((contact) => contact.pubkey?.some(Boolean))) {
            const destination = item.destination || item.getDestination;
            if (destination) {
                matches = contacts.filter((contact) =>
                    contact.pubkey?.includes(destination)
                );
            }
        }
    } else if (item instanceof CashuToken && item.sent && !item.received) {
        const destination = item.getLockPubkey;
        if (destination) {
            matches = contacts.filter((contact) =>
                contact.cashuPubkey?.includes(destination)
            );
        }
    } else if (item instanceof Transaction && Number(item.getAmount) < 0) {
        // destAddresses alone can include change, notably on CLN.
        const destinations = item.output_details
            ?.filter((output) => output.is_our_address === false)
            .map((output) => output.address)
            .filter(Boolean);
        if (destinations?.length) {
            matches = contacts.filter((contact) =>
                contact.onchainAddress?.some((address) =>
                    destinations.includes(address)
                )
            );
        }
    }

    // Do not choose arbitrarily between contacts sharing a destination.
    return matches.length === 1
        ? getPhoto(matches[0].photo || undefined) || undefined
        : undefined;
}

export function getActivityLnurlImage(metadata?: string): string | undefined {
    if (!metadata) return undefined;
    try {
        const entries: unknown = JSON.parse(metadata);
        if (!Array.isArray(entries)) return undefined;
        for (const entry of entries) {
            if (
                Array.isArray(entry) &&
                entry.length === 2 &&
                (entry[0] === 'image/png;base64' ||
                    entry[0] === 'image/jpeg;base64') &&
                typeof entry[1] === 'string' &&
                entry[1].trim()
            ) {
                return `data:${entry[0]},${entry[1]}`;
            }
        }
    } catch {}
    return undefined;
}
