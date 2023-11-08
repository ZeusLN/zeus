import * as React from 'react';
import { NativeModules, Platform, View } from 'react-native';
import { inject, observer } from 'mobx-react';

import CopyButton from '../../../components/CopyButton';
import Screen from '../../../components/Screen';
import Header from '../../../components/Header';
import LogBox from '../../../components/LogBox';

import SettingsStore from '../../../stores/SettingsStore';

import { localeString } from '../../../utils/LocaleUtils';
import { themeColor } from '../../../utils/ThemeUtils';
import { LndMobileToolsEventEmitter } from '../../../utils/EventListenerUtils';

interface LNDLogsProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

interface LNDLogsState {
    log: string;
}

@inject('SettingsStore')
@observer
export default class LNDLogs extends React.Component<
    LNDLogsProps,
    LNDLogsState
> {
    state = {
        log: ''
    };

    UNSAFE_componentWillMount(): void {
        const { SettingsStore } = this.props;
        const { embeddedLndNetwork } = SettingsStore;
        (async () => {
            const network =
                embeddedLndNetwork === 'Testnet' ? 'testnet' : 'mainnet';
            const tailLog = await NativeModules.LndMobileTools.tailLog(
                100,
                network
            );
            let log = tailLog
                .split('\n')
                .map((row) => row.slice(11))
                .join('\n');

            LndMobileToolsEventEmitter.addListener('lndlog', (data: string) => {
                log = log + data.slice(11);
                this.setState({
                    log
                });
            });

            NativeModules.LndMobileTools.observeLndLogFile(network);
            this.setState({
                log
            });
        })();
    }

    render() {
        const { navigation } = this.props;
        const { log } = this.state;

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString(
                                'views.Settings.EmbeddedNode.LNDLogs.title'
                            ),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }
                        }}
                        navigation={navigation}
                    />
                    <LogBox text={log} scrollLock={false} />
                    <View
                        style={{
                            marginBottom: Platform.OS === 'android' ? 20 : 0
                        }}
                    >
                        <CopyButton
                            title={localeString(
                                'views.Settings.EmbeddedNode.LNDLogs.copyLogs'
                            )}
                            copyValue={log}
                        />
                    </View>
                </View>
            </Screen>
        );
    }
}
