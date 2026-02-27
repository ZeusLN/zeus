import * as React from 'react';
import { NativeModules, Platform, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import CopyButton from '../../../components/CopyButton';
import Screen from '../../../components/Screen';
import Header from '../../../components/Header';
import LogBox from '../../../components/LogBox';

import SettingsStore from '../../../stores/SettingsStore';

import { localeString } from '../../../utils/LocaleUtils';
import { themeColor } from '../../../utils/ThemeUtils';
import { LdkNodeEventEmitter } from '../../../utils/EventListenerUtils';

interface LDKLogsProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
}

interface LDKLogsState {
    log: string;
}

@inject('SettingsStore')
@observer
export default class LDKLogs extends React.Component<
    LDKLogsProps,
    LDKLogsState
> {
    state = {
        log: ''
    };
    logListener: any = null;

    async componentDidMount(): Promise<void> {
        (async () => {
            const tailLog = await NativeModules.LdkNodeModule.tailLdkNodeLog(
                100
            );
            let log = tailLog;

            this.logListener = LdkNodeEventEmitter.addListener(
                'ldklog',
                (data: string) => {
                    log = log + data;
                    this.setState({ log });
                }
            );

            NativeModules.LdkNodeModule.observeLdkNodeLogFile().catch(
                (e: any) => {
                    console.log('Could not observe LDK log file:', e);
                }
            );

            this.setState({ log });
        })();
    }

    componentWillUnmount(): void {
        if (this.logListener) {
            this.logListener.remove();
        }
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
                                'views.Settings.EmbeddedNode.LDKLogs.title'
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
                                'views.Settings.EmbeddedNode.LDKLogs.copyLogs'
                            )}
                            copyValue={log}
                        />
                    </View>
                </View>
            </Screen>
        );
    }
}
