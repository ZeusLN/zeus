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
import SwapStore from '../../stores/SwapStore';

interface SwapSettingsProps {
    navigation: any;
    NodeInfoStore: NodeInfoStore;
    SwapStore: SwapStore;
}

interface SwapSettingsState {
    serviceProvider: string;
    host: string;
}

@inject('NodeInfoStore', 'SwapStore')
@observer
export default class LSPS1Settings extends React.Component<
    SwapSettingsProps,
    SwapSettingsState
> {
    constructor(props: SwapSettingsProps) {
        super(props);
        this.state = {
            serviceProvider: 'ZEUS',
            host: ''
        };
    }
    render() {
        const { navigation, SwapStore } = this.props;
        const { serviceProvider, host } = this.state;
        const isTestnet = this.props.NodeInfoStore?.nodeInfo?.isTestNet;
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
                        selectedValue={serviceProvider}
                        values={[
                            {
                                key: 'ZEUS',
                                value: 'ZEUS'
                            },
                            {
                                key: 'Boltz',
                                value: 'Boltz'
                            },
                            {
                                key: 'Swap Market',
                                value: 'SwapMarket'
                            },
                            {
                                key: 'Custom',
                                translateKey: 'general.custom',
                                value: 'Custom'
                            }
                        ]}
                        onValueChange={(value: string) => {
                            if (value === 'Boltz') {
                                const host = isTestnet
                                    ? 'https://api.testnet.boltz.exchange/v2'
                                    : 'https://api.boltz.exchange/v2';
                                this.setState({
                                    serviceProvider: 'Boltz',
                                    host: host
                                });
                            } else if (value === 'ZEUS') {
                                // zeus endpoints are in WIP
                                const host = isTestnet ? '' : '';
                                this.setState({
                                    serviceProvider: 'ZEUS',
                                    host: host
                                });
                            } else if (value === 'SwapMarket') {
                                const host = isTestnet
                                    ? 'https://api.testnet.boltz.exchange/v2/swap/submarine'
                                    : 'https://api.middleway.space/v2/swap/submarine';
                                this.setState({
                                    serviceProvider: 'SwapMarket',
                                    host: host
                                });
                            } else {
                                this.setState({
                                    serviceProvider: 'Custom',
                                    host: 'https://api.boltz.exchange/v2'
                                });
                            }
                            SwapStore.setHost(host);
                        }}
                    />

                    {serviceProvider === 'Custom' && (
                        <>
                            <Text
                                style={{
                                    color: themeColor('secondaryText')
                                }}
                            >
                                {localeString(
                                    'views.Settings.AddEditNode.host'
                                )}
                            </Text>
                            <TextInput
                                placeholder={localeString(
                                    'views.SwapSettings.customHost'
                                )}
                                value={host}
                                onChangeText={(text: string) => {
                                    this.setState({
                                        host: text
                                    });
                                    SwapStore.setHost(host);
                                }}
                            />
                        </>
                    )}
                </View>
            </Screen>
        );
    }
}
