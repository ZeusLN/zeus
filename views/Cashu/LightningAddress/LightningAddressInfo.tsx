import * as React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import Screen from '../../../components/Screen';
import Header from '../../../components/Header';
import KeyValue from '../../../components/KeyValue';

import { localeString } from '../../../utils/LocaleUtils';
import { themeColor } from '../../../utils/ThemeUtils';

import CashuLightningAddressStore from '../../../stores/CashuLightningAddressStore';

interface CashuLightningAddressInfoProps {
    navigation: StackNavigationProp<any, any>;
    CashuLightningAddressStore: CashuLightningAddressStore;
}

@inject('CashuLightningAddressStore')
@observer
export default class CashuLightningAddressInfo extends React.Component<
    CashuLightningAddressInfoProps,
    {}
> {
    render() {
        const { navigation, CashuLightningAddressStore } = this.props;
        const { minimumSats } = CashuLightningAddressStore;

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString(
                                'views.Settings.LightningAddressInfo.title'
                            ),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }
                        }}
                        navigation={navigation}
                    />
                    <ScrollView style={{ margin: 5 }}>
                        <View
                            style={{
                                margin: 10
                            }}
                        >
                            <Text
                                style={{
                                    color: themeColor('text')
                                }}
                            >
                                {localeString(
                                    'views.Cashu.LightningAddressInfo.explainer1'
                                )}
                            </Text>
                        </View>
                        <View
                            style={{
                                margin: 10
                            }}
                        >
                            <Text
                                style={{
                                    color: themeColor('text')
                                }}
                            >
                                {localeString(
                                    'views.Cashu.LightningAddressInfo.explainer2'
                                )}
                            </Text>
                        </View>
                        <View
                            style={{
                                margin: 10
                            }}
                        >
                            {minimumSats && (
                                <KeyValue
                                    keyValue={localeString(
                                        'views.Settings.LightningAddressInfo.minimumAmount'
                                    )}
                                    value={`${minimumSats} ${
                                        minimumSats === 1 ? 'sat' : 'sats'
                                    }`}
                                />
                            )}
                        </View>
                    </ScrollView>
                </View>
            </Screen>
        );
    }
}
