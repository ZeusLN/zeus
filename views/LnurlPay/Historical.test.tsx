jest.mock('@rneui/themed', () => ({ Icon: 'Icon' }));
jest.mock('../../utils/ThemeUtils', () => ({ themeColor: () => '#ffffff' }));
jest.mock('../../utils/LocaleUtils');
jest.mock('js-lnurl/lib/helpers', () => ({
    decipherAES: () => 'Decrypted receipt'
}));

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Historical from './Historical';

// Host elements with no accessible role or text: the metadata image and the
// arrow Icon (mocked as a host component above)
const countOfType = (type: string) =>
    screen.container.queryAll((node) => node.type === type).length;

const metadataText = () => screen.getByText('Polar Cafe');
// The arrow sits outside any link inside the details panel, so a press on it
// always reaches the toggle
const arrow = () =>
    screen.container.queryAll((node) => node.type === 'Icon')[0];
const queryMetadataText = () => screen.queryByText('Polar Cafe');

describe('LNURL historical metadata toggle', () => {
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

    it.each([undefined, null, { tag: 'noop' }, { tag: 'unsupported' }])(
        'does not offer an empty details panel for %j',
        async (successAction) => {
            props.lnurlpaytx.successAction = successAction as any;
            await render(<Historical {...props} />);

            expect(metadataText()).toBeDisabled();
            expect(countOfType('Icon')).toBe(0);
            expect(countOfType('Image')).toBe(1);

            await fireEvent.press(metadataText());
            expect(metadataText()).toBeOnTheScreen();
        }
    );

    it.each([
        ['cafe.example', { tag: 'noop' }, /servicedBy: cafe\.example/],
        ['cafe.example', undefined, /servicedBy: cafe\.example/],
        ['', { tag: 'message', message: 'Thank you' }, /Thank you/],
        [
            '',
            {
                tag: 'url',
                description: 'Receipt',
                url: 'https://cafe.example/receipt'
            },
            /https:\/\/cafe\.example\/receipt/
        ],
        [
            '',
            {
                tag: 'aes',
                description: 'Receipt',
                ciphertext: 'ciphertext',
                iv: 'iv'
            },
            /Decrypted receipt/
        ]
    ])(
        'toggles both ways with domain %s and action %j',
        async (domain, successAction, successText) => {
            props.lnurlpaytx.domain = domain as string;
            props.lnurlpaytx.successAction = successAction as any;
            await render(<Historical {...props} />);

            expect(countOfType('Icon')).toBe(1);
            expect(metadataText()).toBeEnabled();

            await fireEvent.press(metadataText());
            expect(queryMetadataText()).not.toBeOnTheScreen();
            expect(countOfType('Image')).toBe(0);
            const details = screen.getByText(successText);
            expect(details).toBeOnTheScreen();

            await fireEvent.press(arrow());
            expect(metadataText()).toBeOnTheScreen();
            expect(countOfType('Image')).toBe(1);
            expect(screen.queryByText(successText)).not.toBeOnTheScreen();
        }
    );

    it('returns to metadata if displayed success details disappear', async () => {
        props.lnurlpaytx.domain = 'cafe.example';
        const { rerender } = await render(<Historical {...props} />);
        await fireEvent.press(metadataText());
        expect(screen.getByText(/servicedBy/)).toBeOnTheScreen();

        await rerender(
            <Historical
                {...props}
                lnurlpaytx={{ ...props.lnurlpaytx, domain: '' }}
            />
        );
        expect(countOfType('Image')).toBe(1);
        expect(metadataText()).toBeDisabled();
    });
});
