import * as React from 'react';
import { Platform, TouchableOpacity } from 'react-native';

import HCESession, { NFCContentType, NFCTagType4 } from 'react-native-hce';

import NfcIcon from '../assets/images/SVG/NFC-alt.svg';

import Button from './../components/Button';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

interface NFCButtonProps {
    value: string;
    icon?: any;
    noUppercase?: boolean;
    iconOnly?: boolean;
}

interface NFCButtonState {
    nfcBroadcast: boolean;
}

export default class NFCButton extends React.Component<
    NFCButtonProps,
    NFCButtonState
> {
    simulation: any;
    state = {
        nfcBroadcast: false
    };

    componentWillUnmount() {
        if (this.state.nfcBroadcast) {
            this.stopSimulation();
        }
    }
    componentDidUpdate(
        _: Readonly<NFCButtonProps>,
        prevState: Readonly<NFCButtonState>
    ): void {
        if (prevState.nfcBroadcast) {
            this.stopSimulation();
        }
    }
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
        this.simulation = await new HCESession(tag).start();
    };

    stopSimulation = async () => {
        await this.simulation.terminate();
    };

    render() {
        const { icon, noUppercase, iconOnly } = this.props;
        const { nfcBroadcast } = this.state;

        if (iconOnly) {
            return (
                <TouchableOpacity
                    // "padding: 5" leads to a larger area where users can click on
                    style={{ padding: 5 }}
                    onPress={this.toggleNfc}
                >
                    <NfcIcon
                        stroke={
                            nfcBroadcast
                                ? themeColor('highlight')
                                : themeColor('secondaryText')
                        }
                        width={27}
                        height={27}
                    />
                </TouchableOpacity>
            );
        }

        return (
            <Button
                title={
                    nfcBroadcast
                        ? localeString('components.CollapsedQr.stopNfc')
                        : localeString('components.CollapsedQr.startNfc')
                }
                icon={
                    icon ? (
                        icon
                    ) : (
                        <NfcIcon
                            stroke={themeColor('highlight')}
                            width={25}
                            height={25}
                            style={{ marginRight: 10 }}
                        />
                    )
                }
                containerStyle={{
                    marginTop: 10,
                    marginBottom: Platform.OS === 'android' ? 0 : 20
                }}
                onPress={this.toggleNfc}
                noUppercase={noUppercase}
                tertiary
            />
        );
    }
}
