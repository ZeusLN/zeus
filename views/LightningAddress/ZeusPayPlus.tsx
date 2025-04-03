import * as React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import Pill from '../../components/Pill';
import Screen from '../../components/Screen';
import Text from '../../components/Text';
import Header from '../../components/Header';
import LoadingIndicator from '../../components/LoadingIndicator';
import { Row } from '../../components/layout/Row';

import LightningAddressStore from '../../stores/LightningAddressStore';
import SettingsStore from '../../stores/SettingsStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import Gear from '../../assets/images/SVG/Gear.svg';
import ZeusPayIcon from '../../assets/images/SVG/zeus-pay.svg';
import DateTimeUtils from '../../utils/DateTimeUtils';

import ZeusPayPlusSettings from './ZeusPayPlusSettings';

interface ZeusPayPlusProps {
    navigation: StackNavigationProp<any, any>;
    LightningAddressStore: LightningAddressStore;
    SettingsStore: SettingsStore;
    route: Route<'ZeusPayPlus'>;
}

@inject('LightningAddressStore', 'SettingsStore')
@observer
export default class ZeusPayPlus extends React.Component<ZeusPayPlusProps, {}> {
    render() {
        const { navigation, LightningAddressStore } = this.props;
        const { lightningAddressType, zeusPlusExpiresAt, loading } =
            LightningAddressStore;

        const zeusPayPlus = !!zeusPlusExpiresAt;

        const InfoButton = () => (
            <View style={{ marginLeft: 15, marginRight: 15 }}>
                <Icon
                    name="info"
                    onPress={() => {
                        if (lightningAddressType === 'zaplocker') {
                            navigation.navigate('ZaplockerInfo');
                        } else if (lightningAddressType === 'cashu') {
                            navigation.navigate('CashuLightningAddressInfo');
                        }
                    }}
                    color={themeColor('text')}
                    underlayColor="transparent"
                    size={35}
                />
            </View>
        );

        const SettingsButton = () => (
            <TouchableOpacity
                onPress={() => {
                    if (lightningAddressType === 'zaplocker') {
                        navigation.navigate('LightningAddressSettings');
                    } else if (lightningAddressType === 'cashu') {
                        navigation.navigate('CashuLightningAddressSettings');
                    }
                }}
            >
                <Gear
                    style={{ alignSelf: 'center' }}
                    fill={themeColor('text')}
                />
            </TouchableOpacity>
        );

        const perks = [
            {
                title: 'Custom handles',
                active: true
            },
            {
                title: 'Web portal point of sale features',
                active: false
            },
            {
                title: 'LSP channel lease discounts',
                active: false
            },
            {
                title: 'Exclusive merch',
                active: false
            },
            {
                title: 'Support free and open source software',
                active: true
            }
        ];

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={
                            <ZeusPayIcon
                                fill={themeColor('text')}
                                width={30}
                                height={30}
                            />
                        }
                        rightComponent={
                            <Row>
                                {loading && <LoadingIndicator size={30} />}
                                {!loading && <InfoButton />}
                                {!loading && <SettingsButton />}
                            </Row>
                        }
                        navigation={navigation}
                    />
                    <View style={{ flex: 1, margin: 5 }}>
                        <Row style={{ alignSelf: 'center', marginTop: 10 }}>
                            <Text
                                style={{
                                    ...styles.text,
                                    fontFamily: 'MarlideDisplay_Bold',
                                    fontSize: 55,
                                    color: themeColor('text')
                                }}
                            >
                                ZEUS Pay+
                            </Text>
                        </Row>
                        <Row style={{ alignSelf: 'center', margin: 15 }}>
                            <Pill
                                title={
                                    zeusPayPlus
                                        ? localeString(
                                              'views.LightningAddress.ZeusPayPlus.subActive'
                                          )
                                        : localeString(
                                              'views.LightningAddress.ZeusPayPlus.noActiveSub'
                                          )
                                }
                                width={200}
                                height={30}
                                borderColor={
                                    zeusPayPlus
                                        ? themeColor('success')
                                        : themeColor('warning')
                                }
                                textColor={
                                    zeusPayPlus
                                        ? themeColor('success')
                                        : themeColor('warning')
                                }
                                borderWidth={1}
                            />
                        </Row>
                        <Row style={{ alignSelf: 'center', margin: 5 }}>
                            <Text
                                style={{
                                    ...styles.text,
                                    color: themeColor('text')
                                }}
                            >
                                {zeusPlusExpiresAt
                                    ? `${localeString(
                                          'general.expiresOn'
                                      )} ${DateTimeUtils.listFormattedDate(
                                          String(
                                              new Date(
                                                  zeusPlusExpiresAt
                                              ).getTime() / 1000
                                          ),
                                          'mmmm d, yyyy'
                                      )}`
                                    : ''}
                            </Text>
                        </Row>
                        {zeusPayPlus ? (
                            <>
                                <ZeusPayPlusSettings
                                    navigation={navigation}
                                    hidePills
                                />
                            </>
                        ) : (
                            <ScrollView style={{ margin: 10 }}>
                                {perks.map((perk) => (
                                    <View
                                        style={{
                                            marginTop: 10,
                                            marginBottom: 10
                                        }}
                                    >
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
                                                    color: themeColor(
                                                        'highlight'
                                                    ),
                                                    textAlign: 'right'
                                                }}
                                            >
                                                {localeString(
                                                    'general.comingSoon'
                                                )}
                                            </Text>
                                        )}
                                    </View>
                                ))}
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    text: {
        fontFamily: 'PPNeueMontreal-Book'
    },
    perk: {
        fontFamily: 'MarlideDisplay_Regular',
        fontSize: 30,
        marginBottom: 5
    },
    comingSoon: {
        fontFamily: 'MarlideDisplay_Bold',
        fontSize: 20
    },
    // column: {
    //     alignItems: 'flex-start',
    //     flexDirection: 'column',
    //     width: '47%',
    //     height: '100%'
    // },
    explainer: {
        fontSize: 18,
        marginBottom: 10,
        fontFamily: 'PPNeueMontreal-Book'
    },
    wrapper: {
        paddingTop: 5,
        paddingBottom: 5,
        paddingLeft: 15,
        paddingRight: 15
    },
    optionBlock: {
        marginTop: 10,
        marginBottom: 12
    },
    prosConsToggle: {
        marginBottom: 8
    },
    prosCons: {
        alignSelf: 'center',
        marginTop: 15,
        marginBottom: 40
    },
    prosConsColumn: {
        alignItems: 'flex-start',
        flexDirection: 'column',
        width: '47%',
        height: '100%'
    }
});
