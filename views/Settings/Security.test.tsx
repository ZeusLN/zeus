import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

// mobx-react's main entry needs react-dom; the stores arrive as props here
jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => {
    const { Text, View } = require('react-native');
    const Passthrough = ({ children }: any) => <View>{children}</View>;
    return {
        Icon: () => null,
        ListItem: Object.assign(Passthrough, {
            Content: Passthrough,
            Title: ({ children }: any) => <Text>{children}</Text>
        })
    };
});
jest.mock('../../components/Header', () => () => null);
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../stores/SettingsStore', () => ({}));
jest.mock('../../utils/BiometricUtils', () => ({
    verifyBiometry: jest.fn()
}));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: jest.fn(() => '#000')
}));

import { verifyBiometry } from '../../utils/BiometricUtils';
import Security from './Security';

const mockedVerifyBiometry = verifyBiometry as jest.Mock;

const renderSecurity = async ({
    enableResult = 'success',
    isBiometryEnabled = false
}: { enableResult?: string; isBiometryEnabled?: boolean } = {}) => {
    const SettingsStore = {
        settings: {
            pin: '1234',
            isBiometryEnabled,
            supportedBiometryType: 'FaceID'
        },
        enableBiometry: jest.fn(async () => enableResult),
        disableBiometry: jest.fn(() => Promise.resolve())
    };
    const ModalStore = { toggleInfoModal: jest.fn() };
    const navigation = { addListener: jest.fn(), navigate: jest.fn() };
    await render(
        <Security
            SettingsStore={SettingsStore as any}
            ModalStore={ModalStore as any}
            navigation={navigation as any}
            route={{ params: {} } as any}
        />
    );
    return { SettingsStore, ModalStore };
};

// The biometrics row is rendered before the scramble-PIN row, so its switch
// is the first one on screen
const biometricsSwitch = () => {
    expect(
        screen.getByText('views.Settings.Security.FaceID.title')
    ).toBeOnTheScreen();
    return screen.getAllByRole('switch')[0];
};

const toggleBiometrics = (value: boolean) =>
    fireEvent(biometricsSwitch(), 'change', { nativeEvent: { value } });

describe('Security biometrics toggle', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('turns biometrics on without a message when enabling succeeds', async () => {
        const { SettingsStore, ModalStore } = await renderSecurity();
        expect(biometricsSwitch()).not.toBeChecked();

        await toggleBiometrics(true);

        expect(SettingsStore.enableBiometry).toHaveBeenCalledWith(
            'views.Settings.Security.Biometrics.prompt'
        );
        expect(biometricsSwitch()).toBeChecked();
        expect(ModalStore.toggleInfoModal).not.toHaveBeenCalled();
    });

    it('stays off without a message when the user cancels the prompt', async () => {
        const { ModalStore } = await renderSecurity({
            enableResult: 'cancelled'
        });

        await toggleBiometrics(true);

        expect(biometricsSwitch()).not.toBeChecked();
        expect(ModalStore.toggleInfoModal).not.toHaveBeenCalled();
    });

    it.each(['failed', 'invalidated'])(
        'stays off and explains why when enabling is %s',
        async (enableResult) => {
            const { ModalStore } = await renderSecurity({ enableResult });

            await toggleBiometrics(true);

            expect(biometricsSwitch()).not.toBeChecked();
            expect(ModalStore.toggleInfoModal).toHaveBeenCalledWith({
                text: 'views.Settings.Security.Biometrics.enableFailed'
            });
        }
    );

    it.each(['success', 'invalidated'])(
        'turns biometrics off when verification is %s',
        async (result) => {
            mockedVerifyBiometry.mockResolvedValue(result);
            const { SettingsStore, ModalStore } = await renderSecurity({
                isBiometryEnabled: true
            });
            expect(biometricsSwitch()).toBeChecked();

            await toggleBiometrics(false);

            expect(SettingsStore.disableBiometry).toHaveBeenCalled();
            expect(biometricsSwitch()).not.toBeChecked();
            expect(ModalStore.toggleInfoModal).not.toHaveBeenCalled();
        }
    );

    it('stays on and explains why when verification fails while disabling', async () => {
        mockedVerifyBiometry.mockResolvedValue('failed');
        const { SettingsStore, ModalStore } = await renderSecurity({
            isBiometryEnabled: true
        });

        await toggleBiometrics(false);

        expect(SettingsStore.disableBiometry).not.toHaveBeenCalled();
        expect(biometricsSwitch()).toBeChecked();
        expect(ModalStore.toggleInfoModal).toHaveBeenCalledWith({
            text: 'views.Settings.Security.Biometrics.disableFailed'
        });
    });

    it('stays on without a message when the user cancels disabling', async () => {
        mockedVerifyBiometry.mockResolvedValue('cancelled');
        const { SettingsStore, ModalStore } = await renderSecurity({
            isBiometryEnabled: true
        });

        await toggleBiometrics(false);

        expect(SettingsStore.disableBiometry).not.toHaveBeenCalled();
        expect(biometricsSwitch()).toBeChecked();
        expect(ModalStore.toggleInfoModal).not.toHaveBeenCalled();
    });
});
