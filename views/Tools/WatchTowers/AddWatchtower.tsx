import * as React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
import TextInput from '../../../components/TextInput';
import Text from '../../../components/Text';
import Button from '../../../components/Button';
import Header from '../../../components/Header';
import LoadingIndicator from '../../../components/LoadingIndicator';
import Screen from '../../../components/Screen';
import { ErrorMessage } from '../../../components/SuccessErrorMessage';

import SettingsStore from '../../../stores/SettingsStore';
import BackendUtils from '../../../utils/BackendUtils';

import { localeString } from '../../../utils/LocaleUtils';
import { themeColor } from '../../../utils/ThemeUtils';

import Scan from '../../../assets/images/SVG/Scan.svg';

interface AddWatchtowerProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
}

interface AddWatchtowerState {
    loading: boolean;
    pubkey: string;
    address: string;
    error: string;
    isPubkeyValid: boolean;
    isAddressValid: boolean;
}

@inject('SettingsStore')
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
        const watchtowerRegex = /^([a-fA-F0-9]{66})@([a-zA-Z0-9.-]+):(\d+)$/;
        const match = text.match(watchtowerRegex);
        if (match) {
            const [, pubkey, host, port] = match;
            this.setState({
                pubkey,
                address: `${host}:${port}`,
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

    validatePubkey = (pubkey: string) => {
        const pubkeyRegex = /^[a-fA-F0-9]{66}$/;
        return pubkey === '' || pubkeyRegex.test(pubkey);
    };

    validateAddress = (address: string) => {
        const addressRegex = /^[a-zA-Z0-9.-]+:\d+$/;
        return address === '' || addressRegex.test(address);
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

        if (!pubkey || pubkey.trim() === '') {
            this.setState({
                error: localeString(
                    'views.Tools.watchtowers.addWatchtower.pubkeyRequired'
                )
            });
            return;
        }

        if (!address || address.trim() === '') {
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
            console.log('error', error);
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
                    {error && <ErrorMessage message={error} />}

                    <View style={styles.inputContainer}>
                        <Text
                            style={{
                                ...styles.label,
                                color: themeColor('text')
                            }}
                        >
                            {localeString('views.OpenChannel.nodePubkey')}
                        </Text>
                        <TextInput
                            style={{
                                ...styles.input,
                                backgroundColor: themeColor('secondary')
                            }}
                            value={pubkey}
                            onChangeText={(text: string) => {
                                const isValid = this.validatePubkey(text);
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
                            {localeString(
                                'views.Settings.AddEditNode.serverAddress'
                            )}
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
                                const isValid = this.validateAddress(text);
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
