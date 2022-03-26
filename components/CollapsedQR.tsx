import * as React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { ButtonGroup } from 'react-native-elements';
import QRCode from 'react-native-qrcode-svg';

import HCESession, { NFCContentType, NFCTagType4 } from 'react-native-hce';

import Button from './../components/Button';
import CopyButton from './CopyButton';
import { localeString } from './../utils/LocaleUtils';
import { themeColor } from './../utils/ThemeUtils';

import { encodeUR } from './../zeus_modules/bc-ur';

const secondaryLogo = require('../assets/images/secondary.png');

let simulation: any;

interface CollapsedQRProps {
    value: string;
    showText?: string;
    collapseText?: string;
    copyText?: string;
    hideText?: boolean;
    bcur?: boolean;
}

interface CollapsedQRState {
    collapsed: boolean;
    nfcBroadcast: boolean;
    selectedIndex: number;
}

export default class CollapsedQR extends React.Component<
    CollapsedQRProps,
    CollapsedQRState
> {
    state = {
        collapsed: true,
        nfcBroadcast: false,
        selectedIndex: 0,
        fragment: ''
    };

    componentWillUnmount() {
        if (this.state.nfcBroadcast) {
            this.stopSimulation();
        }
    }

    UNSAFE_componentWillMount = () => {
        const { bcur, value } = this.props;
        console.log('VALUE', value);
        if (bcur) {
            const fragments = encodeUR(value);
            let i = 0;
            let fragment = fragments[i];

            this.setState({
                fragment: fragments[i]
            });

            setInterval(() => {
                if (i !== fragments.length - 1) {
                    i++;
                } else {
                    i = 0;
                }

                this.setState({
                    fragment: fragments[i]
                });
            }, 500);
        }
    };

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
        const { collapsed, nfcBroadcast, selectedIndex, fragment } = this.state;
        const { value, showText, copyText, collapseText, hideText, bcur } =
            this.props;

        const staticButton = () => (
            <React.Fragment>
                <Text
                    style={{
                        color:
                            selectedIndex === 1
                                ? themeColor('text')
                                : themeColor('background'),
                        fontFamily: 'Lato-Regular'
                    }}
                >
                    {localeString('components.CollapsedQR.static')}
                </Text>
            </React.Fragment>
        );

        const bcurButton = () => (
            <React.Fragment>
                <Text
                    style={{
                        color:
                            selectedIndex === 0
                                ? themeColor('text')
                                : themeColor('background'),
                        fontFamily: 'Lato-Regular'
                    }}
                >
                    {localeString('components.CollapsedQR.bcur')}
                </Text>
            </React.Fragment>
        );

        const buttons = [{ element: staticButton }, { element: bcurButton }];

        return (
            <React.Fragment>
                {bcur && (
                    <ButtonGroup
                        onPress={(selectedIndex: number) =>
                            this.setState({ selectedIndex })
                        }
                        selectedIndex={selectedIndex}
                        buttons={buttons}
                        selectedButtonStyle={{
                            backgroundColor: themeColor('highlight'),
                            borderRadius: 12
                        }}
                        containerStyle={{
                            backgroundColor: themeColor('secondary'),
                            borderRadius: 12,
                            borderColor: themeColor('secondary')
                        }}
                        innerBorderStyle={{
                            color: themeColor('secondary')
                        }}
                    />
                )}
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
                        <QRCode
                            value={!this.props.bcur ? value : fragment}
                            size={350}
                            logo={secondaryLogo}
                        />
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
