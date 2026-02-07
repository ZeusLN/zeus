import * as React from 'react';
import { Alert, View } from 'react-native';
import { Header } from '@rneui/themed';
import { observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import LoadingIndicator from '../../components/LoadingIndicator';
import QRCodeScanner from '../../components/QRCodeScanner';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

export interface BaseQRScannerProps {
    navigation: StackNavigationProp<any, any>;
}

export interface BaseQRScannerState {
    loading: boolean;
}

@observer
export default abstract class BaseQRScanner<
    P extends BaseQRScannerProps = BaseQRScannerProps,
    S extends BaseQRScannerState = BaseQRScannerState
> extends React.Component<P, S> {
    isProcessing: boolean = false;

    constructor(props: P) {
        super(props);
        this.state = {
            loading: false
        } as S;
    }

    /**
     * Process the scanned QR data. Implementations should:
     * - Validate the data
     * - Navigate to the appropriate screen on success
     * - Throw an error if the data is invalid
     */
    protected abstract processQRData(data: string): Promise<void>;

    handleQRScanned = async (data: string) => {
        const { navigation } = this.props;

        if (this.isProcessing) return;
        this.isProcessing = true;
        this.setState({ loading: true } as Partial<S> as S);

        try {
            await this.processQRData(data);
        } catch (err: any) {
            this.isProcessing = false;
            console.error(err.message);
            Alert.alert(
                localeString('general.error'),
                (err as Error).message ||
                    localeString('utils.handleAnything.notValid'),
                [
                    {
                        text: localeString('general.ok'),
                        onPress: () => void 0
                    }
                ],
                { cancelable: false }
            );
            this.setState({ loading: false } as Partial<S> as S);
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
                handleQRScanned={this.handleQRScanned}
                goBack={() => navigation.goBack()}
                navigation={navigation}
            />
        );
    }
}
