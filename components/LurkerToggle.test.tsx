jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../utils/LocaleUtils');
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: (key: string) => `theme:${key}`
}));
jest.mock('./SVG/MatiSvg', () => 'MatiSvg');

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import LurkerToggle from './LurkerToggle';

const ENABLE = 'components.LurkerToggle.enable';
const DISABLE = 'components.LurkerToggle.disable';

const renderToggle = async ({
    lurkerMode,
    lurkerExposed = false,
    privacy = { lurkerMode }
}: {
    lurkerMode?: boolean;
    lurkerExposed?: boolean;
    privacy?: any;
}) => {
    const SettingsStore = {
        settings: { privacy },
        lurkerExposed,
        setLurkerMode: jest.fn()
    };
    await render(<LurkerToggle {...({ SettingsStore } as any)} />);
    const icon = screen.container.queryAll((n: any) => n.type === 'MatiSvg')[0];
    return { SettingsStore, icon };
};

describe('LurkerToggle', () => {
    it('shows the open eye and turns lurker mode on when it is off', async () => {
        const { SettingsStore, icon } = await renderToggle({
            lurkerMode: false
        });

        expect(icon.props.off).toBe(false);
        expect(icon.props.circle).toBe(false);
        await fireEvent.press(screen.getByLabelText(ENABLE));

        expect(SettingsStore.setLurkerMode).toHaveBeenCalledWith(true);
    });

    it('shows the crossed out eye and turns lurker mode off when it is on', async () => {
        const { SettingsStore, icon } = await renderToggle({
            lurkerMode: true
        });

        expect(icon.props.off).toBe(true);
        await fireEvent.press(screen.getByLabelText(DISABLE));

        expect(SettingsStore.setLurkerMode).toHaveBeenCalledWith(false);
    });

    it('counts a long press reveal as lurker mode being on', async () => {
        // toggleLurker clears the in-memory setting while values are
        // revealed, and restores it when the reveal ends
        const { SettingsStore, icon } = await renderToggle({
            lurkerMode: false,
            lurkerExposed: true
        });

        expect(icon.props.off).toBe(true);
        await fireEvent.press(screen.getByLabelText(DISABLE));

        expect(SettingsStore.setLurkerMode).toHaveBeenCalledWith(false);
    });

    it('treats a missing privacy group as lurker mode off', async () => {
        const { SettingsStore, icon } = await renderToggle({
            privacy: null
        });

        expect(icon.props.off).toBe(false);
        await fireEvent.press(screen.getByLabelText(ENABLE));

        expect(SettingsStore.setLurkerMode).toHaveBeenCalledWith(true);
    });
});
