import * as React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { inject, observer } from 'mobx-react';
import { themeColor } from '../../utils/ThemeUtils';

import Button from '../../components/Button';
import Header from '../../components/Header';
import LoadingIndicator from '../../components/LoadingIndicator';
import Screen from '../../components/Screen';
import { ErrorMessage } from '../../components/SuccessErrorMessage';
import TextInput from '../../components/TextInput';

import { localeString } from '../../utils/LocaleUtils';
import BackendUtils from '../../utils/BackendUtils';

import SettingsStore from '../../stores/SettingsStore';

interface Bolt12AddressSettingsProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

interface Bolt12AddressSettingsState {
    newLocalPart: string;
    existingLocalPart: string;
    loading: boolean;
    error: string;
}

type CreateOfferResponse = {
    active: boolean;
    bolt12: string;
    created: boolean;
    offerId: string;
    singleUse: boolean;
    used: boolean;
};

const HOST = 'twelve.cash';

@inject('SettingsStore')
@observer
export default class Bolt12AddressSettings extends React.Component<
    Bolt12AddressSettingsProps,
    Bolt12AddressSettingsState
> {
    state = {
        newLocalPart: '',
        existingLocalPart: '',
        loading: false,
        error: ''
    };

    async UNSAFE_componentWillMount() {
        const { SettingsStore } = this.props;
        const { getSettings } = SettingsStore;
        const settings = await getSettings();

        this.setState({
            newLocalPart: '',
            existingLocalPart: settings?.bolt12Address?.localPart || ''
        });
    }

    async requestPaymentAddress() {
        const { SettingsStore } = this.props;
        const { newLocalPart } = this.state;
        const { updateSettings } = SettingsStore;

        this.setState({
            loading: true
        });

        const address = `${newLocalPart}@${HOST}`;

        let data: CreateOfferResponse;
        try {
            data = await BackendUtils.createOffer({
                description: address,
                label: address
            });
            if (!data.bolt12)
                throw localeString(
                    'views.Settings.Bolt12Address.error.noBolt12'
                );
        } catch (e) {
            console.error();
            this.setState({
                loading: false,
                error: `${localeString(
                    'views.Settings.Bolt12Address.error.failedToGetOffer'
                )}: ${e}`
            });
            return;
        }

        try {
            const res = await fetch(`https://${HOST}/record`, {
                method: 'POST',
                body: JSON.stringify({
                    localPart: newLocalPart,
                    bolt12: data.bolt12
                })
            });

            if (res.status === 409) {
                this.setState({
                    error: localeString(
                        'views.Settings.Bolt12Address.error.handleTaken'
                    )
                });
                return;
            } else if (res.status !== 201) {
                this.setState({
                    error: localeString(
                        'views.Settings.Bolt12Address.error.failedToCreate'
                    )
                });
                return;
            }

            await updateSettings({
                bolt12Address: {
                    localPart: this.state.newLocalPart
                }
            });
            this.setState({
                newLocalPart: '',
                existingLocalPart: this.state.newLocalPart,
                loading: false
            });
        } catch (e) {
            console.error(e);
            this.setState({
                error: localeString(
                    'views.Settings.Bolt12Address.error.failedToCreate'
                )
            });
            return;
        }
    }

    render() {
        const { navigation } = this.props;
        const { newLocalPart, existingLocalPart, loading, error } = this.state;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Settings.Bolt12Address'),
                        style: {
                            ...styles.secondaryText,
                            color: themeColor('text')
                        }
                    }}
                    rightComponent={
                        loading ? <LoadingIndicator size={30} /> : <></>
                    }
                    containerStyle={{ borderBottomWidth: 0 }}
                    navigation={navigation}
                />
                {error && <ErrorMessage message={error} />}
                {existingLocalPart ? (
                    <View style={{ padding: 20 }}>
                        <Text
                            style={{
                                ...styles.handle,
                                color: themeColor('text'),
                                paddingBottom: 10
                            }}
                        >
                            {`${existingLocalPart}@${HOST}`}
                        </Text>
                        <View style={styles.button}>
                            <Button
                                title={localeString(
                                    'views.Settings.Bolt12Address.changeButton'
                                )}
                                onPress={() => {
                                    this.setState({
                                        existingLocalPart: '',
                                        newLocalPart: ''
                                    });
                                }}
                            />
                        </View>
                    </View>
                ) : (
                    <View
                        style={{
                            padding: 20
                        }}
                    >
                        <Text
                            style={{
                                ...styles.secondaryText,
                                color: themeColor('secondaryText')
                            }}
                        >
                            {localeString(
                                'views.Settings.Bolt12Address.handle'
                            )}
                        </Text>
                        <View
                            style={{
                                display: 'flex',
                                flexDirection: 'row'
                            }}
                        >
                            <TextInput
                                value={newLocalPart}
                                onChangeText={(text: string) => {
                                    this.setState({
                                        newLocalPart: text
                                    });
                                }}
                                autoCapitalize="none"
                                autoCorrect={false}
                                style={{
                                    flex: 1,
                                    flexDirection: 'row'
                                }}
                            />
                            <Text
                                style={{
                                    fontFamily: 'PPNeueMontreal-Book',
                                    color: themeColor('text'),
                                    fontSize: 20,
                                    marginLeft: 5,
                                    marginTop: 27
                                }}
                            >
                                @{HOST}
                            </Text>
                        </View>
                        <Text
                            style={{
                                fontFamily: 'PPNeueMontreal-Book',
                                color: themeColor('warning')
                            }}
                        >
                            {error}
                        </Text>
                        <View style={styles.button}>
                            <Button
                                title={localeString(
                                    'views.Settings.Bolt12Address.requestButton'
                                )}
                                disabled={!this.state.newLocalPart}
                                onPress={() => this.requestPaymentAddress()}
                            />
                        </View>
                    </View>
                )}
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    handle: {
        fontSize: 20,
        alignSelf: 'center',
        fontFamily: 'PPNeueMontreal-Book'
    },
    secondaryText: {
        fontFamily: 'PPNeueMontreal-Book'
    },
    button: {
        padding: 10
    }
});
