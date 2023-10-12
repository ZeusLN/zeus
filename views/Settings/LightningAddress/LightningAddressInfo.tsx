import * as React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Divider, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import Button from '../../../components/Button';
import { Row } from '../../../components/layout/Row';
import Screen from '../../../components/Screen';
import Header from '../../../components/Header';
import KeyValue from '../../../components/KeyValue';

import { localeString } from '../../../utils/LocaleUtils';
import { themeColor } from '../../../utils/ThemeUtils';
import UrlUtils from '../../../utils/UrlUtils';

import LightningAddressStore from '../../../stores/LightningAddressStore';

import Nostrich from '../../../assets/images/SVG/Nostrich.svg';
import Receive from '../../../assets/images/SVG/Receive.svg';

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

                            <Divider
                                orientation="horizontal"
                                style={{ margin: 20 }}
                            />

                            <KeyValue
                                keyValue={localeString(
                                    'views.Settings.LightningAddressInfo.iconLegend'
                                )}
                            />

                            <ListItem containerStyle={styles.listItem}>
                                <ListItem.Content>
                                    <ListItem.Title>
                                        <Text
                                            style={{
                                                color: themeColor('text')
                                            }}
                                        >
                                            {localeString(
                                                'views.Settings.LightningAddressInfo.redeem'
                                            )}
                                        </Text>
                                    </ListItem.Title>
                                    <ListItem.Subtitle>
                                        <Text
                                            style={{
                                                color: themeColor(
                                                    'secondaryText'
                                                )
                                            }}
                                        >
                                            {localeString(
                                                'views.Settings.LightningAddressInfo.pressToRedeem'
                                            )}
                                        </Text>
                                    </ListItem.Subtitle>
                                </ListItem.Content>
                                <ListItem.Content right>
                                    <Row>
                                        <View style={styles.icon}>
                                            <Receive
                                                fill={themeColor('text')}
                                                width={45}
                                                height={45}
                                            />
                                        </View>
                                    </Row>
                                </ListItem.Content>
                            </ListItem>

                            <ListItem containerStyle={styles.listItem}>
                                <ListItem.Content>
                                    <ListItem.Title>
                                        <Text
                                            style={{
                                                color: themeColor('text')
                                            }}
                                        >
                                            {localeString(
                                                'views.Settings.LightningAddressInfo.notLoaded'
                                            )}
                                        </Text>
                                    </ListItem.Title>
                                    <ListItem.Subtitle>
                                        <Text
                                            style={{
                                                color: themeColor(
                                                    'secondaryText'
                                                )
                                            }}
                                        >
                                            {localeString(
                                                'views.Settings.LightningAddressInfo.notLoadedDetails'
                                            )}
                                        </Text>
                                    </ListItem.Subtitle>
                                </ListItem.Content>
                                <ListItem.Content right>
                                    <Row>
                                        <View style={styles.icon}>
                                            <Nostrich
                                                fill={themeColor('text')}
                                                width={32}
                                                height={32}
                                            />
                                        </View>
                                    </Row>
                                </ListItem.Content>
                            </ListItem>

                            <ListItem containerStyle={styles.listItem}>
                                <ListItem.Content>
                                    <ListItem.Title>
                                        <Text
                                            style={{
                                                color: themeColor('text')
                                            }}
                                        >
                                            {localeString(
                                                'views.Settings.Attestations.validAttestation'
                                            )}
                                        </Text>
                                    </ListItem.Title>
                                    <ListItem.Subtitle>
                                        <Text
                                            style={{
                                                color: themeColor(
                                                    'secondaryText'
                                                )
                                            }}
                                        >
                                            {localeString(
                                                'views.Settings.LightningAddressInfo.validAttestationDetails'
                                            )}
                                        </Text>
                                    </ListItem.Subtitle>
                                </ListItem.Content>
                                <ListItem.Content right>
                                    <Row>
                                        <View style={styles.icon}>
                                            <Nostrich
                                                fill={themeColor('success')}
                                                width={32}
                                                height={32}
                                            />
                                        </View>
                                    </Row>
                                </ListItem.Content>
                            </ListItem>

                            <ListItem containerStyle={styles.listItem}>
                                <ListItem.Content>
                                    <ListItem.Title>
                                        <Text
                                            style={{
                                                color: themeColor('text')
                                            }}
                                        >
                                            {localeString(
                                                'views.Settings.Attestations.invalidAttestation'
                                            )}
                                        </Text>
                                    </ListItem.Title>
                                    <ListItem.Subtitle>
                                        <Text
                                            style={{
                                                color: themeColor(
                                                    'secondaryText'
                                                )
                                            }}
                                        >
                                            {localeString(
                                                'views.Settings.LightningAddressInfo.invalidAttestationDetails'
                                            )}
                                        </Text>
                                    </ListItem.Subtitle>
                                </ListItem.Content>
                                <ListItem.Content right>
                                    <Row>
                                        <View style={styles.icon}>
                                            <Nostrich
                                                fill={themeColor('error')}
                                                width={32}
                                                height={32}
                                            />
                                        </View>
                                    </Row>
                                </ListItem.Content>
                            </ListItem>

                            <ListItem containerStyle={styles.listItem}>
                                <ListItem.Content>
                                    <ListItem.Title>
                                        <Text
                                            style={{
                                                color: themeColor('text')
                                            }}
                                        >
                                            {localeString(
                                                'views.Settings.Attestations.noAttestationsFound'
                                            )}
                                        </Text>
                                    </ListItem.Title>
                                    <ListItem.Subtitle>
                                        <Text
                                            style={{
                                                color: themeColor(
                                                    'secondaryText'
                                                )
                                            }}
                                        >
                                            {localeString(
                                                'views.Settings.LightningAddressInfo.noAttestationDetails'
                                            )}
                                        </Text>
                                    </ListItem.Subtitle>
                                </ListItem.Content>
                                <ListItem.Content right>
                                    <Row>
                                        <View style={styles.icon}>
                                            <Nostrich
                                                fill={'#FFC300'}
                                                width={32}
                                                height={32}
                                            />
                                        </View>
                                    </Row>
                                </ListItem.Content>
                            </ListItem>

                            <View style={{ marginTop: 20 }}>
                                <Button
                                    title={localeString(
                                        'views.Settings.LightningAddressInfo.learnAboutZaplocker'
                                    )}
                                    onPress={() =>
                                        UrlUtils.goToUrl(
                                            'https://github.com/supertestnet/zaplocker#four-problems-zaplocker-solves'
                                        )
                                    }
                                />
                            </View>
                        </View>
                    </ScrollView>
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    listItem: {
        flex: 1,
        borderBottomWidth: 0,
        backgroundColor: 'transparent'
    },
    icon: {
        marginRight: 10,
        width: 45,
        height: 45,
        alignItems: 'center',
        justifyContent: 'center'
    }
});
