import { networkFetch } from './NetworkUtils';

export const SWAP_STATUS_POLL_MS = 5000;

// Stands in for the swap-update WebSocket when Tor is enabled. The platform
// WebSocket cannot use Tor, so this polls GET {endpoint}/swap/{id} over Tor
// and replays each status change as a swap.update message. It implements the
// part of the WebSocket interface SwapDetails uses, so both transports share
// the same update handlers.
export default class SwapStatusPoller {
    onopen: (() => void) | null = null;
    onmessage: ((event: { data: string }) => any) | null = null;
    onerror: ((error: any) => void) | null = null;
    onclose: (() => void) | null = null;

    private closed = false;
    private lastStatus?: string;
    private timer?: ReturnType<typeof setTimeout>;

    constructor(
        private endpoint: string,
        private swapId: string,
        private headers?: any,
        private intervalMs: number = SWAP_STATUS_POLL_MS
    ) {
        // Like a WebSocket, open after the caller has attached handlers
        this.timer = setTimeout(() => {
            if (this.closed) return;
            this.onopen?.();
            this.poll();
        }, 0);
    }

    // The swap ID already selects the swap, so subscribe messages are not
    // needed
    send(_data: string) {}

    close() {
        if (this.closed) return;
        this.closed = true;
        if (this.timer) clearTimeout(this.timer);
        this.onclose?.();
    }

    private emit(update: any) {
        return this.onmessage?.({
            data: JSON.stringify({ event: 'update', args: [update] })
        });
    }

    private async poll() {
        if (this.closed) return;
        try {
            const response = await networkFetch({
                method: 'GET',
                url: `${this.endpoint}/swap/${this.swapId}`,
                headers: this.headers,
                enableTor: true
            });
            const status = response.info().status;
            const result = response.json();

            if (status >= 400 && status < 500 && result?.error) {
                // The server rejected the request itself (e.g. unknown
                // swap); retrying will not help
                await this.emit({ id: this.swapId, error: result.error });
            } else if (
                status < 300 &&
                result?.status &&
                result.status !== this.lastStatus
            ) {
                this.lastStatus = result.status;
                await this.emit({ id: this.swapId, ...result });
            }
        } catch (err) {
            // Tor circuits fail now and then; try again on the next tick
            console.warn('Swap status poll failed', err);
        }
        if (!this.closed) {
            this.timer = setTimeout(() => this.poll(), this.intervalMs);
        }
    }
}
