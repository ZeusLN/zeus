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
    bolt12AddressLocalPart: string;
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
        bolt12AddressLocalPart: '',
        loading: true,
        error: ''
    };

    async UNSAFE_componentWillMount() {
        const { SettingsStore } = this.props;
        const { getSettings } = SettingsStore;
        const settings = await getSettings();

        this.setState({
            bolt12AddressLocalPart: settings?.bolt12Address?.localPart || ''
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

        // TODO: Use twelve.cash server
        // validate/parse string input
        try {
            const res = await fetch('http://localhost:3000/record', {
                method: 'POST',
                body: JSON.stringify({
                    localPart: this.state.bolt12AddressLocalPart,
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
                localPart: this.state.bolt12AddressLocalPart
            }
        });
    }

    render() {
        const { navigation } = this.props;
        const { bolt12AddressLocalPart, error } = this.state;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    containerStyle={{ borderBottomWidth: 0 }}
                    navigation={navigation}
                />
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
                        {localeString('views.Settings.AddContact.name')}
                    </Text>
                    <TextInput
                        placeholder={`${localeString(
                            'views.Settings.AddContact.name'
                        )}@twelve.cash`}
                        autoCapitalize="none"
                        value={bolt12AddressLocalPart}
                        onChangeText={(text: string) => {
                            this.setState({
                                bolt12AddressLocalPart: text.trim(),
                                error: ''
                            });
                        }}
                    />
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
                                'views.Settings.Bolt12Address.button'
                            )}
                            disabled={!this.state.bolt12AddressLocalPart}
                            onPress={async () => this.requestPaymentAddress()}
                        />
                    </View>
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    secondaryText: {
        fontFamily: 'PPNeueMontreal-Book'
    },
    button: {
        padding: 10
    }
});
