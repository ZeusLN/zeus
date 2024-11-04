import * as React from 'react';
// @ts-ignore:next-line
import b58 from 'bs58check';
import { Alert, View } from 'react-native';
import { Header } from 'react-native-elements';
import { observer } from 'mobx-react';
import { URDecoder } from '@ngraveio/bc-ur';
import { StackNavigationProp } from '@react-navigation/stack';
import { Bytes, CryptoAccount, CryptoPSBT } from '@keystonehq/bc-ur-registry';

import LoadingIndicator from '../components/LoadingIndicator';
import QRCodeScanner from '../components/QRCodeScanner';

import handleAnything from '../utils/handleAnything';
import Base64Utils from '../utils/Base64Utils';
import { joinQRs } from '../utils/BbqrUtils';
import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

interface HandleAnythingQRProps {
    navigation: StackNavigationProp<any, any>;
}

interface HandleAnythingQRState {
    loading: boolean;
    mode: string;
    totalParts: number;
    parts: Array<string>;
}

@observer
export default class HandleAnythingQRScanner extends React.Component<
    HandleAnythingQRProps,
    HandleAnythingQRState
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

                        if (ur._type === 'crypto-account') {
                            try {
                                const cryptoAccount: any =
                                    CryptoAccount.fromCBOR(ur._cborPayload);
                                const hdKey: any =
                                    cryptoAccount.outputDescriptors[0].getCryptoKey();
                                const version = Buffer.from('04b24746', 'hex');
                                const parentFingerprint =
                                    hdKey.getParentFingerprint();
                                const depth = hdKey.getOrigin().getDepth();
                                const depthBuf = Buffer.alloc(1);
                                depthBuf.writeUInt8(depth);
                                const components = hdKey
                                    .getOrigin()
                                    .getComponents();
                                const lastComponents =
                                    components[components.length - 1];
                                const index = lastComponents.isHardened()
                                    ? lastComponents.getIndex() + 0x80000000
                                    : lastComponents.getIndex();
                                const indexBuf = Buffer.alloc(4);
                                indexBuf.writeUInt32BE(index);
                                const chainCode = hdKey.getChainCode();
                                const key = hdKey.getKey();
                                const data = Buffer.concat([
                                    version,
                                    depthBuf,
                                    parentFingerprint,
                                    indexBuf,
                                    chainCode,
                                    key
                                ]);

                                const zpub = b58.encode(data);
                                const xfp = cryptoAccount
                                    .getMasterFingerprint()
                                    .toString('hex')
                                    .toUpperCase();

                                handleData = `{"MasterFingerprint": "${xfp}", "ExtPubKey": "${zpub}"}`;
                            } catch (e) {
                                console.log(
                                    'Error found while decoding BC-UR crypto-account',
                                    e
                                );
                            }
                        } else if (ur._type === 'crypto-psbt') {
                            const data = CryptoPSBT.fromCBOR(ur._cborPayload);
                            const psbt = data.getPSBT();
                            handleData = Buffer.from(psbt).toString('base64');
                        } else if (ur._type === 'bytes') {
                            const data = Bytes.fromCBOR(ur._cborPayload);
                            handleData = Buffer.from(data.getData()).toString();

                            // TODO
                            // For some reason the cH starting byte from Base64-encoded
                            // PSBTs is being replaced with a linebreak
                            if (
                                handleData.includes('NidP8BA') &&
                                (handleData.startsWith('\r\n') ||
                                    handleData.startsWith('\n') ||
                                    handleData.startsWith('\r'))
                            ) {
                                handleData = handleData.replace(
                                    /(\r\n|\n|\r)/gm,
                                    'cH'
                                );
                            }
                        } else {
                            // Decode the CBOR message to a Buffer
                            const decoded = ur.decodeCBOR();
                            handleData = decoded.toString();
                        }
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
                goBack={() => {
                    navigation.goBack();
                }}
                navigation={navigation}
                parts={parts.length}
                totalParts={totalParts}
                mode={mode}
            />
        );
    }
}
