jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../../../../lndmobile/LndMobileInjection', () => ({
    chantools: { sweepRemoteClosed: jest.fn() }
}));
jest.mock('../../../../ldknode/LdkNodeInjection', () => ({}));
jest.mock('../../../../utils/LocaleUtils');
jest.mock('../../../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../../../../components/Accordion', () => 'Accordion');
jest.mock('../../../../components/Button', () => 'Button');
jest.mock('../../../../components/DropdownSetting', () => 'DropdownSetting');
jest.mock('../../../../components/Header', () => 'Header');
jest.mock('../../../../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../../../../components/OnchainFeeInput', () => 'OnchainFeeInput');
jest.mock('../../../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../../../components/ShowHideToggle', () => 'ShowHideToggle');
jest.mock('../../../../components/SuccessErrorMessage', () => ({
    ErrorMessage: 'ErrorMessage'
}));
jest.mock('../../../../components/Text', () => {
    const { Text } = require('react-native');
    return Text;
});
jest.mock('../../../../components/TextInput', () => {
    const { TextInput } = require('react-native');
    return (props: any) => <TextInput {...props} />;
});

import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import Sweepremoteclosed from './Sweepremoteclosed';

const SEED = 'cherry truth mask employ box silver mass bunker fiscal vote';

// Opens the screen on an embedded LND wallet with "External wallet seed"
// selected and a seed typed in
const renderWithExternalSeed = async () => {
    await render(
        <Sweepremoteclosed
            {...({
                navigation: { navigate: jest.fn() },
                NodeInfoStore: { nodeInfo: {} },
                SettingsStore: { implementation: 'embedded-lnd' }
            } as any)}
        />
    );
    const [seedTypeDropdown] = screen.container.queryAll(
        (n) =>
            n.type === 'DropdownSetting' &&
            n.props.selectedValue === 'currentWalletsSeed'
    );
    await fireEvent(seedTypeDropdown, 'valueChange', 'externalWalletSeed');
    await fireEvent.changeText(screen.getByPlaceholderText(SEED), SEED);
};

describe('Sweepremoteclosed', () => {
    it('hides the external wallet seed by default', async () => {
        await renderWithExternalSeed();

        const input = screen.getByDisplayValue(SEED);
        expect(input.props.secureTextEntry).toBe(true);
        expect(input.props.autoCorrect).toBe(false);
    });

    it('shows the external wallet seed after the show/hide toggle is pressed', async () => {
        await renderWithExternalSeed();

        const [toggle] = screen.container.queryAll(
            (n) => n.type === 'ShowHideToggle'
        );
        await act(async () => toggle.props.onPress());

        expect(screen.getByDisplayValue(SEED).props.secureTextEntry).toBe(
            false
        );
    });
});
