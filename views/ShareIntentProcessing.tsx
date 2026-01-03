import * as React from 'react';
import { View, Text, NativeModules, Alert } from 'react-native';
import { observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
import { Route } from '@react-navigation/native';
import QRKit from 'react-native-qr-kit';

import LoadingIndicator from '../components/LoadingIndicator';
import Screen from '../components/Screen';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';
import handleAnything from '../utils/handleAnything';

const { MobileTools } = NativeModules;

interface ShareIntentProcessingProps {
    navigation: StackNavigationProp<any, any>;
    route: Route<
        'ShareIntentProcessing',
        {
            qrData?: string;
            base64Image?: string;
            requiresAuth?: boolean;
            requiresWalletSelection?: boolean;
        }
    >;
}

interface ShareIntentProcessingState {
    processing: boolean;
    currentStep: string;
}

@observer
class ShareIntentProcessing extends React.Component<
    ShareIntentProcessingProps,
    ShareIntentProcessingState
> {
    state = {
        processing: true,
        currentStep: localeString('utils.shareIntent.processing')
    };

    showInvalidImageAlert = (message: string) => {
        const { navigation } = this.props;

        Alert.alert(localeString('general.error'), message, [
            {
                text: localeString('general.ok'),
                onPress: () => {
                    if (navigation.canGoBack()) {
                        navigation.goBack();
                    } else {
                        navigation.navigate('Wallet');
                    }
                }
            }
        ]);
    };

    async componentDidMount() {
        const { route, navigation } = this.props;
        const { qrData, base64Image, requiresAuth, requiresWalletSelection } =
            route.params;

        if (requiresAuth) {
            this.setState({
                currentStep: localeString('utils.shareIntent.authRequired')
            });

            const shareData = { qrData, base64Image };

            navigation.replace('Lockscreen', {
                modifySecurityScreen: '',
                deletePin: false,
                deleteDuressPin: false,
                shareIntentData: shareData
            });
            return;
        }

        if (requiresWalletSelection) {
            this.setState({
                currentStep: localeString('utils.shareIntent.walletSelection')
            });

            const shareData = { qrData, base64Image };

            navigation.replace('Wallets', {
                fromStartup: true,
                shareIntentData: shareData
            });
            return;
        }

        await this.processQRCode(qrData, base64Image);
    }

    async processQRCode(qrData?: string, base64Image?: string) {
        const { navigation } = this.props;

        try {
            this.setState({
                currentStep: localeString('utils.shareIntent.extractingQRCode')
            });
            let finalQrData: string | null = null;

            if (qrData) {
                finalQrData = qrData;
            } else if (base64Image) {
                const result = await QRKit.decodeBase64(base64Image);

                if (result?.success && result.data) {
                    finalQrData = result.data;
                } else {
                    try {
                        await MobileTools.clearSharedIntent();
                    } catch (clearError) {
                        console.warn(
                            'Failed to clear shared intent:',
                            clearError
                        );
                    }

                    this.showInvalidImageAlert(
                        localeString('utils.shareIntent.invalidImage')
                    );
                    return;
                }
            } else {
                try {
                    await MobileTools.clearSharedIntent();
                } catch (clearError) {
                    console.warn('Failed to clear shared intent:', clearError);
                }

                this.showInvalidImageAlert(
                    localeString('utils.shareIntent.processingError')
                );
                return;
            }

            if (finalQrData) {
                this.setState({
                    currentStep: localeString(
                        'utils.shareIntent.processingPayment'
                    )
                });
                const response = await handleAnything(finalQrData);
                if (response) {
                    const [route, params] = response;

                    try {
                        await MobileTools.clearSharedIntent();
                    } catch (error) {
                        console.warn('Failed to clear shared intent:', error);
                    }

                    navigation.replace(route, params);
                } else {
                    try {
                        await MobileTools.clearSharedIntent();
                    } catch (clearError) {
                        console.warn(
                            'Failed to clear shared intent:',
                            clearError
                        );
                    }

                    this.showInvalidImageAlert(
                        localeString('utils.shareIntent.processingError')
                    );
                    return;
                }
            }
        } catch (error) {
            console.error(
                '[ShareIntentProcessing] Error processing shared QR:',
                error
            );

            try {
                await MobileTools.clearSharedIntent();
            } catch (clearError) {
                console.warn(
                    'Failed to clear shared intent after error:',
                    clearError
                );
            }

            this.showInvalidImageAlert(
                localeString('utils.shareIntent.processingError')
            );
        }
    }

    render() {
        const { currentStep } = this.state;

        return (
            <Screen>
                <View
                    style={{
                        flex: 1,
                        justifyContent: 'center',
                        alignItems: 'center',
                        padding: 20
                    }}
                >
                    <LoadingIndicator />
                    <Text
                        style={{
                            color: themeColor('text'),
                            fontSize: 18,
                            textAlign: 'center',
                            marginTop: 20,
                            fontFamily: 'PPNeueMontreal-Book'
                        }}
                    >
                        {currentStep + '...'}
                    </Text>
                    <Text
                        style={{
                            color: themeColor('secondaryText'),
                            fontSize: 14,
                            textAlign: 'center',
                            marginTop: 10,
                            fontFamily: 'PPNeueMontreal-Book'
                        }}
                    >
                        {localeString('utils.shareIntent.extractingQR')}
                    </Text>
                </View>
            </Screen>
        );
    }
}

export default ShareIntentProcessing;
