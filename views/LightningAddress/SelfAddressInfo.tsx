import * as React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Screen from '../../components/Screen';
import Header from '../../components/Header';
import KeyValue from '../../components/KeyValue';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import LightningAddressStore from '../../stores/LightningAddressStore';

interface SelfAddressInfoProps {
    navigation: NativeStackNavigationProp<any, any>;
    LightningAddressStore: LightningAddressStore;
}

@inject('LightningAddressStore')
@observer
export default class SelfAddressInfo extends React.Component<
    SelfAddressInfoProps,
    {}
> {
    render() {
        const { navigation, LightningAddressStore } = this.props;
        const { minimumSats } = LightningAddressStore;

        const explainers = [
            localeString('views.LightningAddress.Self.explainer1'),
            localeString('views.LightningAddress.Self.explainer2'),
            localeString('views.LightningAddress.Self.explainer3'),
            localeString('views.LightningAddress.Self.explainer4')
        ];

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
                        {explainers.map((explainer, index) => (
                            <View
                                key={`explainer-${index}`}
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
                                    {explainer}
                                </Text>
                            </View>
                        ))}
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
