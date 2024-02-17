import * as React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { inject, observer } from 'mobx-react';
import { themeColor } from '../../utils/ThemeUtils';
import Screen from '../../components/Screen';
import Button from '../../components/Button';
import Header from '../../components/Header';
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

@inject('SettingsStore')
@observer
export default class Bolt12AddressSettings extends React.Component<
    Bolt12AddressSettingsProps,
    Bolt12AddressSettingsState
> {
    state = {
        newLocalPart: '',
        existingLocalPart: '',
        loading: true,
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
        let data: CreateOfferResponse;
        try {
            data = await BackendUtils.getNewOffer();
            if (!data.bolt12) throw 'no bolt12';
        } catch (e) {
            console.error('Failed to get offer', e);
            return;
        }

        try {
            const res = await fetch('https://twelve.cash/record', {
                method: 'POST',
                body: JSON.stringify({
                    localPart: this.state.newLocalPart,
                    bolt12: data.bolt12
                })
            });

            if (res.status === 409) {
                this.setState({ error: 'Name is taken' });
                return;
            } else if (res.status !== 201) {
                this.setState({ error: 'Failed to create Paycode' });
                return;
            }
        } catch (e) {
            console.error(e);
            this.setState({ error: 'Failed to create Paycode' });
            return;
        }

        const { SettingsStore } = this.props;
        const { updateSettings } = SettingsStore;

        await updateSettings({
            bolt12Address: {
                localPart: this.state.newLocalPart
            }
        });
        this.setState({
            newLocalPart: '',
            existingLocalPart: this.state.newLocalPart
        });
    }

    render() {
        const { navigation, SettingsStore } = this.props;
        const { updateSettings } = SettingsStore;
        const { newLocalPart, existingLocalPart, error } = this.state;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString(
                            'views.Settings.Bolt12Address.bolt12Address'
                        ),
                        style: {
                            ...styles.secondaryText,
                            color: themeColor('text')
                        }
                    }}
                    containerStyle={{ borderBottomWidth: 0 }}
                    navigation={navigation}
                />
                {existingLocalPart ? (
                    <View style={{ padding: 20 }}>
                        <Text
                            style={{
                                ...styles.handle,
                                color: themeColor('text'),
                                paddingBottom: 10
                            }}
                        >
                            {existingLocalPart + '@twelve.cash'}
                        </Text>
                        <View style={styles.button}>
                            <Button
                                title={localeString(
                                    'views.Settings.Bolt12Address.changeButton'
                                )}
                                onPress={async () => {
                                    await updateSettings({
                                        bolt12Address: {
                                            localPart: ''
                                        }
                                    });
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
                        <TextInput
                            autoCapitalize="none"
                            value={newLocalPart}
                            onChangeText={(text: string) => {
                                this.setState({
                                    newLocalPart: text.trim(),
                                    error: ''
                                });
                            }}
                        />
                        <Text
                            style={{
                                ...styles.secondaryText,
                                color: themeColor('secondaryText')
                            }}
                        >
                            {newLocalPart + '@twelve.cash'}
                        </Text>
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
                                onPress={async () =>
                                    this.requestPaymentAddress()
                                }
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
