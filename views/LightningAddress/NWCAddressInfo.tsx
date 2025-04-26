import * as React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import Screen from '../../components/Screen';
import Header from '../../components/Header';
import KeyValue from '../../components/KeyValue';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import LightningAddressStore from '../../stores/LightningAddressStore';

interface NWCAddressInfoProps {
    navigation: StackNavigationProp<any, any>;
    LightningAddressStore: LightningAddressStore;
}

@inject('LightningAddressStore')
@observer
export default class NWCAddressInfo extends React.Component<
    NWCAddressInfoProps,
    {}
> {
    render() {
        const { navigation, LightningAddressStore } = this.props;
        const { minimumSats } = LightningAddressStore;

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
                                    color: themeColor('text'),
                                    fontFamily: 'PPNeueMontreal-Book',
                                    fontSize: 18
                                }}
                            >
                                {localeString(
                                    'views.LightningAddress.NWC.explainer1'
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
                                    color: themeColor('text'),
                                    fontFamily: 'PPNeueMontreal-Book',
                                    fontSize: 18
                                }}
                            >
                                {localeString(
                                    'views.LightningAddress.NWC.explainer2'
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
