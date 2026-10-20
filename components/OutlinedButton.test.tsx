jest.mock('@rneui/themed', () => ({ Icon: 'Icon' }));
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: (key: string) => `theme:${key}`
}));

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import OutlinedButton from './OutlinedButton';

const icons = () => screen.container.queryAll((n) => n.type === 'Icon');

describe('OutlinedButton', () => {
    it('is labelled by its title and presses', async () => {
        const onPress = jest.fn();
        await render(<OutlinedButton title="Add output" onPress={onPress} />);

        await fireEvent.press(
            screen.getByRole('button', { name: 'Add output' })
        );

        expect(onPress).toHaveBeenCalledTimes(1);
        expect(icons()).toHaveLength(0);
    });

    it('takes a separate accessibility label', async () => {
        await render(
            <OutlinedButton
                title="+"
                accessibilityLabel="Add output"
                onPress={jest.fn()}
            />
        );

        expect(
            screen.getByRole('button', { name: 'Add output' })
        ).toBeOnTheScreen();
    });

    it('shows the icon after the title in the text color', async () => {
        await render(
            <OutlinedButton title="Add output" icon="add" onPress={jest.fn()} />
        );

        expect(icons()[0].props).toMatchObject({
            name: 'add',
            color: 'theme:text'
        });
        expect(screen.getByRole('button')).toHaveStyle({
            borderColor: 'theme:text'
        });
    });

    it('greys out and ignores presses when disabled', async () => {
        const onPress = jest.fn();
        await render(
            <OutlinedButton
                title="Add output"
                icon="add"
                onPress={onPress}
                disabled
            />
        );

        await fireEvent.press(screen.getByRole('button'));

        expect(onPress).not.toHaveBeenCalled();
        expect(screen.getByRole('button')).toBeDisabled();
        expect(screen.getByRole('button')).toHaveStyle({
            borderColor: 'theme:secondaryText'
        });
        expect(icons()[0].props.color).toBe('theme:secondaryText');
    });
});
