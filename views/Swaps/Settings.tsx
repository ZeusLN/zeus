import * as React from 'react';
import { Text, View } from 'react-native';
import { inject, observer } from 'mobx-react';

import Header from '../../components/Header';
import Screen from '../../components/Screen';
import DropdownSetting from '../../components/DropdownSetting';
import TextInput from '../../components/TextInput';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import NodeInfoStore from '../../stores/NodeInfoStore';
import SettingsStore, {
    DEFAULT_SWAP_HOST_TESTNET,
    DEFAULT_SWAP_HOST_MAINNET,
    SWAP_HOST_KEYS_TESTNET,
    SWAP_HOST_KEYS_MAINNET
} from '../../stores/SettingsStore';
import SwapStore from '../../stores/SwapStore';

interface SwapSettingsProps {
    navigation: any;
    NodeInfoStore: NodeInfoStore;
    SettingsStore: SettingsStore;
    SwapStore: SwapStore;
}

interface SwapSettingsState {
    host: string;
    customSwapHost: string;
}

@inject('NodeInfoStore', 'SettingsStore', 'SwapStore')
@observer
export default class SwapSettings extends React.Component<
    SwapSettingsProps,
    SwapSettingsState
> {
    constructor(props: SwapSettingsProps) {
        super(props);

        const isTestnet = props.NodeInfoStore?.nodeInfo?.isTestNet;
        const { settings } = props.SettingsStore;

        this.state = {
            host: isTestnet
                ? settings.swapHostTestnet || DEFAULT_SWAP_HOST_TESTNET
                : settings.swapHostMainnet || DEFAULT_SWAP_HOST_MAINNET,
            customSwapHost: settings.customSwapHost || ''
        };
    }

    async UNSAFE_componentWillMount() {
        const { SettingsStore, NodeInfoStore } = this.props;
        const isTestnet = NodeInfoStore?.nodeInfo?.isTestNet;
        const { settings } = SettingsStore;

        this.setState({
            host: isTestnet
                ? settings.swapHostTestnet || DEFAULT_SWAP_HOST_TESTNET
                : settings.swapHostMainnet || DEFAULT_SWAP_HOST_MAINNET,
            customSwapHost: settings.customSwapHost || ''
        });
    }
    render() {
        const { navigation, SettingsStore, NodeInfoStore } = this.props;
        const { customSwapHost, host } = this.state;
        const { updateSettings } = SettingsStore;
        const isTestnet = NodeInfoStore?.nodeInfo?.isTestNet;
        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Settings.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />
                <View style={{ paddingHorizontal: 20 }}>
                    <DropdownSetting
                        title="Service Provider"
                        selectedValue={host}
                        onValueChange={async (value: string) => {
                            this.setState({ host: value });

                            await updateSettings({
                                [isTestnet
                                    ? 'swapHostTestnet'
                                    : 'swapHostMainnet']: value
                            });
                        }}
                        values={
                            isTestnet
                                ? SWAP_HOST_KEYS_TESTNET
                                : SWAP_HOST_KEYS_MAINNET
                        }
                    />

                    {host === 'Custom' && (
                        <>
                            <Text
                                style={{
                                    color: themeColor('secondaryText'),
                                    fontFamily: 'PPNeueMontreal-Book'
                                }}
                            >
                                {localeString('views.OpenChannel.host')}
                            </Text>
                            <TextInput
                                value={customSwapHost}
                                placeholder={
                                    isTestnet
                                        ? DEFAULT_SWAP_HOST_TESTNET
                                        : DEFAULT_SWAP_HOST_MAINNET
                                }
                                onChangeText={async (text: string) => {
                                    this.setState({ customSwapHost: text });

                                    await updateSettings({
                                        customSwapHost: text
                                    });
                                }}
                                autoCapitalize="none"
                                error={!customSwapHost}
                            />
                        </>
                    )}
                </View>
            </Screen>
        );
    }
}
