import * as React from 'react';
import { Platform, ScrollView } from 'react-native';
import { Route } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { inject, observer } from 'mobx-react';
import NfcManager from 'react-native-nfc-manager';

import CollapsedQR from '../components/CollapsedQR';
import Header from '../components/Header';
import Screen from '../components/Screen';

import SettingsStore from '../stores/SettingsStore';

interface QRProps {
    navigation: NativeStackNavigationProp<any, any>;
    SettingsStore?: SettingsStore;
    route: Route<
        'QR',
        {
            value: string;
            copyValue: string;
            label: string;
            hideText: boolean;
            labelBottom: boolean;
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
    labelBottom: boolean;
    logo: any;
    satAmount?: string | number;
    nfcSupported: boolean;
}

@inject('SettingsStore')
@observer
export default class QR extends React.PureComponent<QRProps, QRState> {
    constructor(props: QRProps) {
        super(props);

        const value = props.route.params?.value ?? '';
        const copyValue = props.route.params?.copyValue ?? '';
        const label = props.route.params?.label ?? '';
        const { hideText, labelBottom, logo } = props.route.params ?? {};
        const satAmount = props.route.params?.satAmount ?? undefined;

        this.state = {
            value,
            copyValue,
            label,
            hideText,
            labelBottom,
            logo,
            satAmount,
            nfcSupported: false
        };
    }

    async componentDidMount() {
        if (Platform.OS !== 'android') {
            return;
        }

        try {
            const nfcSupported = await NfcManager.isSupported();
            this.setState({ nfcSupported });
        } catch {
            this.setState({ nfcSupported: false });
        }
    }

    render() {
        const { navigation } = this.props;
        const {
            value,
            copyValue,
            label,
            hideText,
            labelBottom,
            logo,
            satAmount,
            nfcSupported
        } = this.state;

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
                    <CollapsedQR
                        value={value}
                        copyValue={copyValue || value}
                        expanded
                        textBottom
                        truncateLongValue
                        hideText={hideText}
                        logo={logo}
                        satAmount={satAmount}
                        displayAmount
                        labelBottom={labelBottom ? label || value : undefined}
                        showShare={true}
                        iconOnly={true}
                        nfcSupported={nfcSupported}
                    />
                </ScrollView>
            </Screen>
        );
    }
}
