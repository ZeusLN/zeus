import * as React from 'react';
import { Alert, View } from 'react-native';
import { Header } from 'react-native-elements';
import { observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import LoadingIndicator from '../components/LoadingIndicator';
import QRCodeScanner from '../components/QRCodeScanner';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';
import NodeInfoStore from '../stores/NodeInfoStore';
import { networks } from 'bitcoinjs-lib';
import ECPairFactory from 'ecpair';
import * as secp256k1 from '@noble/secp256k1';

interface HandlePrivateKeyQRProps {
    navigation: StackNavigationProp<any, any>;
    NodeInfoStore: NodeInfoStore;
}

interface HandlePrivateKeyQRState {
    loading: boolean;
}

const tinySecp256k1 = {
    isPoint: (p: Uint8Array): boolean => {
        try {
            secp256k1.Point.fromHex(p);
            return true;
        } catch {
            return false;
        }
    },
    isPrivate: (d: Uint8Array): boolean => {
        try {
            return secp256k1.utils.isValidPrivateKey(d);
        } catch {
            return false;
        }
    },
    pointFromScalar: (d: Uint8Array): Uint8Array | null => {
        try {
            const point = secp256k1.Point.fromPrivateKey(d);
            return point.toRawBytes(true);
        } catch {
            return null;
        }
    },
    pointCompress: (p: Uint8Array, compressed = true): Uint8Array => {
        const point = secp256k1.Point.fromHex(p);
        return point.toRawBytes(compressed);
    },
    sign: (h: Uint8Array, d: Uint8Array): Uint8Array => {
        return secp256k1.signSync(h, d);
    },
    verify: (h: Uint8Array, q: Uint8Array, signature: Uint8Array): boolean => {
        return secp256k1.verify(signature, h, q);
    }
};

@observer
export default class HandlePrivateKeyQRScanner extends React.Component<
    HandlePrivateKeyQRProps,
    HandlePrivateKeyQRState
> {
    constructor(props: any) {
        super(props);
        this.state = {
            loading: false
        };
    }

    validatePrivateKey = async (wif: string) => {
        const ECPair = ECPairFactory(tinySecp256k1);
        const { NodeInfoStore } = this.props;
        const { nodeInfo } = NodeInfoStore;
        const network = nodeInfo?.isTestNet
            ? networks.testnet
            : networks.bitcoin;

        try {
            ECPair.fromWIF(wif, network);
            return true;
        } catch (err: any) {
            throw new Error('Invalid wif format');
        }
    };

    handlePrivateKeyScanned = async (data: string) => {
        const { navigation } = this.props;

        this.setState({ loading: true });

        try {
            await this.validatePrivateKey(data);
            navigation.navigate('Sweep', { p: data });
        } catch (err: any) {
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
        } finally {
            this.setState({ loading: false });
            navigation.goBack();
        }
    };

    render() {
        const { navigation } = this.props;
        const { loading } = this.state;

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
                handleQRScanned={this.handlePrivateKeyScanned}
                goBack={() => {
                    navigation.goBack();
                }}
                navigation={navigation}
            />
        );
    }
}
