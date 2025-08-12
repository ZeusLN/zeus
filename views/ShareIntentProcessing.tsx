import * as React from 'react';
import { View, Text, NativeModules } from 'react-native';
import { observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
import { Route } from '@react-navigation/native';
import RNQRGenerator from 'rn-qr-generator';

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
        { qrData?: string; base64Image?: string }
    >;
}

interface ShareIntentProcessingState {
    processing: boolean;
    error?: string;
}

@observer
export default class ShareIntentProcessing extends React.Component<
    ShareIntentProcessingProps,
    ShareIntentProcessingState
> {
    state = {
        processing: true,
        error: undefined
    };

    async componentDidMount() {
        const { route, navigation } = this.props;
        const { qrData, base64Image } = route.params;

        try {
            let finalQrData: string | null = null;

            if (qrData) {
                finalQrData = qrData;
            } else if (base64Image) {
                const result = await RNQRGenerator.detect({
                    base64: base64Image
                });

                if (result?.values.length > 0) {
                    finalQrData = result.values[0];
                } else {
                    throw new Error('No QR code found in image');
                }
            } else {
                throw new Error('No QR data or image provided');
            }

            if (finalQrData) {
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
                    this.setState({
                        processing: false,
                        error: localeString('utils.shareIntent.processingError')
                    });
                }
            }
        } catch (error) {
            console.error('Error processing shared QR:', error);

            try {
                await MobileTools.clearSharedIntent();
            } catch (clearError) {
                console.warn(
                    'Failed to clear shared intent after error:',
                    clearError
                );
            }

            this.setState({
                processing: false,
                error: localeString('utils.shareIntent.processingError')
            });
        }
    }

    render() {
        const { error } = this.state;

        if (error) {
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
                        <Text
                            style={{
                                color: themeColor('error'),
                                fontSize: 18,
                                textAlign: 'center',
                                marginBottom: 20,
                                fontFamily: 'PPNeueMontreal-Book'
                            }}
                        >
                            {error}
                        </Text>
                        <Text
                            style={{
                                color: themeColor('secondaryText'),
                                fontSize: 14,
                                textAlign: 'center',
                                marginBottom: 20,
                                fontFamily: 'PPNeueMontreal-Book'
                            }}
                        >
                            {localeString('utils.shareIntent.noQRFound')}
                        </Text>
                    </View>
                </Screen>
            );
        }

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
                        {localeString('utils.shareIntent.processing')}
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
