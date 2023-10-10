import * as React from 'react';
import { Text, View } from 'react-native';
import { inject, observer } from 'mobx-react';

import Screen from '../../../components/Screen';
import Header from '../../../components/Header';
import KeyValue from '../../../components/KeyValue';

import { localeString } from '../../../utils/LocaleUtils';
import { themeColor } from '../../../utils/ThemeUtils';
import LightningAddressStore from '../../../stores/LightningAddressStore';

interface LightningAddressInfoProps {
    navigation: any;
    LightningAddressStore: LightningAddressStore;
}

@inject('LightningAddressStore')
@observer
export default class LightningAddressInfo extends React.Component<
    LightningAddressInfoProps,
    {}
> {
    render() {
        const { navigation, LightningAddressStore } = this.props;
        const { fees, minimumSats } = LightningAddressStore;

        const LIMIT_QUALIFIERS = {
            lt: '<',
            lte: '<=',
            gt: '>',
            gte: '>='
        };

        const FEE_QUALIFIERS = {
            percentage: '%',
            fixedSats: ' sats'
        };

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
                                fontFamily: 'Lato-Regular'
                            }
                        }}
                        navigation={navigation}
                    />
                    <View style={{ margin: 5 }}>
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
                                    'views.Settings.LightningAddressInfo.explainer1'
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
                                    'views.Settings.LightningAddressInfo.explainer2'
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
                                    value={`${minimumSats} sats`}
                                />
                            )}

                            {fees && (
                                <>
                                    <KeyValue
                                        keyValue={localeString(
                                            'views.Settings.LightningAddressInfo.feesByAmount'
                                        )}
                                    />
                                    {fees.map((feeItem: any, index: number) => {
                                        const {
                                            limitAmount,
                                            limitQualifier,
                                            fee,
                                            feeQualifier
                                        } = feeItem;

                                        return (
                                            <KeyValue
                                                key={index}
                                                keyValue={`${LIMIT_QUALIFIERS[limitQualifier]} ${limitAmount} sats`}
                                                value={`${fee}${FEE_QUALIFIERS[feeQualifier]}`}
                                            />
                                        );
                                    })}
                                </>
                            )}
                        </View>
                    </View>
                </View>
            </Screen>
        );
    }
}
