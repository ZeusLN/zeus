import * as React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
import TextInput from '../../../components/TextInput';
import Text from '../../../components/Text';
import Button from '../../../components/Button';
import Header from '../../../components/Header';
import LoadingIndicator from '../../../components/LoadingIndicator';
import Screen from '../../../components/Screen';
import { ErrorMessage } from '../../../components/SuccessErrorMessage';

import BackendUtils from '../../../utils/BackendUtils';
import ValidationUtils from '../../../utils/ValidationUtils';
import NodeUriUtils from '../../../utils/NodeUriUtils';

import { localeString } from '../../../utils/LocaleUtils';
import { themeColor } from '../../../utils/ThemeUtils';

import Scan from '../../../assets/images/SVG/Scan.svg';

interface AddWatchtowerProps {
    navigation: StackNavigationProp<any, any>;
}

interface AddWatchtowerState {
    loading: boolean;
    pubkey: string;
    address: string;
    error: string;
    isPubkeyValid: boolean;
    isAddressValid: boolean;
}

@observer
export default class AddWatchtower extends React.Component<
    AddWatchtowerProps,
    AddWatchtowerState
> {
    state = {
        loading: false,
        pubkey: '',
        address: '',
        error: '',
        isPubkeyValid: true,
        isAddressValid: true
    };

    validateWatchtowerData = (text: string) => {
        if (NodeUriUtils.isValidNodeUri(text)) {
            const { pubkey, host } = NodeUriUtils.processNodeUri(text);
            this.setState({
                pubkey,
                address: host,
                error: '',
                isPubkeyValid: true,
                isAddressValid: true
            });
            return true;
        }
        this.setState({
            error: localeString(
                'views.Tools.watchtowers.addWatchtower.invalidFormat'
            )
        });
        return false;
    };

    handleScan = () => {
        this.props.navigation.navigate('HandleAnythingQRScanner', {
            handleScannedData: this.validateWatchtowerData
        });
    };

    addWatchtower = async () => {
        const { navigation } = this.props;
        const { pubkey, address } = this.state;
        this.setState({ error: '' });

        if (!pubkey) {
            this.setState({
                error: localeString(
                    'views.Tools.watchtowers.addWatchtower.pubkeyRequired'
                )
            });
            return;
        }

        if (!address) {
            this.setState({
                error: localeString(
                    'views.Settings.AddEditNode.serverAddressRequired'
                )
            });
            return;
        }
        this.setState({ loading: true });
        try {
            await BackendUtils.addWatchtower({
                pubkey,
                address
            });
            this.setState({ loading: false });
            navigation.goBack();
        } catch (error: any) {
            this.setState({
                loading: false,
                error: error.message || localeString('general.unknown_error')
            });
        }
    };

    render() {
        const { navigation } = this.props;
        const {
            loading,
            pubkey,
            address,
            error,
            isPubkeyValid,
            isAddressValid
        } = this.state;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Tools.addWatchtower'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={
                        <View
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center'
                            }}
                        >
                            {loading && (
                                <View style={{ marginRight: 12 }}>
                                    <LoadingIndicator size={24} />
                                </View>
                            )}
                            <TouchableOpacity onPress={this.handleScan}>
                                <Scan
                                    fill={themeColor('text')}
                                    width={24}
                                    height={24}
                                />
                            </TouchableOpacity>
                        </View>
                    }
                    navigation={navigation}
                />
                <View
                    style={{
                        ...styles.container,
                        backgroundColor: themeColor('background')
                    }}
                >
                    {error && (
                        <View style={styles.descriptionContainer}>
                            <ErrorMessage message={error} />
                        </View>
                    )}

                    <View style={styles.inputContainer}>
                        <Text
                            style={{
                                ...styles.label,
                                color: themeColor('text')
                            }}
                        >
                            {localeString(
                                'views.Tools.watchtowers.serverPubkey'
                            )}
                        </Text>
                        <TextInput
                            style={{
                                ...styles.input,
                                backgroundColor: themeColor('secondary')
                            }}
                            value={pubkey}
                            onChangeText={(text: string) => {
                                const isValid =
                                    ValidationUtils.validateNodePubkey(text);
                                this.setState({
                                    pubkey: text,
                                    error: '',
                                    isPubkeyValid: isValid
                                });
                            }}
                            textColor={
                                isPubkeyValid
                                    ? themeColor('text')
                                    : themeColor('error')
                            }
                            placeholder={'02abc...'}
                            placeholderTextColor={themeColor('secondaryText')}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Text
                            style={{
                                ...styles.label,
                                color: themeColor('text')
                            }}
                        >
                            {localeString('views.OpenChannel.host')}
                        </Text>
                        <TextInput
                            style={{
                                ...styles.input,
                                backgroundColor: themeColor('secondary')
                            }}
                            textColor={
                                isAddressValid
                                    ? themeColor('text')
                                    : themeColor('error')
                            }
                            value={address}
                            onChangeText={(text: string) => {
                                const isValid =
                                    ValidationUtils.validateNodeHost(text);
                                this.setState({
                                    address: text,
                                    error: '',
                                    isAddressValid: isValid
                                });
                            }}
                            placeholder={localeString(
                                'views.OpenChannel.hostPort'
                            )}
                            placeholderTextColor={themeColor('secondaryText')}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </View>

                    <View style={styles.descriptionContainer}>
                        <Text
                            style={{
                                ...styles.description,
                                color: themeColor('secondaryText')
                            }}
                        >
                            {localeString(
                                'views.Tools.watchtowers.addWatchtower.explainer'
                            )}
                        </Text>
                    </View>

                    <Button
                        title={localeString('views.Tools.addWatchtower')}
                        onPress={this.addWatchtower}
                        disabled={
                            loading ||
                            !pubkey.trim() ||
                            !address.trim() ||
                            !isPubkeyValid ||
                            !isAddressValid
                        }
                    />
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16
    },
    inputContainer: {
        marginBottom: 16
    },
    label: {
        fontSize: 15,
        fontFamily: 'PPNeueMontreal-Medium'
    },
    input: {
        borderRadius: 8,
        fontSize: 15,
        fontFamily: 'PPNeueMontreal-Book'
    },
    descriptionContainer: {
        marginTop: 8,
        marginBottom: 24
    },
    description: {
        fontSize: 14,
        lineHeight: 20,
        fontFamily: 'PPNeueMontreal-Book',
        opacity: 0.8
    }
});
