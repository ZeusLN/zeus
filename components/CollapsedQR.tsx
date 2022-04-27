import * as React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import HCESession, { NFCContentType, NFCTagType4 } from 'react-native-hce';

import Button from './../components/Button';
import CopyButton from './CopyButton';
import { localeString } from './../utils/LocaleUtils';
import { themeColor } from './../utils/ThemeUtils';

const secondaryLogo = require('../assets/images/secondary.png');

let simulation: any;

interface CollapsedQRProps {
    value: string;
    showText?: string;
    collapseText?: string;
    copyText?: string;
    hideText?: boolean;
}

interface CollapsedQRState {
    collapsed: boolean;
    nfcBroadcast: boolean;
}

export default class CollapsedQR extends React.Component<
    CollapsedQRProps,
    CollapsedQRState
> {
    state = {
        collapsed: true,
        nfcBroadcast: false
    };

    componentWillUnmount() {
        if (this.state.nfcBroadcast) {
            this.stopSimulation();
        }
    }

    UNSAFE_componentWillUpdate = () => {
        if (this.state.nfcBroadcast) {
            this.stopSimulation();
        }
    };

    toggleCollapse = () => {
        this.setState({
            collapsed: !this.state.collapsed
        });
    };

    toggleNfc = () => {
        if (this.state.nfcBroadcast) {
            this.stopSimulation();
        } else {
            this.startSimulation();
        }

        this.setState({
            nfcBroadcast: !this.state.nfcBroadcast
        });
    };

    startSimulation = async () => {
        const tag = new NFCTagType4(NFCContentType.Text, this.props.value);
        simulation = await new HCESession(tag).start();
    };

    stopSimulation = async () => {
        await simulation.terminate();
    };

    render() {
        const { collapsed, nfcBroadcast } = this.state;
        const { value, showText, copyText, collapseText, hideText } =
            this.props;

        return (
            <React.Fragment>
                {!hideText && (
                    <Text
                        style={{
                            ...styles.value,
                            color: themeColor('secondaryText'),
                            fontFamily: 'Lato-Regular'
                        }}
                    >
                        {value}
                    </Text>
                )}
                {!collapsed && (
                    <View style={styles.qrPadding}>
                        <QRCode value={value} size={300} logo={secondaryLogo} />
                    </View>
                )}
                <Button
                    title={
                        collapsed
                            ? showText ||
                              localeString('components.CollapsedQr.show')
                            : collapseText ||
                              localeString('components.CollapsedQr.hide')
                    }
                    icon={{
                        name: 'qrcode',
                        type: 'font-awesome',
                        size: 25,
                        color: '#fff'
                    }}
                    containerStyle={{
                        margin: 10
                    }}
                    onPress={() => this.toggleCollapse()}
                />
                <CopyButton copyValue={value} title={copyText} />
                {Platform.OS === 'android' && (
                    <Button
                        title={
                            nfcBroadcast
                                ? localeString('components.CollapsedQr.stopNfc')
                                : localeString(
                                      'components.CollapsedQr.startNfc'
                                  )
                        }
                        containerStyle={{
                            margin: 20
                        }}
                        icon={{
                            name: 'nfc',
                            size: 25
                        }}
                        onPress={() => this.toggleNfc()}
                        tertiary
                    />
                )}
            </React.Fragment>
        );
    }
}

const styles = StyleSheet.create({
    value: {
        marginBottom: 15,
        paddingLeft: 20
    },
    qrPadding: {
        backgroundColor: 'white',
        alignItems: 'center',
        alignSelf: 'center',
        padding: 5,
        margin: 10
    }
});
