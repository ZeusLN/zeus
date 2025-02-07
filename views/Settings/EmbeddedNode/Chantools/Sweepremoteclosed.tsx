import * as React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { inject, observer } from 'mobx-react';

import lndMobile from '../../../../lndmobile/LndMobileInjection';
const { sweepRemoteClosed } = lndMobile.chantools;

import Button from '../../../../components/Button';
import DropdownSetting from '../../../../components/DropdownSetting';
import Header from '../../../../components/Header';
import KeyValue from '../../../../components/KeyValue';
import LoadingIndicator from '../../../../components/LoadingIndicator';
import OnchainFeeInput from '../../../../components/OnchainFeeInput';
import { Row } from '../../../../components/layout/Row';
import Screen from '../../../../components/Screen';
import { ErrorMessage } from '../../../../components/SuccessErrorMessage';
import Text from '../../../../components/Text';
import TextInput from '../../../../components/TextInput';

import { localeString } from '../../../../utils/LocaleUtils';
import { themeColor } from '../../../../utils/ThemeUtils';

import NodeInfoStore from '../../../../stores/NodeInfoStore';
import SettingsStore from '../../../../stores/SettingsStore';

import CaretDown from '../../../../assets/images/SVG/Caret Down.svg';
import CaretRight from '../../../../assets/images/SVG/Caret Right.svg';

const SEED_PHRASE_KEYS = [
    {
        key: "Current wallet's seed",
        value: 'currentWalletsSeed',
        translateKey:
            'views.Settings.EmbeddedNode.Chantools.Sweepremoteclosed.currentWalletsSeed'
    },
    {
        key: 'External wallet seed',
        value: 'externalWalletSeed',
        translateKey:
            'views.Settings.EmbeddedNode.Chantools.Sweepremoteclosed.externalWalletSeed'
    }
];

const API_URL_KEYS = [
    {
        key: 'https://api.node-recovery.com',
        value: 'https://api.node-recovery.com'
    },
    {
        key: 'https://blockstream.info/api',
        value: 'https://blockstream.info/api'
    },
    { key: 'https://mempool.space/api', value: 'https://mempool.space/api' },
    { key: 'Custom', value: 'custom', translateKey: 'general.custom' }
];

interface SweepremoteclosedProps {
    navigation: StackNavigationProp<any, any>;
    NodeInfoStore: NodeInfoStore;
    SettingsStore: SettingsStore;
}

interface SweepremoteclosedState {
    seedType: string;
    externalSeed: string;
    sweepAddr: string;
    apiUrl: string;
    customApiUrl: string;
    feeRate: string;
    sleepSeconds: string;
    recoveryWindow: string;
    loading: boolean;
    settingsToggle: boolean;
    error: string;
}

@inject('NodeInfoStore', 'SettingsStore')
@observer
export default class Sweepremoteclosed extends React.Component<
    SweepremoteclosedProps,
    SweepremoteclosedState
> {
    state = {
        seedType: 'currentWalletsSeed',
        externalSeed: '',
        sweepAddr: '',
        apiUrl: 'https://api.node-recovery.com',
        customApiUrl: '',
        feeRate: '21',
        recoveryWindow: '200',
        sleepSeconds: '0',
        loading: false,
        settingsToggle: false,
        error: ''
    };

    render() {
        const { navigation, NodeInfoStore, SettingsStore } = this.props;
        const {
            seedType,
            externalSeed,
            sweepAddr,
            apiUrl,
            customApiUrl,
            feeRate,
            recoveryWindow,
            sleepSeconds,
            loading,
            settingsToggle,
            error
        } = this.state;
        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: 'sweepremoteclosed',
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }
                        }}
                        navigation={navigation}
                    />
                    {error && <ErrorMessage message={error} dismissable />}
                    {loading && <LoadingIndicator />}
                    <ScrollView style={{ margin: 10 }}>
                        <View style={{ marginTop: 10 }}>
                            <DropdownSetting
                                title={localeString(
                                    'views.Settings.EmbeddedNode.Chantools.Sweepremoteclosed.seedType'
                                )}
                                selectedValue={seedType}
                                onValueChange={(value: string) => {
                                    this.setState({
                                        seedType: value
                                    });
                                }}
                                values={SEED_PHRASE_KEYS}
                            />
                        </View>
                        {seedType === 'externalWalletSeed' && (
                            <>
                                <Text
                                    style={{
                                        ...styles.text,
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.EmbeddedNode.Chantools.Sweepremoteclosed.seed'
                                    )}
                                </Text>
                                <TextInput
                                    placeholder={
                                        'cherry truth mask employ box silver mass bunker fiscal vote'
                                    }
                                    value={externalSeed}
                                    onChangeText={(text: string) =>
                                        this.setState({
                                            externalSeed: text
                                        })
                                    }
                                    locked={loading}
                                />
                            </>
                        )}
                        <>
                            <Text
                                style={{
                                    ...styles.text,
                                    color: themeColor('secondaryText')
                                }}
                            >
                                {localeString(
                                    'views.Settings.EmbeddedNode.Chantools.Sweepremoteclosed.sweepAddr'
                                )}
                            </Text>
                            <TextInput
                                value={sweepAddr}
                                onChangeText={(text: string) =>
                                    this.setState({
                                        sweepAddr: text
                                            .trim()
                                            .replace(/^\s\n+|\s\n+$/g, '')
                                    })
                                }
                                locked={loading}
                            />
                        </>
                        <>
                            <Text
                                style={{
                                    ...styles.text,
                                    color: themeColor('secondaryText')
                                }}
                            >
                                {localeString('views.Send.feeSatsVbyte')}
                            </Text>
                            <OnchainFeeInput
                                fee={feeRate}
                                onChangeFee={(text: string) => {
                                    this.setState({
                                        feeRate: text
                                    });
                                }}
                                navigation={navigation}
                            />
                        </>
                        <TouchableOpacity
                            onPress={() => {
                                this.setState({
                                    settingsToggle: !settingsToggle
                                });
                            }}
                        >
                            <View
                                style={{
                                    marginBottom: 10
                                }}
                            >
                                <Row justify="space-between">
                                    <View style={{ width: '95%' }}>
                                        <KeyValue
                                            keyValue={localeString(
                                                'general.advancedSettings'
                                            )}
                                        />
                                    </View>
                                    {settingsToggle ? (
                                        <CaretDown
                                            fill={themeColor('text')}
                                            width="20"
                                            height="20"
                                        />
                                    ) : (
                                        <CaretRight
                                            fill={themeColor('text')}
                                            width="20"
                                            height="20"
                                        />
                                    )}
                                </Row>
                            </View>
                        </TouchableOpacity>
                        {settingsToggle && (
                            <>
                                <>
                                    <Text
                                        style={{
                                            ...styles.text,
                                            color: themeColor('secondaryText')
                                        }}
                                        infoModalText={localeString(
                                            'views.Settings.EmbeddedNode.Chantools.Sweepremoteclosed.recoveryWindow.explainer'
                                        )}
                                    >
                                        {localeString(
                                            'views.Settings.EmbeddedNode.Chantools.Sweepremoteclosed.recoveryWindow'
                                        )}
                                    </Text>
                                    <TextInput
                                        placeholder={'200'}
                                        value={recoveryWindow}
                                        onChangeText={(text: string) =>
                                            this.setState({
                                                recoveryWindow: text
                                            })
                                        }
                                        locked={loading}
                                        keyboardType="numeric"
                                    />
                                </>
                                <>
                                    <Text
                                        style={{
                                            ...styles.text,
                                            color: themeColor('secondaryText')
                                        }}
                                        infoModalText={localeString(
                                            'views.Settings.EmbeddedNode.Chantools.Sweepremoteclosed.sleepSeconds.explainer'
                                        )}
                                    >
                                        {localeString(
                                            'views.Settings.EmbeddedNode.Chantools.Sweepremoteclosed.sleepSeconds'
                                        )}
                                    </Text>
                                    <TextInput
                                        placeholder={'0'}
                                        value={sleepSeconds}
                                        onChangeText={(text: string) =>
                                            this.setState({
                                                sleepSeconds: text
                                            })
                                        }
                                        locked={loading}
                                        keyboardType="numeric"
                                    />
                                </>
                                <View style={{ marginTop: 10 }}>
                                    <DropdownSetting
                                        title={localeString(
                                            'views.Settings.EmbeddedNode.Chantools.Sweepremoteclosed.apiUrl'
                                        )}
                                        selectedValue={apiUrl}
                                        onValueChange={(value: string) => {
                                            this.setState({
                                                apiUrl: value
                                            });
                                        }}
                                        values={API_URL_KEYS}
                                    />
                                </View>
                                {apiUrl === 'custom' && (
                                    <>
                                        <Text
                                            style={{
                                                ...styles.text,
                                                color: themeColor(
                                                    'secondaryText'
                                                )
                                            }}
                                        >
                                            {localeString(
                                                'views.Settings.EmbeddedNode.Chantools.Sweepremoteclosed.customApiUrl'
                                            )}
                                        </Text>
                                        <TextInput
                                            value={customApiUrl}
                                            onChangeText={(text: string) =>
                                                this.setState({
                                                    customApiUrl: text
                                                        .trim()
                                                        .replace(
                                                            /^\s\n+|\s\n+$/g,
                                                            ''
                                                        )
                                                })
                                            }
                                            locked={loading}
                                        />
                                    </>
                                )}
                            </>
                        )}
                    </ScrollView>
                    <View style={{ bottom: 10 }}>
                        <View
                            style={{
                                paddingTop: 30,
                                paddingBottom: 15,
                                paddingLeft: 10,
                                paddingRight: 10
                            }}
                        >
                            <Button
                                title={localeString(
                                    'views.Settings.EmbeddedNode.Chantools.Sweepremoteclosed.start'
                                )}
                                onPress={async () => {
                                    this.setState({
                                        error: '',
                                        loading: true
                                    });
                                    console.log('start sweepremoteclosed', {
                                        seed:
                                            seedType === 'externalWalletSeed'
                                                ? externalSeed
                                                : SettingsStore?.seedPhrase.join(
                                                      ' '
                                                  ),
                                        apiUrl,
                                        customApiUrl,
                                        recoveryWindow,
                                        feeRate,
                                        sleepSeconds
                                    });
                                    try {
                                        const response =
                                            await sweepRemoteClosed(
                                                seedType ===
                                                    'externalWalletSeed'
                                                    ? externalSeed
                                                    : SettingsStore?.seedPhrase.join(
                                                          ' '
                                                      ),
                                                apiUrl === 'custom'
                                                    ? customApiUrl
                                                    : apiUrl,
                                                sweepAddr,
                                                Number(recoveryWindow || 200),
                                                Number(feeRate || 2),
                                                Number(sleepSeconds || 0),
                                                false, // publish
                                                NodeInfoStore?.nodeInfo
                                                    ?.isTestNet // isTestNet
                                            );
                                        navigation.navigate('TxHex', {
                                            txHex: response,
                                            hideWarning: true
                                        });
                                    } catch (e: any) {
                                        this.setState({
                                            error: e.toString(),
                                            loading: false
                                        });
                                    }
                                }}
                            />
                        </View>
                    </View>
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    text: {
        fontFamily: 'PPNeueMontreal-Book'
    }
});
