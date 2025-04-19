import * as React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import Button from '../../components/Button';
import Screen from '../../components/Screen';
import Text from '../../components/Text';
import Header from '../../components/Header';

import NodeInfoStore from '../../stores/NodeInfoStore';
import UnitsStore from '../../stores/UnitsStore';

import BackendUtils from '../../utils/BackendUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import UrlUtils from '../../utils/UrlUtils';

interface ZaplockerGetChanProps {
    navigation: StackNavigationProp<any, any>;
    NodeInfoStore: NodeInfoStore;
    UnitsStore: UnitsStore;
    route: Route<
        'ZaplockerGetChan',
        { skipStatus: boolean; relays: string[]; nostrPrivateKey: string }
    >;
}

@inject('NodeInfoStore', 'UnitsStore')
@observer
export default class ZaplockerGetChan extends React.Component<
    ZaplockerGetChanProps,
    {}
> {
    render() {
        const { navigation, NodeInfoStore, UnitsStore } = this.props;

        const { flowLspNotConfigured } = NodeInfoStore.flowLspNotConfigured();
        const supportsLSPS1 =
            BackendUtils.supportsLSPScustomMessage() ||
            BackendUtils.supportsLSPS1rest();

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString('general.lightningAddress'),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }
                        }}
                        navigation={navigation}
                    />
                    <View style={{ flex: 1, margin: 5 }}>
                        <View
                            style={{
                                flex: 1,
                                marginLeft: 5,
                                marginRight: 5
                            }}
                        >
                            <ScrollView style={{ margin: 10 }}>
                                <Text
                                    style={{
                                        ...styles.explainer,
                                        color: themeColor('text')
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.LightningAddress.explainer1'
                                    )}
                                </Text>
                                {BackendUtils.supportsFlowLSP() &&
                                    !flowLspNotConfigured && (
                                        <Text
                                            style={{
                                                ...styles.explainer,
                                                color: themeColor('text')
                                            }}
                                        >
                                            {localeString(
                                                'views.Settings.LightningAddress.explainer2'
                                            ).replace(
                                                'OLYMPUS by ZEUS',
                                                'Olympus by ZEUS'
                                            )}
                                        </Text>
                                    )}
                                {BackendUtils.supportsFlowLSP() &&
                                    !flowLspNotConfigured && (
                                        <Text
                                            style={{
                                                ...styles.explainer,
                                                color: themeColor('text')
                                            }}
                                        >
                                            {localeString(
                                                'views.Wallet.KeypadPane.lspExplainerFirstChannel'
                                            )}
                                        </Text>
                                    )}
                                {supportsLSPS1 && (
                                    <Text
                                        style={{
                                            ...styles.explainer,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {localeString(
                                            'views.Settings.LightningAddress.explainer3'
                                        ).replace(
                                            'OLYMPUS by ZEUS',
                                            'Olympus by ZEUS'
                                        )}
                                    </Text>
                                )}
                            </ScrollView>
                            <View style={{ bottom: 10 }}>
                                {BackendUtils.supportsFlowLSP() &&
                                    !flowLspNotConfigured && (
                                        <View
                                            style={{
                                                margin: 10
                                            }}
                                        >
                                            <Button
                                                title={localeString(
                                                    'views.Settings.LightningAddress.get0ConfChan'
                                                )}
                                                onPress={() => {
                                                    UnitsStore.resetUnits();
                                                    navigation.navigate(
                                                        'Receive',
                                                        {
                                                            amount: '100000'
                                                        }
                                                    );
                                                }}
                                            />
                                        </View>
                                    )}

                                {supportsLSPS1 && !flowLspNotConfigured && (
                                    <View
                                        style={{
                                            margin: 10
                                        }}
                                    >
                                        <Button
                                            title={localeString(
                                                'views.Settings.LightningAddress.getStandardChan'
                                            )}
                                            onPress={() => {
                                                navigation.navigate('LSPS1');
                                            }}
                                        />
                                    </View>
                                )}
                                <View style={{ margin: 10 }}>
                                    <Button
                                        title={localeString(
                                            'views.Intro.lightningLiquidity'
                                        )}
                                        onPress={() =>
                                            UrlUtils.goToUrl(
                                                'https://bitcoin.design/guide/how-it-works/liquidity/'
                                            )
                                        }
                                        secondary
                                    />
                                </View>
                            </View>
                        </View>
                    </View>
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    explainer: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 20,
        marginBottom: 10
    }
});
