import * as React from 'react';
import { Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { Route } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ButtonGroup } from '@rneui/themed';
import NfcManager from 'react-native-nfc-manager';

import CollapsedQR from '../../components/CollapsedQR';
import Header from '../../components/Header';
import Screen from '../../components/Screen';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import { getButtonGroupStyles } from '../../utils/buttonGroupStyles';

interface LightningAddressQRProps {
    navigation: NativeStackNavigationProp<any, any>;
    route: Route<
        'LightningAddressQR',
        {
            address: string;
            noffer: string;
            logo?: any;
        }
    >;
}

interface LightningAddressQRState {
    selectedIndex: number;
    nfcSupported: boolean;
}

export default class LightningAddressQR extends React.PureComponent<
    LightningAddressQRProps,
    LightningAddressQRState
> {
    state: LightningAddressQRState = {
        selectedIndex: 0,
        nfcSupported: false
    };

    async componentDidMount() {
        if (Platform.OS !== 'android') return;
        try {
            const nfcSupported = await NfcManager.isSupported();
            this.setState({ nfcSupported });
        } catch {
            this.setState({ nfcSupported: false });
        }
    }

    render() {
        const { navigation, route } = this.props;
        const { address, noffer, logo } = route.params;
        const { selectedIndex, nfcSupported } = this.state;

        const tabs = [
            {
                title: localeString('general.lightningAddress'),
                value: `lightning:${address}`,
                copyValue: address,
                label: address
            },
            {
                title: localeString('views.Settings.Noffer'),
                value: noffer,
                copyValue: noffer,
                label: noffer
            }
        ];
        const active = tabs[selectedIndex];

        const groupStyles = getButtonGroupStyles();
        const tabButtons = tabs.map((tab, idx) => ({
            element: () => (
                <Text
                    style={{
                        ...styles.tabText,
                        color:
                            selectedIndex === idx
                                ? themeColor('background')
                                : themeColor('text')
                    }}
                >
                    {tab.title}
                </Text>
            )
        }));

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    containerStyle={{ borderBottomWidth: 0 }}
                    navigation={navigation}
                />
                <ScrollView style={{ paddingHorizontal: 15 }}>
                    <ButtonGroup
                        onPress={(index) =>
                            this.setState({ selectedIndex: index })
                        }
                        selectedIndex={selectedIndex}
                        buttons={tabButtons}
                        selectedButtonStyle={groupStyles.selectedButtonStyle}
                        containerStyle={groupStyles.containerStyle}
                        innerBorderStyle={groupStyles.innerBorderStyle}
                    />
                    <CollapsedQR
                        value={active.value}
                        copyValue={active.copyValue}
                        expanded
                        textBottom
                        truncateLongValue
                        hideText
                        logo={logo}
                        labelBottom={active.label}
                        nfcSupported={nfcSupported}
                    />
                </ScrollView>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    tabText: {
        fontFamily: 'PPNeueMontreal-Book'
    }
});
