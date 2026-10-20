jest.mock('@rneui/themed', () => {
    const { Pressable } = require('react-native');
    return {
        Icon: ({ onPress, accessibilityLabel }: any) => (
            <Pressable
                role="button"
                onPress={onPress}
                accessibilityLabel={accessibilityLabel}
            />
        )
    };
});
jest.mock('../utils/LocaleUtils');
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: (key: string) => `theme:${key}`
}));

import * as React from 'react';
import { Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import SectionCard from './SectionCard';

describe('SectionCard', () => {
    it('shows the title and children on the secondary color', async () => {
        await render(
            <SectionCard title="Amount">
                <Text>50,000 sats</Text>
            </SectionCard>
        );

        expect(screen.getByText('Amount')).toBeOnTheScreen();
        expect(screen.getByText('50,000 sats')).toBeOnTheScreen();
        expect(screen.getByText('Amount').parent!.parent).toHaveStyle({
            backgroundColor: 'theme:secondary'
        });
        expect(
            screen.queryByRole('button', { name: 'general.info' })
        ).toBeNull();
    });

    it('sets the title in the heavier weight', async () => {
        await render(<SectionCard title="Amount" />);

        expect(screen.getByText('Amount')).toHaveStyle({
            fontFamily: 'PPNeueMontreal-Medium',
            fontSize: 18,
            color: 'theme:secondaryText'
        });
    });

    it('uses the screen background when nested', async () => {
        await render(<SectionCard title="Output 2" nested />);

        expect(screen.getByText('Output 2').parent!.parent).toHaveStyle({
            backgroundColor: 'theme:background'
        });
        expect(screen.getByText('Output 2')).toHaveStyle({ fontSize: 16 });
    });

    it('opens the info from the info button', async () => {
        const onInfoPress = jest.fn();
        await render(<SectionCard title="Fee" onInfoPress={onInfoPress} />);

        await fireEvent.press(
            screen.getByRole('button', { name: 'general.info' })
        );

        expect(onInfoPress).toHaveBeenCalledTimes(1);
    });

    it('leaves out the header without a title or info button', async () => {
        await render(
            <SectionCard>
                <Text>body</Text>
            </SectionCard>
        );

        expect(screen.getByText('body').parent).toHaveStyle({
            backgroundColor: 'theme:secondary'
        });
    });
});

describe('SectionCard collapsible', () => {
    const renderCard = (expanded: boolean, onToggle = jest.fn()) =>
        render(
            <SectionCard
                title="Fee"
                expanded={expanded}
                onToggle={onToggle}
                summary={<Text>Fastest fee 5</Text>}
                onInfoPress={jest.fn()}
            >
                <Text>presets</Text>
            </SectionCard>
        ).then(() => onToggle);

    it('shows the summary in place of the children when closed', async () => {
        await renderCard(false);

        expect(screen.getByText('Fastest fee 5')).toBeOnTheScreen();
        expect(screen.queryByText('presets')).toBeNull();
        expect(
            screen.getByRole('button', { name: 'Fee' }).props.accessibilityState
                .expanded
        ).toBe(false);
    });

    it('shows the children in place of the summary when open', async () => {
        await renderCard(true);

        expect(screen.getByText('presets')).toBeOnTheScreen();
        expect(screen.queryByText('Fastest fee 5')).toBeNull();
        expect(
            screen.getByRole('button', { name: 'Fee' }).props.accessibilityState
                .expanded
        ).toBe(true);
    });

    it('toggles from the title and from the summary', async () => {
        const onToggle = await renderCard(false);

        await fireEvent.press(screen.getByRole('button', { name: 'Fee' }));
        await fireEvent.press(screen.getByText('Fastest fee 5'));

        expect(onToggle).toHaveBeenCalledTimes(2);
    });

    it('keeps the info button separate from the toggle', async () => {
        const onToggle = await renderCard(false);

        await fireEvent.press(
            screen.getByRole('button', { name: 'general.info' })
        );

        expect(onToggle).not.toHaveBeenCalled();
    });

    it('cannot be closed without onToggle', async () => {
        await render(
            <SectionCard title="Amount" expanded={false}>
                <Text>input</Text>
            </SectionCard>
        );

        expect(screen.getByText('input')).toBeOnTheScreen();
        expect(screen.queryByRole('button', { name: 'Amount' })).toBeNull();
    });
});
