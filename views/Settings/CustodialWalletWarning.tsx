import * as React from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { inject, observer } from 'mobx-react';

import Button from '../../components/Button';
import Header from '../../components/Header';
import Screen from '../../components/Screen';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import SettingsStore from '../../stores/SettingsStore';

interface CustodialWalletWarningProps {
    SettingsStore: SettingsStore;
    navigation: any;
}

@inject('SettingsStore')
@observer
export default class CustodialWalletWarning extends React.Component<
    CustodialWalletWarningProps,
    {}
> {
    render() {
        const { SettingsStore, navigation } = this.props;
        const nodes = SettingsStore?.settings?.nodes || [];

        // check if user has embedded node wallet configured already
        let hasEmbeddedWallet;
        if (nodes) {
            const result = nodes?.filter(
                (node) => node.implementation === 'embedded-lnd'
            );
            if (result.length > 0) {
                hasEmbeddedWallet = true;
            }
        }

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: `⚠ ${localeString(
                            'general.warning'
                        ).toUpperCase()}`,
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />
                <ScrollView
                    style={{
                        flex: 1,
                        backgroundColor: themeColor('background')
                    }}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={{ margin: 20 }}>
                        <Text
                            style={{
                                ...styles.text,
                                color: themeColor('text')
                            }}
                        >
                            {localeString(
                                'views.Settings.CustodialWalletWarning.graph1'
                            )}
                        </Text>
                        <Text
                            style={{
                                ...styles.text,
                                color: themeColor('text')
                            }}
                        >
                            {localeString(
                                'views.Settings.CustodialWalletWarning.graph2'
                            )}
                        </Text>
                        {!hasEmbeddedWallet && (
                            <>
                                <Text
                                    style={{
                                        ...styles.text,
                                        color: themeColor('text')
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.CustodialWalletWarning.graph3'
                                    )}
                                </Text>
                                <Text
                                    style={{
                                        ...styles.text,
                                        color: themeColor('text')
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.CustodialWalletWarning.graph4'
                                    )}
                                </Text>
                            </>
                        )}
                    </View>
                </ScrollView>
                {!hasEmbeddedWallet && (
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
                                    'views.Settings.CustodialWalletWarning.create'
                                )}
                                onPress={() => {
                                    navigation.navigate('NodeConfiguration', {
                                        newEntry: true,
                                        index:
                                            (nodes &&
                                                nodes.length &&
                                                Number(nodes.length)) ||
                                            0
                                    });
                                }}
                            />
                        </View>
                    </View>
                )}
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    text: {
        fontSize: 18,
        paddingTop: 12
    }
});
