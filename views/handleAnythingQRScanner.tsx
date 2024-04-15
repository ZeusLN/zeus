import * as React from 'react';
import { Alert, View } from 'react-native';
import { Header } from 'react-native-elements';
import { observer } from 'mobx-react';
import { URDecoder } from '@ngraveio/bc-ur';

import LoadingIndicator from '../components/LoadingIndicator';
import QRCodeScanner from '../components/QRCodeScanner';

import handleAnything from '../utils/handleAnything';
import Base64Utils from '../utils/Base64Utils';
import { joinQRs } from '../utils/BbqrUtils';
import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

interface handleAnythingQRProps {
    navigation: any;
}

interface handleAnythingQRState {
    loading: boolean;
    mode: string;
    totalParts: number;
    parts: Array<string>;
}

@observer
export default class handleAnythingQRScanner extends React.Component<
    handleAnythingQRProps,
    handleAnythingQRState
> {
    decoder: any;
    constructor(props: any) {
        super(props);

        this.state = {
            loading: false,
            mode: 'default',
            totalParts: 0,
            parts: []
        };
    }

    handleAnythingScanned = async (data: string) => {
        const { navigation } = this.props;

        let handleData;

        // BBQR
        if (data.toUpperCase().startsWith('B$')) {
            let parts = this.state.parts;
            parts.push(data);

            this.setState({
                parts,
                mode: 'BBQr'
            });

            try {
                const joined = joinQRs(parts);
                if (joined?.raw) {
                    handleData = Base64Utils.bytesToBase64(joined.raw);
                } else {
                    return;
                }
            } catch (e) {
                console.log('Error found while decoding BBQr', e);
                return;
            }
        }

        // BC-UR
        if (data.toUpperCase().startsWith('UR:')) {
            if (!this.decoder) this.decoder = new URDecoder();
            if (!this.decoder.isComplete()) {
                let parts = this.state.parts;
                parts.push(data);
                this.decoder.receivePart(data);

                this.setState({
                    parts,
                    mode: 'BC-UR'
                });

                if (this.decoder.isComplete()) {
                    if (this.decoder.isSuccess()) {
                        // Get the UR representation of the message
                        const ur = this.decoder.resultUR();

                        // Decode the CBOR message to a Buffer
                        const decoded = ur.decodeCBOR();
                        handleData = decoded.toString();
                    } else {
                        const error = this.decoder.resultError();
                        console.log('Error found while decoding BC-UR', error);
                    }
                } else {
                    if (!this.state.totalParts) {
                        const [_, index] = data.split('/');
                        if (index) {
                            const [_, totalParts] = index.split('-');
                            if (totalParts) {
                                this.setState({
                                    totalParts: Number(totalParts) || 0
                                });
                            }
                        }
                    }

                    return;
                }
            }
        }

        if (!handleData) handleData = data;

        this.setState({
            loading: true
        });

        handleAnything(handleData)
            .then((response) => {
                this.setState({
                    loading: false
                });
                if (response) {
                    const [route, props] = response;
                    navigation.goBack();
                    navigation.navigate(route, props);
                } else {
                    navigation.goBack();
                }
            })
            .catch((err) => {
                Alert.alert(
                    localeString('general.error'),
                    err.message,
                    [
                        {
                            text: localeString('general.ok'),
                            onPress: () => void 0
                        }
                    ],
                    { cancelable: false }
                );

                this.setState({
                    loading: false
                });

                navigation.goBack();
            });
    };

    render() {
        const { navigation } = this.props;
        const { loading, totalParts, parts, mode } = this.state;

        if (loading) {
            return (
                <View
                    style={{
                        flex: 1,
                        backgroundColor: themeColor('background')
                    }}
                >
                    <Header
                        centerComponent={{
                            text: localeString('general.loading'),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }
                        }}
                        backgroundColor={themeColor('background')}
                        containerStyle={{
                            borderBottomWidth: 0
                        }}
                    />
                    <View style={{ top: 40 }}>
                        <LoadingIndicator />
                    </View>
                </View>
            );
        }

        return (
            <QRCodeScanner
                handleQRScanned={this.handleAnythingScanned}
                goBack={() => navigation.goBack()}
                navigation={navigation}
                parts={parts.length}
                totalParts={totalParts}
                mode={mode}
            />
        );
    }
}
