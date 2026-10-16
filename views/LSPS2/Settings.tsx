import * as React from 'react';
import { inject, observer } from 'mobx-react';
import { Text, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../../components/Button';
import Header from '../../components/Header';
import Screen from '../../components/Screen';
import TextInput from '../../components/TextInput';

import { getActiveLsps2NodeId } from '../../utils/LdkNodeUtils';
import { localeString } from '../../utils/LocaleUtils';
import { restartNeeded } from '../../utils/RestartUtils';
import { themeColor } from '../../utils/ThemeUtils';

import NodeInfoStore from '../../stores/NodeInfoStore';
import SettingsStore, {
    getLspConfigForNetwork
} from '../../stores/SettingsStore';

interface LSPS2SettingsProps {
    navigation: NativeStackNavigationProp<any, any>;
    NodeInfoStore: NodeInfoStore;
    SettingsStore: SettingsStore;
}

interface LSPS2SettingsState {
    pubkey: string;
    host: string;
    token: string;
    changed: boolean;
}

const networkKeys = (nodeInfo: any) =>
    nodeInfo?.isMutinynet
        ? {
              pubkey: 'lsps2PubkeyMutinynet',
              host: 'lsps2HostMutinynet'
          }
        : nodeInfo?.isTestNet
        ? { pubkey: 'lsps2PubkeyTestnet', host: 'lsps2HostTestnet' }
        : { pubkey: 'lsps2PubkeyMainnet', host: 'lsps2HostMainnet' };

@inject('NodeInfoStore', 'SettingsStore')
@observer
export default class LSPS2Settings extends React.Component<
    LSPS2SettingsProps,
    LSPS2SettingsState
> {
    private original: { pubkey: string; host: string; token: string };

    constructor(props: LSPS2SettingsProps) {
        super(props);
        const { settings } = props.SettingsStore;
        const config = getLspConfigForNetwork(
            settings,
            props.NodeInfoStore.nodeInfo
        );
        this.original = {
            pubkey: config.lsps2Pubkey,
            host: config.lsps2Host,
            token: settings.lsps2Token || ''
        };
        this.state = { ...this.original, changed: false };
    }

    update = (field: 'pubkey' | 'host' | 'token', value: string) => {
        const { SettingsStore, NodeInfoStore } = this.props;
        const next = { ...this.state, [field]: value };
        this.setState({
            [field]: value,
            changed:
                next.pubkey !== this.original.pubkey ||
                next.host !== this.original.host ||
                next.token !== this.original.token
        } as any);
        const key =
            field === 'token'
                ? 'lsps2Token'
                : networkKeys(NodeInfoStore.nodeInfo)[field];
        return SettingsStore.updateSettings({ [key]: value });
    };

    // Cleared fields fall back to the default LSPS2 LSP, if there is one
    clear = () => {
        const { SettingsStore, NodeInfoStore } = this.props;
        const keys = networkKeys(NodeInfoStore.nodeInfo);
        this.setState({
            pubkey: '',
            host: '',
            token: '',
            changed: !!(
                this.original.pubkey ||
                this.original.host ||
                this.original.token
            )
        });
        return SettingsStore.updateSettings({
            [keys.pubkey]: '',
            [keys.host]: '',
            lsps2Token: ''
        });
    };

    // The node reads its LSPS2 LSP only when it is built
    componentWillUnmount() {
        if (this.state.changed) restartNeeded();
    }

    render() {
        const { navigation } = this.props;
        const { pubkey, host, token } = this.state;

        const activeNodeId = getActiveLsps2NodeId();

        const labelStyle = {
            color: themeColor('secondaryText'),
            fontSize: 16,
            marginTop: 12
        };

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString(
                            'view.Settings.LSPServicesList.lsps2'
                        ),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />
                <View style={{ flex: 1, padding: 12 }}>
                    <Text
                        style={{
                            color: themeColor('secondaryText'),
                            fontSize: 14,
                            fontFamily: 'PPNeueMontreal-Book',
                            marginBottom: 8
                        }}
                    >
                        {localeString('views.LSPS2.description')}
                    </Text>
                    <Text
                        style={{
                            color: themeColor('text'),
                            fontSize: 14,
                            fontFamily: 'PPNeueMontreal-Book'
                        }}
                    >
                        {activeNodeId
                            ? `${localeString(
                                  'views.LSPS2.active'
                              )}: ${activeNodeId.slice(
                                  0,
                                  8
                              )}…${activeNodeId.slice(-8)}`
                            : localeString('views.LSPS2.inactive')}
                    </Text>

                    <Text style={labelStyle}>
                        {localeString('views.OpenChannel.nodePubkey')}
                    </Text>
                    <TextInput
                        value={pubkey}
                        placeholder={'02...'}
                        onChangeText={(text: string) =>
                            this.update('pubkey', text)
                        }
                        autoCapitalize="none"
                        autoCorrect={false}
                    />

                    <Text style={labelStyle}>
                        {localeString('views.OpenChannel.host')}
                    </Text>
                    <TextInput
                        value={host}
                        placeholder={localeString('views.OpenChannel.hostPort')}
                        onChangeText={(text: string) =>
                            this.update('host', text)
                        }
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="url"
                    />

                    <Text style={labelStyle}>
                        {localeString('general.discountCode')}
                    </Text>
                    <TextInput
                        value={token}
                        onChangeText={(text: string) =>
                            this.update('token', text)
                        }
                        autoCapitalize="none"
                        autoCorrect={false}
                    />

                    {(!!pubkey || !!host || !!token) && (
                        <Button
                            containerStyle={{ paddingTop: 20 }}
                            title={localeString('general.clear')}
                            onPress={this.clear}
                            secondary
                        />
                    )}
                </View>
            </Screen>
        );
    }
}
