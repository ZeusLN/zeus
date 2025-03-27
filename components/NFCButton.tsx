import * as React from 'react';
import { Platform, TouchableOpacity } from 'react-native';

import { Icon } from 'react-native-elements';
import HCESession, { NFCContentType, NFCTagType4 } from 'react-native-hce';

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

    UNSAFE_componentWillUpdate = () => {
        if (this.state.nfcBroadcast) {
            this.stopSimulation();
        }
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
        const zeusPayload = `ZEUS:${this.props.value}`;
        const tag = new NFCTagType4(NFCContentType.Text, zeusPayload);
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
                    <Icon
                        name={'nfc'}
                        size={27}
                        color={
                            nfcBroadcast
                                ? themeColor('highlight')
                                : themeColor('secondaryText')
                        }
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
                    icon
                        ? icon
                        : {
                              name: 'nfc',
                              size: 25
                          }
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
