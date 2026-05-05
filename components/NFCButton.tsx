import * as React from 'react';
import { Platform, TouchableOpacity } from 'react-native';
import { inject, observer } from 'mobx-react';
import { checkNfcEnabled } from '../utils/NFCUtils';

import {
    HCESession,
    NFCTagType4,
    NFCTagType4NDEFContentType
} from 'react-native-hce';

import NfcIcon from '../assets/images/SVG/NFC-alt.svg';

import Button from './../components/Button';

import ModalStore from '../stores/ModalStore';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

interface NFCButtonProps {
    value: string;
    icon?: any;
    noUppercase?: boolean;
    iconOnly?: boolean;
    writable?: boolean;
    onTokenReceived?: (content: string) => void;
    ModalStore?: ModalStore;
}

interface NFCButtonState {
    nfcBroadcast: boolean;
}

@inject('ModalStore')
@observer
export default class NFCButton extends React.Component<
    NFCButtonProps,
    NFCButtonState
> {
    simulation: any;
    removeWriteListener: (() => void) | null = null;
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
    toggleNfc = async () => {
        const { ModalStore } = this.props;

        if (!this.state.nfcBroadcast) {
            if (!(await checkNfcEnabled(ModalStore!))) return;
        }

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
        const { writable, onTokenReceived } = this.props;
        const tag = new NFCTagType4({
            type: NFCTagType4NDEFContentType.Text,
            content: this.props.value,
            writable: writable || false
        });
        this.simulation = await HCESession.getInstance();
        await this.simulation.setApplication(tag);
        await this.simulation.setEnabled(true);

        if (writable && onTokenReceived) {
            this.removeWriteListener = this.simulation.on(
                HCESession.Events.HCE_STATE_WRITE_FULL,
                async () => {
                    await this.simulation.syncApplication();
                    const content =
                        this.simulation?.application?.content?.content;
                    if (content) {
                        onTokenReceived(content);
                    }
                }
            );
        }
    };

    stopSimulation = async () => {
        if (this.removeWriteListener) {
            this.removeWriteListener();
            this.removeWriteListener = null;
        }
        if (this.simulation) {
            await this.simulation.setEnabled(false);
        }
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
