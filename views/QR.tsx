import * as React from 'react';
import { Dimensions, ScrollView } from 'react-native';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { inject, observer } from 'mobx-react';

import CollapsedQR from '../components/CollapsedQR';
import Header from '../components/Header';
import Screen from '../components/Screen';
import Text from '../components/Text';

import SettingsStore from '../stores/SettingsStore';

import { themeColor } from '../utils/ThemeUtils';

interface QRProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore?: SettingsStore;
    route: Route<
        'QR',
        {
            value: string;
            copyValue: string;
            label: string;
            hideText: boolean;
            jumboLabel: boolean;
            logo: any;
            satAmount?: string | number;
        }
    >;
}

interface QRState {
    value: string;
    copyValue: string;
    label: string;
    hideText: boolean;
    jumboLabel: boolean;
    logo: any;
    satAmount?: string | number;
}

@inject('SettingsStore')
@observer
export default class QR extends React.PureComponent<QRProps, QRState> {
    constructor(props: QRProps) {
        super(props);

        const value = props.route.params?.value ?? '';
        const copyValue = props.route.params?.copyValue ?? '';
        const label = props.route.params?.label ?? '';
        const { hideText, jumboLabel, logo } = props.route.params ?? {};
        const satAmount = props.route.params?.satAmount ?? undefined;

        this.state = {
            value,
            copyValue,
            label,
            hideText,
            jumboLabel,
            logo,
            satAmount
        };
    }

    render() {
        const { navigation } = this.props;
        const {
            value,
            copyValue,
            label,
            hideText,
            jumboLabel,
            logo,
            satAmount
        } = this.state;

        const { fontScale } = Dimensions.get('window');

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    containerStyle={{
                        borderBottomWidth: 0
                    }}
                    navigation={navigation}
                />
                <ScrollView
                    style={{
                        paddingHorizontal: 15
                    }}
                >
                    {jumboLabel && (
                        <Text
                            style={{
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book',
                                fontSize: 26 / fontScale,
                                marginBottom: 20
                            }}
                        >
                            {label || value}
                        </Text>
                    )}
                    <CollapsedQR
                        value={value}
                        copyValue={copyValue || value}
                        expanded
                        textBottom
                        truncateLongValue
                        hideText={hideText}
                        logo={logo}
                        satAmount={satAmount}
                        displayAmount={
                            this.props.SettingsStore?.settings?.invoices
                                ?.displayAmountOnInvoice || false
                        }
                        showShare={true}
                        iconOnly={true}
                    />
                </ScrollView>
            </Screen>
        );
    }
}
