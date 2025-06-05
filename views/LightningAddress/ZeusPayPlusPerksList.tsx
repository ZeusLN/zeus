import * as React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import BigNumber from 'bignumber.js';

import Text from '../../components/Text';
import { Row } from '../../components/layout/Row';

import LightningAddressStore from '../../stores/LightningAddressStore';

import { font } from '../../utils/FontUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

interface ZeusPayPlusPerksListProps {
    LightningAddressStore?: LightningAddressStore;
}

@inject('LightningAddressStore', 'SettingsStore')
@observer
export default class ZeusPayPlusPerksList extends React.Component<
    ZeusPayPlusPerksListProps,
    {}
> {
    render() {
        const perks = [
            {
                title: 'Custom handles',
                active: true
            },
            {
                title: 'Donation web portal',
                active: true
            },
            {
                title: 'Point of Sale web portal',
                active: true
            },
            {
                title: 'LSP channel lease discounts',
                active: true,
                value: `-${new BigNumber(
                    this.props.LightningAddressStore?.zeusPlusDiscount || 0
                ).times(100)}%`
            },
            {
                title: 'Early access to new features',
                active: false
            },
            {
                title: 'Exclusive merch',
                active: false
            }
        ];

        return (
            <ScrollView style={{ margin: 10 }}>
                {perks.map((perk, index) => (
                    <View
                        key={`perk-${index}`}
                        style={{
                            marginTop: 10,
                            marginBottom: 10
                        }}
                    >
                        <Row justify="space-between">
                            <Text
                                style={{
                                    ...styles.perk,
                                    color: themeColor('text')
                                }}
                            >
                                {`• ${perk.title}`}
                            </Text>
                            {!perk.active && (
                                <Text
                                    style={{
                                        ...styles.comingSoon,
                                        color: themeColor('highlight'),
                                        textAlign: 'right'
                                    }}
                                >
                                    {localeString('general.comingSoon')}
                                </Text>
                            )}
                            {perk.value && (
                                <Text
                                    style={{
                                        ...styles.value,
                                        color: themeColor('highlight'),
                                        textAlign: 'right'
                                    }}
                                >
                                    {perk.value}
                                </Text>
                            )}
                        </Row>
                    </View>
                ))}
            </ScrollView>
        );
    }
}

const styles = StyleSheet.create({
    perk: {
        fontFamily: font('marlide'),
        fontSize: 30,
        marginBottom: 5
    },
    comingSoon: {
        fontFamily: font('marlideBold'),
        fontSize: 20
    },
    value: {
        fontFamily: font('marlideBold'),
        fontSize: 35
    }
});
