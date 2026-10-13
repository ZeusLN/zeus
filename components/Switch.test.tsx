import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('../utils/ThemeUtils', () => ({
    themeColor: jest.fn((key: string) => `theme:${key}`)
}));

import Switch from './Switch';

// The native switch (iOS in Jest) takes thumbColor as thumbTintColor and the
// two track colors as onTintColor (on) and tintColor (off)
const renderSwitch = async (props: any) => {
    await render(<Switch {...props} />);
    return screen.getByRole('switch');
};

describe('Switch', () => {
    it('uses the highlight color for the thumb and track when on', async () => {
        const sw = await renderSwitch({ value: true });
        expect(sw).toHaveProp('thumbTintColor', 'theme:highlight');
        expect(sw).toHaveProp('onTintColor', 'theme:highlight');
        expect(sw).toHaveProp('tintColor', 'theme:disabled');
    });

    it('uses the disabled color for the thumb when off', async () => {
        const sw = await renderSwitch({ value: false });
        expect(sw).toHaveProp('thumbTintColor', 'theme:disabled');
        expect(sw).toHaveProp('tintColor', 'theme:disabled');
    });

    it('uses trackEnabledColor for the on track when given', async () => {
        const sw = await renderSwitch({
            value: true,
            trackEnabledColor: '#123456'
        });
        expect(sw).toHaveProp('onTintColor', '#123456');
        expect(sw).toHaveProp('thumbTintColor', 'theme:highlight');
    });

    it('aligns itself to the end of its row', async () => {
        const sw = await renderSwitch({ value: false });
        expect(sw).toHaveStyle({ alignSelf: 'flex-end' });
    });

    it('passes value and onValueChange through', async () => {
        const onValueChange = jest.fn();
        const sw = await renderSwitch({ value: true, onValueChange });
        expect(sw).toBeChecked();
        // Fire the native switch's own change event. A 'valueChange' event
        // would reach Switch's onValueChange prop directly and pass even
        // if Switch never forwarded it to the native switch.
        await fireEvent(sw, 'change', { nativeEvent: { value: false } });
        expect(onValueChange).toHaveBeenCalledWith(false);
    });

    it('passes disabled through', async () => {
        const sw = await renderSwitch({ value: true, disabled: true });
        expect(sw).toHaveProp('disabled', true);
    });

    it('is unchecked and enabled by default when off', async () => {
        const sw = await renderSwitch({ value: false });
        expect(sw).not.toBeChecked();
        expect(sw).not.toHaveProp('disabled', true);
    });
});
