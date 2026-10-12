jest.mock('../stores/Stores', () => ({}));

import Channel from './Channel';

describe('Channel.canBeRouteHint', () => {
    const ready = {
        user_channel_id: '12345',
        is_channel_ready: true,
        has_counterparty_forwarding_info: true
    };

    it('accepts a ready channel with forwarding info', () => {
        expect(new Channel(ready).canBeRouteHint).toBe(true);
    });

    it('rejects a channel that is not ready', () => {
        expect(
            new Channel({ ...ready, is_channel_ready: false }).canBeRouteHint
        ).toBe(false);
    });

    it('rejects a channel without a user channel id', () => {
        expect(
            new Channel({ ...ready, user_channel_id: undefined }).canBeRouteHint
        ).toBe(false);
    });

    it('rejects a channel whose peer has not sent forwarding info yet', () => {
        expect(
            new Channel({ ...ready, has_counterparty_forwarding_info: false })
                .canBeRouteHint
        ).toBe(false);
    });
});
