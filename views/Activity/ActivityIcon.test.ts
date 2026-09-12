jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../../components/SVG/LightningSvg', () => 'LightningSvg');
jest.mock('../../components/SVG/OnChainSvg', () => 'OnChainSvg');
jest.mock('../../components/SVG/EcashSvg', () => 'EcashSvg');
jest.mock('../../models/Payment', () => class Payment {});
jest.mock('../../stores/ContactStore', () => ({}));
jest.mock('../../stores/LnurlPayStore', () => ({}));
jest.mock('../../utils/ActivityUtils', () => ({
    getActivityLayer: jest.fn()
}));
jest.mock('../../utils/ActivityImageUtils', () => ({
    getActivityContactPhoto: jest.fn(),
    getActivityLnurlImage: jest.fn()
}));
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: jest.fn()
}));

import React from 'react';
import { StyleSheet } from 'react-native';
import { act, render, RenderResult } from '@testing-library/react-native';
import ActivityIcon, { ActivityImageCache } from './ActivityIcon';
import LightningSvg from '../../components/SVG/LightningSvg';
import OnChainSvg from '../../components/SVG/OnChainSvg';
import EcashSvg from '../../components/SVG/EcashSvg';
import Payment from '../../models/Payment';
import type { LnurlPayTransaction } from '../../stores/LnurlPayStore';
import { getActivityLayer } from '../../utils/ActivityUtils';
import { themeColor } from '../../utils/ThemeUtils';
import {
    getActivityContactPhoto,
    getActivityLnurlImage
} from '../../utils/ActivityImageUtils';

function payment(hash: string) {
    return Object.assign(Object.create(Payment.prototype), {
        resolvedPaymentHash: hash
    });
}

function transaction(hash: string): LnurlPayTransaction {
    return {
        paymentHash: hash,
        metadata: { metadata: `https://example.com/${hash}.png` }
    } as LnurlPayTransaction;
}

// Queries only return host elements, so match the mocked SVG components and
// React Native's host Image and View by type
function allOfType(renderer: RenderResult, type: unknown) {
    return renderer.container.queryAll((node) => node.type === type);
}

function oneOfType(renderer: RenderResult, type: unknown) {
    const nodes = allOfType(renderer, type);
    expect(nodes).toHaveLength(1);
    return nodes[0];
}

function deferred() {
    let resolve!: (value: LnurlPayTransaction | undefined) => void;
    const promise = new Promise<LnurlPayTransaction | undefined>((done) => {
        resolve = done;
    });
    return { promise, resolve };
}

describe('ActivityIcon', () => {
    let imageCache: ActivityImageCache;
    let load: jest.Mock;
    let props: React.ComponentProps<typeof ActivityIcon>;

    beforeEach(() => {
        jest.resetAllMocks();
        jest.mocked(themeColor).mockImplementation(
            (key) =>
                ({
                    success: '#46BE43',
                    error: 'rgb(200, 40, 40)',
                    highlight: 'orange',
                    warning: '#E14C4C',
                    text: 'white',
                    secondaryText: '#A7A9AC',
                    background: '#1F242D'
                }[key])
        );
        imageCache = new Map();
        load = jest.fn().mockResolvedValue(transaction('first'));
        props = {
            item: payment('first'),
            imageCache,
            colorTheme: 'success',
            ContactStore: { contacts: [] },
            LnurlPayStore: { load }
        } as unknown as React.ComponentProps<typeof ActivityIcon>;
        jest.mocked(getActivityLayer).mockReturnValue('lightning');
        jest.mocked(getActivityLnurlImage).mockImplementation(
            (metadata) => metadata
        );
    });

    async function mount(item = props.item) {
        return render(React.createElement(ActivityIcon, { ...props, item }));
    }

    it.each([
        ['success', '#46BE43'],
        ['error', 'rgb(200, 40, 40)'],
        ['highlight', 'orange'],
        ['warning', '#E14C4C'],
        ['text', 'white'],
        ['secondaryText', '#A7A9AC']
    ] as const)('matches the amount theme color %s', async (key, color) => {
        props.colorTheme = key;
        jest.mocked(getActivityLnurlImage).mockReturnValue(undefined);
        const renderer = await mount();
        expect(themeColor).toHaveBeenCalledWith(key);
        expect(oneOfType(renderer, LightningSvg).props.color).toBe(color);
        const views = allOfType(renderer, 'View');
        expect(StyleSheet.flatten(views[1].props.style).borderColor).toBe(
            color
        );
        expect(StyleSheet.flatten(views[2].props.style)).toMatchObject({
            backgroundColor: color,
            opacity: 0.1
        });
    });

    it('waits for history and prioritizes the contact photo over the LNURL image', async () => {
        const lookup = deferred();
        load.mockReturnValue(lookup.promise);
        const contactPhoto = 'https://example.com/contact.png';
        jest.mocked(getActivityContactPhoto).mockReturnValue(contactPhoto);
        const renderer = await mount();

        expect(allOfType(renderer, 'Image')).toHaveLength(0);
        expect(allOfType(renderer, LightningSvg)).toHaveLength(1);
        expect(getActivityContactPhoto).not.toHaveBeenCalled();

        const history = transaction('first');
        await act(async () => lookup.resolve(history));

        expect(getActivityContactPhoto).toHaveBeenLastCalledWith(
            props.item,
            props.ContactStore!.contacts,
            history
        );
        expect(getActivityLnurlImage).toHaveBeenLastCalledWith(
            history.metadata!.metadata
        );
        expect(oneOfType(renderer, 'Image').props.source).toEqual({
            uri: contactPhoto
        });
    });

    it.each([
        ['lightning', LightningSvg],
        ['onchain', OnChainSvg],
        ['ecash', EcashSvg]
    ] as const)(
        'falls back from contact to LNURL to the %s layer on image errors',
        async (layer, LayerIcon) => {
            jest.mocked(getActivityLayer).mockReturnValue(layer);
            jest.mocked(getActivityContactPhoto).mockReturnValue(
                'https://example.com/contact.png'
            );
            const renderer = await mount();
            expect(oneOfType(renderer, 'Image').props.source.uri).toBe(
                'https://example.com/contact.png'
            );
            const badgeIcon = oneOfType(renderer, LayerIcon);
            expect(badgeIcon.props).toMatchObject({
                width: layer === 'ecash' ? 38 : 26,
                height: layer === 'ecash' ? 38 : 26,
                circle: false,
                color: '#46BE43'
            });
            expect(
                StyleSheet.flatten(badgeIcon.parent!.props.style)
            ).toMatchObject({
                position: 'absolute',
                right: 0,
                bottom: 0,
                width: 18,
                height: 18,
                backgroundColor: '#1F242D',
                borderColor: '#46BE43'
            });

            await act(async () => oneOfType(renderer, 'Image').props.onError());
            expect(oneOfType(renderer, 'Image').props.source.uri).toBe(
                'https://example.com/first.png'
            );
            expect(oneOfType(renderer, LayerIcon).props.width).toBe(
                layer === 'ecash' ? 38 : 26
            );

            await act(async () => oneOfType(renderer, 'Image').props.onError());
            expect(allOfType(renderer, 'Image')).toHaveLength(0);
            expect(allOfType(renderer, LayerIcon)).toHaveLength(1);
            expect(oneOfType(renderer, LayerIcon).props).toMatchObject({
                width: layer === 'ecash' ? 58 : 40,
                height: layer === 'ecash' ? 58 : 40,
                circle: false,
                color: '#46BE43'
            });
        }
    );

    it.each([true, false])(
        'ignores a stale lookup when the old hash resolves first: %s',
        async (oldResolvesFirst) => {
            const oldLookup = deferred();
            const newLookup = deferred();
            load.mockImplementation((hash) =>
                hash === 'first' ? oldLookup.promise : newLookup.promise
            );
            const renderer = await mount();
            const newItem = payment('second');
            await renderer.rerender(
                React.createElement(ActivityIcon, {
                    ...props,
                    item: newItem
                })
            );
            expect(load.mock.calls).toEqual([['first'], ['second']]);
            expect(allOfType(renderer, 'Image')).toHaveLength(0);

            if (oldResolvesFirst) {
                await act(async () => oldLookup.resolve(transaction('first')));
                expect(allOfType(renderer, 'Image')).toHaveLength(0);
                expect(getActivityContactPhoto).not.toHaveBeenCalled();
            }
            await act(async () => newLookup.resolve(transaction('second')));
            expect(oneOfType(renderer, 'Image').props.source.uri).toBe(
                'https://example.com/second.png'
            );
            if (!oldResolvesFirst) {
                await act(async () => oldLookup.resolve(transaction('first')));
            }
            expect(oneOfType(renderer, 'Image').props.source.uri).toBe(
                'https://example.com/second.png'
            );
            expect(getActivityContactPhoto).toHaveBeenLastCalledWith(
                newItem,
                props.ContactStore!.contacts,
                transaction('second')
            );
        }
    );

    it('shares pending and completed lookups between icons with the same hash', async () => {
        const lookup = deferred();
        load.mockReturnValue(lookup.promise);
        const first = await mount();
        const second = await mount(payment('first'));
        expect(load).toHaveBeenCalledTimes(1);
        expect(load).toHaveBeenCalledWith('first');
        expect(imageCache.has('first')).toBe(true);
        expect(allOfType(second, 'Image')).toHaveLength(0);

        await act(async () => lookup.resolve(transaction('first')));
        const third = await mount(payment('first'));
        for (const renderer of [first, second, third]) {
            expect(oneOfType(renderer, 'Image').props.source.uri).toBe(
                'https://example.com/first.png'
            );
        }
        expect(load).toHaveBeenCalledTimes(1);
    });

    it.each([
        ['a payment without a hash', payment('')],
        ['a non-payment with a hash field', { resolvedPaymentHash: 'first' }]
    ])('does not load history for %s', async (_description, item) => {
        const renderer = await mount(item);
        expect(load).not.toHaveBeenCalled();
        expect(imageCache.size).toBe(0);
        expect(getActivityContactPhoto).toHaveBeenCalledWith(
            item,
            props.ContactStore!.contacts,
            undefined
        );
        expect(allOfType(renderer, 'Image')).toHaveLength(0);
        expect(allOfType(renderer, LightningSvg)).toHaveLength(1);
    });
});
