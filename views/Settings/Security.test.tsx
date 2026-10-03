import React from 'react';
import renderer, { act } from 'react-test-renderer';

// mobx-react's main entry needs react-dom; the stores arrive as props here
jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => ({
    Icon: () => null,
    ListItem: Object.assign(() => null, {
        Content: () => null,
        Title: () => null
    })
}));
jest.mock('../../components/Header', () => () => null);
jest.mock('../../components/Screen', () => () => null);
jest.mock('../../components/Switch', () => () => null);
jest.mock('../../stores/SettingsStore', () => ({}));
jest.mock('../../utils/BiometricUtils', () => ({
    verifyBiometry: jest.fn()
}));
jest.mock('../../utils/LocaleUtils', () => ({
    localeString: jest.fn((key: string) => key)
}));
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
        settings: { pin: '1234', isBiometryEnabled },
        enableBiometry: jest.fn(async () => enableResult),
        disableBiometry: jest.fn(() => Promise.resolve())
    };
    const ModalStore = { toggleInfoModal: jest.fn() };
    const navigation = { addListener: jest.fn(), navigate: jest.fn() };
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
        tree = renderer.create(
            <Security
                SettingsStore={SettingsStore as any}
                ModalStore={ModalStore as any}
                navigation={navigation as any}
                route={{ params: {} } as any}
            />
        );
    });
    const instance = tree!.root.findByType(Security).instance as Security;
    return { SettingsStore, ModalStore, instance };
};

describe('Security biometrics toggle', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('turns biometrics on without a message when enabling succeeds', async () => {
        const { ModalStore, instance } = await renderSecurity();

        await act(async () => {
            await instance.handleBiometricsSwitchChange(true);
        });

        expect(instance.state.isBiometryEnabled).toBe(true);
        expect(ModalStore.toggleInfoModal).not.toHaveBeenCalled();
    });

    it('stays off without a message when the user cancels the prompt', async () => {
        const { ModalStore, instance } = await renderSecurity({
            enableResult: 'cancelled'
        });

        await act(async () => {
            await instance.handleBiometricsSwitchChange(true);
        });

        expect(instance.state.isBiometryEnabled).toBe(false);
        expect(ModalStore.toggleInfoModal).not.toHaveBeenCalled();
    });

    it.each(['failed', 'invalidated'])(
        'stays off and explains why when enabling is %s',
        async (enableResult) => {
            const { ModalStore, instance } = await renderSecurity({
                enableResult
            });

            await act(async () => {
                await instance.handleBiometricsSwitchChange(true);
            });

            expect(instance.state.isBiometryEnabled).toBe(false);
            expect(ModalStore.toggleInfoModal).toHaveBeenCalledWith({
                text: 'views.Settings.Security.Biometrics.enableFailed'
            });
        }
    );

    it.each(['success', 'invalidated'])(
        'turns biometrics off when verification is %s',
        async (result) => {
            mockedVerifyBiometry.mockResolvedValue(result);
            const { SettingsStore, ModalStore, instance } =
                await renderSecurity({ isBiometryEnabled: true });

            await act(async () => {
                await instance.handleBiometricsSwitchChange(false);
            });

            expect(SettingsStore.disableBiometry).toHaveBeenCalled();
            expect(instance.state.isBiometryEnabled).toBe(false);
            expect(ModalStore.toggleInfoModal).not.toHaveBeenCalled();
        }
    );

    it('stays on and explains why when verification fails while disabling', async () => {
        mockedVerifyBiometry.mockResolvedValue('failed');
        const { SettingsStore, ModalStore, instance } = await renderSecurity({
            isBiometryEnabled: true
        });

        await act(async () => {
            await instance.handleBiometricsSwitchChange(false);
        });

        expect(SettingsStore.disableBiometry).not.toHaveBeenCalled();
        expect(instance.state.isBiometryEnabled).toBe(true);
        expect(ModalStore.toggleInfoModal).toHaveBeenCalledWith({
            text: 'views.Settings.Security.Biometrics.disableFailed'
        });
    });

    it('stays on without a message when the user cancels disabling', async () => {
        mockedVerifyBiometry.mockResolvedValue('cancelled');
        const { SettingsStore, ModalStore, instance } = await renderSecurity({
            isBiometryEnabled: true
        });

        await act(async () => {
            await instance.handleBiometricsSwitchChange(false);
        });

        expect(SettingsStore.disableBiometry).not.toHaveBeenCalled();
        expect(ModalStore.toggleInfoModal).not.toHaveBeenCalled();
    });
});
