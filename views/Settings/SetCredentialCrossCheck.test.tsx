// Each Set* screen refuses a credential equal to its counterpart (a duress
// PIN equal to the PIN, and so on). The counterpart may still be in
// plaintext, when the verifier migration has not landed, or deleted by an
// older build that left '' next to its old verifier. These run the real
// LockVerifierUtils, with Node's PBKDF2 standing in for the native KDF.
jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../../stores/SettingsStore', () => ({}));
jest.mock('../../stores/ModalStore', () => ({}));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/LockKdf');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../../utils/ActionUtils', () => ({ confirmAction: jest.fn() }));
jest.mock('react-native-randombytes', () => ({
    randomBytes: (length: number) => require('crypto').randomBytes(length)
}));
jest.mock('../../components/Button', () => 'Button');
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/Pin', () => 'Pin');
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/SuccessErrorMessage', () => ({
    ErrorMessage: () => null
}));
jest.mock('../../components/TextInput', () => {
    const React = require('react');
    return React.forwardRef((_props: any, ref: any) => {
        React.useImperativeHandle(ref, () => ({ focus: jest.fn() }));
        return null;
    });
});

import * as React from 'react';
import { act, render } from '@testing-library/react-native';

import { deriveVerifier } from '../../utils/LockVerifierUtils';
import SetPin from './SetPin';
import SetDuressPin from './SetDuressPin';
import SetPassword from './SetPassword';
import SetDuressPassword from './SetDuressPassword';

const SECRET = '1234';

// screen, the state it reads the new credential from, its error flag,
// and the counterpart it must differ from
const SCREENS: Array<[string, any, string, string, string]> = [
    ['SetPin', SetPin, 'pin', 'pinInvalidError', 'duressPin'],
    ['SetDuressPin', SetDuressPin, 'duressPin', 'duressPinInvalidError', 'pin'],
    [
        'SetPassword',
        SetPassword,
        'passphrase',
        'passphraseInvalidError',
        'duressPassphrase'
    ],
    [
        'SetDuressPassword',
        SetDuressPassword,
        'duressPassphrase',
        'duressPassphraseInvalidError',
        'passphrase'
    ]
];

const save = async (Screen: any, field: string, settings: any) => {
    const ref = React.createRef<any>();
    const updateSettings = jest.fn(async () => settings);
    const SettingsStore = {
        settings,
        getSettings: jest.fn(async () => settings),
        updateSettings,
        setLoginStatus: jest.fn()
    };
    await render(
        <Screen
            ref={ref}
            SettingsStore={SettingsStore as any}
            ModalStore={{} as any}
            navigation={{ popTo: jest.fn() } as any}
            route={{ params: {} }}
        />
    );
    await act(async () => {
        ref.current.setState({
            [field]: SECRET,
            [`${field}Confirm`]: SECRET
        });
    });
    await act(async () => {
        await ref.current.saveSettings();
    });
    return { state: ref.current.state, updateSettings };
};

describe.each(SCREENS)(
    '%s cross-check',
    (_, Screen, field, errorFlag, counterpart) => {
        it('refuses a credential equal to the counterpart held in plaintext', async () => {
            const { state, updateSettings } = await save(Screen, field, {
                [counterpart]: SECRET
            });

            expect(state[errorFlag]).toBe(true);
            expect(updateSettings).not.toHaveBeenCalled();
        });

        it('refuses a credential equal to the hashed counterpart', async () => {
            const { state, updateSettings } = await save(Screen, field, {
                [`${counterpart}Verifier`]: await deriveVerifier(SECRET)
            });

            expect(state[errorFlag]).toBe(true);
            expect(updateSettings).not.toHaveBeenCalled();
        });

        it('accepts it when an older build deleted the counterpart', async () => {
            const { state, updateSettings } = await save(Screen, field, {
                [`${counterpart}Verifier`]: await deriveVerifier(SECRET),
                [counterpart]: ''
            });

            expect(state[errorFlag]).toBe(false);
            expect(updateSettings).toHaveBeenCalledWith(
                expect.objectContaining({
                    [`${field}Verifier`]: expect.objectContaining({
                        kdf: 'pbkdf2-sha256'
                    }),
                    [field]: undefined
                })
            );
        });
    }
);
