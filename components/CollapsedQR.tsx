import * as React from 'react';
import {
    Dimensions,
    Platform,
    StyleSheet,
    Text,
    View,
    Share
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import ViewShot, { captureRef } from 'react-native-view-shot';

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
    expanded?: boolean;
    textBottom?: boolean;
}

interface CollapsedQRState {
    collapsed: boolean;
    nfcBroadcast: boolean;
    qrCodeUri: any;
    qrData: any;
}

export default class CollapsedQR extends React.Component<
    CollapsedQRProps,
    CollapsedQRState
> {
    qrCodeRef: React.RefObject<unknown>;
    constructor(props: CollapsedQRProps) {
        super(props);
        this.state = {
            collapsed: this.props.expanded ? false : true,
            nfcBroadcast: false,
            qrData: this.props.value,
            qrCodeUri: null
        };
        this.qrCodeRef = React.createRef();
    }

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

    generateQRCode = (data: string) => {
        const qrCodeValue = data;
        return (
            <QRCode
                value={qrCodeValue}
                size={Dimensions.get('window').width * 0.8}
                logo={secondaryLogo}
                ref={this.qrCodeRef}
            />
        );
    };

    shareQRCode = async () => {
        if (this.qrCodeRef.current) {
            try {
                const qrCodeUri = await captureRef(this.qrCodeRef, {
                    format: 'png'
                });
                this.setState({ qrCodeUri });
            } catch (error) {
                console.error(error);
            }
        }
        console.log(this.state.qrCodeUri);
        try {
            const result = await Share.share({
                message: 'Check out my QR code!',
                type: 'image/png',
                title: 'QR Code',
                subject: 'QR Code Image',
                url: `file://${this.state.qrCodeUri}`
            });
            if (result.action === Share.sharedAction) {
                if (result.activityType) {
                    console.log(`Shared with ${result.activityType}`);
                } else {
                    console.log('Shared');
                }
            } else if (result.action === Share.dismissedAction) {
                console.log('Dismissed');
            }
        } catch (error) {
            console.error(error.message);
        }
    };

    render() {
        const { collapsed, nfcBroadcast, qrData, qrCodeUri } = this.state;
        {
            console.log(qrData);
        }
        const {
            value,
            showText,
            copyText,
            collapseText,
            hideText,
            expanded,
            textBottom
        } = this.props;

        return (
            <React.Fragment>
                {!hideText && !textBottom && (
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
                {}
                {!collapsed && value && (
                    <View style={styles.qrPadding}>
                        <ViewShot ref={this.qrCodeRef}>
                            {this.generateQRCode(value)}
                        </ViewShot>
                    </View>
                )}
                <Button title="share qr code" onPress={this.shareQRCode} />
                {!hideText && textBottom && (
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
                {!expanded && (
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
                            size: 25
                        }}
                        containerStyle={{
                            margin: 10
                        }}
                        onPress={() => this.toggleCollapse()}
                    />
                )}
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
