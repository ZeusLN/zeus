// The Security screen's rows and its re-auth gate follow the lock the
// Lockscreen asks for: a plaintext credential the verifier migration has
// not hashed yet counts, one an older build deleted ('' beside its old
// verifier) does not, and a method set on an older build after a
// downgrade wins over the other method's records.
jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('react-native-biometrics', () => ({ BiometryType: {} }));
jest.mock('@rneui/themed', () => {
    const Part = () => null;
    const ListItem: any = () => null;
    ListItem.Content = Part;
    ListItem.Title = Part;
    return { Icon: Part, ListItem };
});
jest.mock('../../stores/SettingsStore', () => ({}));
jest.mock('../../stores/ModalStore', () => ({}));
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/Switch', () => 'Switch');
jest.mock('../../utils/BiometricUtils', () => ({
    verifyBiometry: jest.fn(async () => false)
}));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));

import * as React from 'react';
import { act, render } from '@testing-library/react-native';

import Security from './Security';

// hasVerifier checks the shape only
const record = { v: 1, kdf: 'pbkdf2-sha256', salt: 'aa', hash: 'bb' };

const renderSecurity = async (settings: any) => {
    const ref = React.createRef<any>();
    const navigation = {
        navigate: jest.fn(),
        addListener: jest.fn(),
        removeListener: jest.fn(),
        setParams: jest.fn()
    };
    const ModalStore = { toggleInfoModal: jest.fn() };
    await render(
        <Security
            ref={ref}
            SettingsStore={{ settings, updateSettings: jest.fn() } as any}
            ModalStore={ModalStore as any}
            navigation={navigation as any}
            route={{ params: {} }}
        />
    );
    return { security: ref.current, navigation, ModalStore };
};

const rows = (security: any) =>
    security.state.displaySecurityItems.map((item: any) => item.translateKey);

const PIN_ROWS = [
    'views.Settings.ChangePin.title',
    'views.Settings.Security.deletePIN',
    'views.Settings.SetDuressPin.title'
];
const SET_ROWS = [
    'views.Settings.SetPassword.title',
    'views.Settings.SetPin.title'
];

describe('Security rows', () => {
    it('lists the PIN rows for a PIN still in plaintext', async () => {
        const { security } = await renderSecurity({
            pin: '1234',
            duressPin: '0000'
        });

        expect(rows(security)).toEqual([
            'views.Settings.ChangePin.title',
            'views.Settings.Security.deletePIN',
            'views.Settings.ChangeDuressPin.title',
            'views.Settings.Security.deleteDuressPIN'
        ]);
        expect(security.state.pinExists).toBe(true);
    });

    it('offers to set a lock when an older build deleted the PIN', async () => {
        const { security } = await renderSecurity({
            pinVerifier: record,
            pin: ''
        });

        expect(rows(security)).toEqual(SET_ROWS);
        expect(security.state.pinExists).toBe(false);
    });

    it('lists the PIN rows for a PIN set after a downgrade over an older passphrase', async () => {
        const { security } = await renderSecurity({
            passphraseVerifier: record,
            pin: '2222'
        });

        expect(rows(security)).toEqual(PIN_ROWS);
        expect(security.state.passphraseExists).toBe(false);
    });
});

describe('Security navigateSecurity', () => {
    it.each([
        ['SetPin', { pin: '1234' }],
        ['SetPassword', { passphrase: 'open sesame' }],
        ['SetPin', { pinVerifier: record }]
    ])(
        'sends %s through the Lockscreen when a lock is set (%j)',
        async (screenName, settings) => {
            const { security, navigation } = await renderSecurity(settings);

            await act(async () => {
                security.navigateSecurity({
                    translateKey: 'x',
                    screen: screenName
                });
            });

            expect(navigation.navigate).toHaveBeenCalledWith('Lockscreen', {
                modifySecurityScreen: screenName
            });
        }
    );

    it('opens SetPin directly when an older build deleted the PIN', async () => {
        const { security, navigation } = await renderSecurity({
            pinVerifier: record,
            pin: ''
        });

        await act(async () => {
            security.navigateSecurity({ translateKey: 'x', screen: 'SetPin' });
        });

        expect(navigation.navigate).toHaveBeenCalledWith('SetPin');
    });
});

describe('Security handleBiometricsSwitchChange', () => {
    it('enables biometrics over a PIN still in plaintext', async () => {
        const { security, ModalStore } = await renderSecurity({ pin: '1234' });

        await act(async () => {
            await security.handleBiometricsSwitchChange(true);
        });

        expect(ModalStore.toggleInfoModal).not.toHaveBeenCalled();
    });

    it('asks for a PIN or password first when an older build deleted the PIN', async () => {
        const { security, ModalStore } = await renderSecurity({
            pinVerifier: record,
            pin: ''
        });

        await act(async () => {
            await security.handleBiometricsSwitchChange(true);
        });

        expect(ModalStore.toggleInfoModal).toHaveBeenCalledTimes(1);
    });
});
