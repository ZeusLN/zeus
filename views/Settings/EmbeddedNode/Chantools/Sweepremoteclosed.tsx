import * as React from 'react';
import {
    ScrollView,
    StyleSheet,
    View,
    Platform,
    KeyboardAvoidingView
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { inject, observer } from 'mobx-react';

import lndMobile from '../../../../lndmobile/LndMobileInjection';
const { sweepRemoteClosed } = lndMobile.chantools;

import ldkNode from '../../../../ldknode/LdkNodeInjection';

import Button from '../../../../components/Button';
import DropdownSetting from '../../../../components/DropdownSetting';
import FormAccordion from '../../../../components/FormAccordion';
import Header from '../../../../components/Header';
import LoadingIndicator from '../../../../components/LoadingIndicator';
import OnchainFeeInput from '../../../../components/OnchainFeeInput';
import Screen from '../../../../components/Screen';
import { ErrorMessage } from '../../../../components/SuccessErrorMessage';
import Text from '../../../../components/Text';
import TextInput from '../../../../components/TextInput';

import { localeString } from '../../../../utils/LocaleUtils';
import { themeColor } from '../../../../utils/ThemeUtils';

import NodeInfoStore from '../../../../stores/NodeInfoStore';
import SettingsStore from '../../../../stores/SettingsStore';

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
    navigation: NativeStackNavigationProp<any, any>;
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
            error
        } = this.state;

        const isLdkNode = SettingsStore?.implementation === 'ldk-node';

        return (
            <Screen>
                <KeyboardAvoidingView
                    style={{
                        flex: 1,
                        backgroundColor: 'transparent'
                    }}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <View style={{ flex: 1 }}>
                        <Header
                            leftComponent="Back"
                            centerComponent={{
                                text: localeString(
                                    'views.Settings.EmbeddedNode.Chantools.Sweepremoteclosed.title'
                                ),
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
                            {isLdkNode && (
                                <Text
                                    style={{
                                        ...styles.text,
                                        color: themeColor('secondaryText'),
                                        marginBottom: 15
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.EmbeddedNode.Chantools.Sweepremoteclosed.ldkDescription'
                                    )}
                                </Text>
                            )}
                            {!isLdkNode && (
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
                            )}
                            {!isLdkNode && seedType === 'externalWalletSeed' && (
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
                                        autoCapitalize="none"
                                        autoCorrect={false}
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
                                    autoCapitalize="none"
                                    autoCorrect={false}
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
                            <FormAccordion
                                id="sweep-remote-closed-advanced"
                                title={localeString('general.advancedSettings')}
                            >
                                <>
                                    {!isLdkNode && (
                                        <>
                                            <Text
                                                style={{
                                                    ...styles.text,
                                                    color: themeColor(
                                                        'secondaryText'
                                                    )
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
                                                        recoveryWindow:
                                                            text.trim()
                                                    })
                                                }
                                                locked={loading}
                                                keyboardType="numeric"
                                            />
                                        </>
                                    )}
                                    <>
                                        <Text
                                            style={{
                                                ...styles.text,
                                                color: themeColor(
                                                    'secondaryText'
                                                )
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
                                                    sleepSeconds: text.trim()
                                                })
                                            }
                                            locked={loading}
                                            keyboardType="numeric"
                                        />
                                    </>
                                    {!isLdkNode && (
                                        <>
                                            <View style={{ marginTop: 10 }}>
                                                <DropdownSetting
                                                    title={localeString(
                                                        'views.Settings.EmbeddedNode.Chantools.Sweepremoteclosed.apiUrl'
                                                    )}
                                                    selectedValue={apiUrl}
                                                    onValueChange={(
                                                        value: string
                                                    ) => {
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
                                                        onChangeText={(
                                                            text: string
                                                        ) =>
                                                            this.setState({
                                                                customApiUrl:
                                                                    text
                                                                        .trim()
                                                                        .replace(
                                                                            /^\s\n+|\s\n+$/g,
                                                                            ''
                                                                        )
                                                            })
                                                        }
                                                        autoCapitalize="none"
                                                        autoCorrect={false}
                                                        locked={loading}
                                                    />
                                                </>
                                            )}
                                        </>
                                    )}
                                </>
                            </FormAccordion>
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
                                    disabled={!sweepAddr}
                                    onPress={async () => {
                                        this.setState({
                                            error: '',
                                            loading: true
                                        });
                                        try {
                                            if (isLdkNode) {
                                                const response =
                                                    await ldkNode.recovery.sweepRemoteClosedOutputs(
                                                        {
                                                            sweepAddress:
                                                                sweepAddr,
                                                            feeRateSatsPerVbyte:
                                                                Number(
                                                                    feeRate || 2
                                                                ),
                                                            sleepSeconds:
                                                                Number(
                                                                    sleepSeconds ||
                                                                        0
                                                                )
                                                        }
                                                    );
                                                navigation.navigate('TxHex', {
                                                    txHex: response,
                                                    hideWarning: true
                                                });
                                            } else {
                                                const response =
                                                    await sweepRemoteClosed({
                                                        seed:
                                                            seedType ===
                                                            'externalWalletSeed'
                                                                ? externalSeed
                                                                : SettingsStore?.seedPhrase.join(
                                                                      ' '
                                                                  ),
                                                        apiUrl:
                                                            apiUrl === 'custom'
                                                                ? customApiUrl
                                                                : apiUrl,
                                                        sweepAddr,
                                                        recoveryWindow: Number(
                                                            recoveryWindow ||
                                                                200
                                                        ),
                                                        feeRate: Number(
                                                            feeRate || 2
                                                        ),
                                                        sleepSeconds: Number(
                                                            sleepSeconds || 0
                                                        ),
                                                        publish: false,
                                                        isTestNet:
                                                            NodeInfoStore
                                                                ?.nodeInfo
                                                                ?.isTestNet
                                                    });
                                                navigation.navigate('TxHex', {
                                                    txHex: response,
                                                    hideWarning: true
                                                });
                                            }
                                        } catch (e: any) {
                                            const errorStr = e.toString();
                                            const isNoFunds =
                                                errorStr.includes(
                                                    'InsufficientFunds'
                                                );
                                            this.setState({
                                                error: isNoFunds
                                                    ? localeString(
                                                          'views.Settings.EmbeddedNode.Chantools.Sweepremoteclosed.noUtxosFound'
                                                      )
                                                    : errorStr,
                                                loading: false
                                            });
                                        }
                                    }}
                                />
                            </View>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    text: {
        fontFamily: 'PPNeueMontreal-Book'
    }
});
