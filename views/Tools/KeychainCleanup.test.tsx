jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../../utils/KeychainPurgeUtils', () => ({
    scanPurgeCandidates: jest.fn(),
    verifyPurgePreflight: jest.fn(),
    executePurge: jest.fn()
}));
jest.mock('../../components/Header', () => {
    const { Text } = require('react-native');
    return ({ centerComponent }: any) => <Text>{centerComponent.text}</Text>;
});
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/Button', () => {
    const { Text, TouchableOpacity } = require('react-native');
    return ({ title, onPress }: any) => (
        <TouchableOpacity onPress={onPress}>
            <Text>{title}</Text>
        </TouchableOpacity>
    );
});
jest.mock('../../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../../components/Text', () => {
    const { Text } = require('react-native');
    return ({ children }: any) => <Text>{children}</Text>;
});

import * as React from 'react';
import { Alert, Platform } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import KeychainCleanup from './KeychainCleanup';
import { scanPurgeCandidates } from '../../utils/KeychainPurgeUtils';

const KEY = 'views.Tools.keychainCleanup';

// What scanPurgeCandidates finds on each platform: Android has no
// iCloud-synced partition, so syncServers is always empty there
const SCANS: { [os: string]: any } = {
    android: {
        syncServers: [],
        legacyLocalServers: ['zeus-settings'],
        hasLegacyEncryptedSettings: true
    },
    ios: {
        syncServers: ['zeus-settings-v2'],
        legacyLocalServers: ['zeus-settings'],
        hasLegacyEncryptedSettings: false
    }
};
const NOTHING_FOUND = {
    syncServers: [],
    legacyLocalServers: [],
    hasLegacyEncryptedSettings: false
};

const renderOn = async (os: 'android' | 'ios', scan: any) => {
    jest.replaceProperty(Platform, 'OS', os);
    (scanPurgeCandidates as jest.Mock).mockResolvedValue(scan);
    await render(<KeychainCleanup navigation={{} as any} />);
};

afterEach(() => {
    jest.restoreAllMocks();
});

describe('KeychainCleanup wording', () => {
    it.each([
        ['android', '.android'],
        ['ios', '']
    ] as const)(
        'uses the %s strings on the screen and in the confirm dialog',
        async (os, suffix) => {
            const alert = jest.spyOn(Alert, 'alert').mockImplementation();
            await renderOn(os, SCANS[os]);

            expect(screen.getByText(`${KEY}.title${suffix}`)).toBeOnTheScreen();
            expect(
                screen.getByText(`${KEY}.explainer1${suffix}`)
            ).toBeOnTheScreen();

            await fireEvent.press(
                await screen.findByText(`${KEY}.purgeButton${suffix}`)
            );

            expect(alert).toHaveBeenCalledWith(
                `${KEY}.confirmTitle${suffix}`,
                `${KEY}.confirmMessage${suffix}`,
                expect.any(Array)
            );
        }
    );

    it.each([
        ['android', '.android'],
        ['ios', '']
    ] as const)(
        'uses the %s string when nothing is found',
        async (os, suffix) => {
            await renderOn(os, NOTHING_FOUND);

            expect(
                await screen.findByText(`${KEY}.nothingFound${suffix}`)
            ).toBeOnTheScreen();
        }
    );
});
