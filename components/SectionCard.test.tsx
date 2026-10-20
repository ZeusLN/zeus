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
