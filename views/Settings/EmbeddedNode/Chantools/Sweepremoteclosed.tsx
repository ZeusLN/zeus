import * as React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import Button from '../../../../components/Button';
import DropdownSetting from '../../../../components/DropdownSetting';
import Header from '../../../../components/Header';
import OnchainFeeInput from '../../../../components/OnchainFeeInput';
import Screen from '../../../../components/Screen';
import Text from '../../../../components/Text';
import TextInput from '../../../../components/TextInput';

import { localeString } from '../../../../utils/LocaleUtils';
import { themeColor } from '../../../../utils/ThemeUtils';

export const API_URL_KEYS = [
    {
        key: 'https://blockstream.info/api',
        value: 'https://blockstream.info/api'
    },
    { key: 'https://mempool.space/api', value: 'https://mempool.space/api' },
    { key: 'Custom', value: 'Custom' }
];

interface SweepremoteclosedProps {
    navigation: any;
}

interface SweepremoteclosedState {
    seed: string;
    sweepAddr: string;
    apiUrl: string;
    customApiUrl: string;
    feeRate: string;
    recoveryWindow: string;
    loading: boolean;
}

export default class Sweepremoteclosed extends React.Component<
    SweepremoteclosedProps,
    SweepremoteclosedState
> {
    state = {
        seed: '',
        sweepAddr: '',
        apiUrl: 'https://mempool.space/api',
        customApiUrl: '',
        feeRate: '21',
        recoveryWindow: '200',
        loading: false
    };

    render() {
        const { navigation } = this.props;
        const {
            seed,
            sweepAddr,
            apiUrl,
            customApiUrl,
            feeRate,
            recoveryWindow,
            loading
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
                    <ScrollView style={{ margin: 10 }}>
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
                                value={seed}
                                onChangeText={(text: string) =>
                                    this.setState({
                                        seed: text
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
                                {localeString(
                                    'views.Settings.EmbeddedNode.Chantools.Sweepremoteclosed.sweepAddr'
                                )}
                            </Text>
                            <TextInput
                                value={sweepAddr}
                                onChangeText={(text: string) =>
                                    this.setState({
                                        sweepAddr: text
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
                            />
                        </>
                        <>
                            <Text
                                style={{
                                    ...styles.text,
                                    color: themeColor('secondaryText')
                                }}
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
                        {apiUrl === 'Custom' && (
                            <>
                                <Text
                                    style={{
                                        ...styles.text,
                                        color: themeColor('secondaryText')
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
                                            sweepAddr: text
                                        })
                                    }
                                    locked={customApiUrl}
                                />
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
                                onPress={() => {
                                    console.log('start sweepremoteclosed');
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
