jest.mock('@rneui/themed', () => ({ Icon: 'Icon' }));
jest.mock('../../utils/ThemeUtils', () => ({ themeColor: () => '#ffffff' }));
jest.mock('../../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('js-lnurl/lib/helpers', () => ({
    decipherAES: () => 'Decrypted receipt'
}));

import React from 'react';
import { Image, TouchableOpacity } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import Historical from './Historical';
import Metadata from './Metadata';
import Success from './Success';

describe('LNURL historical metadata toggle', () => {
    let renderer: ReactTestRenderer;
    let props: React.ComponentProps<typeof Historical>;

    beforeEach(() => {
        props = {
            navigation: { navigate: jest.fn() },
            preimage: '00'.repeat(32),
            lnurlpaytx: {
                lnurl: '',
                domain: '',
                successAction: { tag: 'noop' },
                metadata: {
                    metadata: JSON.stringify([
                        ['text/plain', 'Polar Cafe'],
                        [
                            'image/png;base64',
                            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='
                        ]
                    ])
                }
            }
        } as unknown as React.ComponentProps<typeof Historical>;
    });

    afterEach(async () => {
        if (renderer) await act(async () => renderer.unmount());
    });

    async function mount() {
        await act(async () => {
            renderer = create(React.createElement(Historical, props));
        });
    }

    it.each([undefined, null, { tag: 'noop' }, { tag: 'unsupported' }])(
        'does not offer an empty details panel for %j',
        async (successAction) => {
            props.lnurlpaytx.successAction = successAction as any;
            await mount();

            expect(
                renderer.root.findByType(TouchableOpacity).props.disabled
            ).toBe(true);
            expect(renderer.root.findByType(Metadata).props.showArrow).toBe(
                false
            );
            expect(renderer.root.findAllByType(Image)).toHaveLength(1);
            expect(renderer.root.findAllByType(Success)).toHaveLength(0);
        }
    );

    it.each([
        ['cafe.example', { tag: 'noop' }],
        ['cafe.example', undefined],
        ['', { tag: 'message', message: 'Thank you' }],
        [
            '',
            {
                tag: 'url',
                description: 'Receipt',
                url: 'https://cafe.example/receipt'
            }
        ],
        [
            '',
            {
                tag: 'aes',
                description: 'Receipt',
                ciphertext: 'ciphertext',
                iv: 'iv'
            }
        ]
    ])(
        'toggles both ways with domain %s and action %j',
        async (domain, successAction) => {
            props.lnurlpaytx.domain = domain as string;
            props.lnurlpaytx.successAction = successAction as any;
            await mount();

            expect(renderer.root.findByType(Metadata).props.showArrow).toBe(
                true
            );
            const toggle = renderer.root.findAllByType(TouchableOpacity)[0];
            expect(toggle.props.disabled).toBe(false);
            await act(async () => toggle.props.onPress());
            expect(renderer.root.findAllByType(Image)).toHaveLength(0);
            expect(renderer.root.findAllByType(Success)).toHaveLength(1);
            expect(
                renderer.root.findByType(Success).children.length
            ).toBeGreaterThan(0);

            await act(async () => toggle.props.onPress());
            expect(renderer.root.findAllByType(Image)).toHaveLength(1);
            expect(renderer.root.findAllByType(Success)).toHaveLength(0);
        }
    );

    it('returns to metadata if displayed success details disappear', async () => {
        props.lnurlpaytx.domain = 'cafe.example';
        await mount();
        await act(async () =>
            renderer.root.findByType(TouchableOpacity).props.onPress()
        );
        expect(renderer.root.findAllByType(Success)).toHaveLength(1);

        await act(async () => {
            renderer.update(
                React.createElement(Historical, {
                    ...props,
                    lnurlpaytx: { ...props.lnurlpaytx, domain: '' }
                })
            );
        });
        expect(renderer.root.findAllByType(Image)).toHaveLength(1);
        expect(renderer.root.findByType(TouchableOpacity).props.disabled).toBe(
            true
        );
    });
});
