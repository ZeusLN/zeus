import * as React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { inject, observer } from 'mobx-react';

import Button from '../../components/Button';
import Text from '../../components/Text';
import { Row } from '../../components/layout/Row';

import LightningAddressStore from '../../stores/LightningAddressStore';

import { font } from '../../utils/FontUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import UrlUtils from '../../utils/UrlUtils';

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
        const { perks } = this.props.LightningAddressStore!;

        return (
            <ScrollView style={{ margin: 10 }}>
                {perks?.map((perk, index) => (
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
                            {perk.comingSoon && (
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
                        {perk.note && (
                            <Text
                                style={{
                                    ...styles.note,
                                    color: themeColor('text')
                                }}
                            >
                                {perk.note}
                            </Text>
                        )}
                        {perk.links?.map((link, index) => (
                            <View style={styles.button}>
                                <Button
                                    title={link.title}
                                    onPress={() => UrlUtils.goToUrl(link.url)}
                                    secondary={index !== 0}
                                />
                            </View>
                        ))}
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
    note: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 15,
        marginBottom: 5
    },
    comingSoon: {
        fontFamily: font('marlideBold'),
        fontSize: 15
    },
    value: {
        fontFamily: font('marlideBold'),
        fontSize: 35
    },
    button: {
        marginTop: 10,
        marginBottom: 10
    }
});
