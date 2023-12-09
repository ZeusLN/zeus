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
        loading: true
    };

    async UNSAFE_componentWillMount() {
        const { SettingsStore } = this.props;
        const { getSettings } = SettingsStore;
        const settings = await getSettings();

        this.setState({
            bolt12AddressLocalPart: settings?.bolt12Address?.localPart || ''
        });
    }

    componentDidMount() {
        // this.loadContacts();
        console.debug('HELLO TEST');
        // console.debug(SendScreen)
    }

    async requestPaymentAddress() {
        // make sure name is clean (filter characters in input)
        // verify not taken (skip for now... zeus backend route)

        console.debug(
            `requesting ${this.state.bolt12AddressLocalPart}@bolt12.me`
        );
        // fetch an offer from cln (visible/configureable to user? maybe later)

        let data: CreateOfferResponse;
        try {
            data = await BackendUtils.getNewOffer();
            if (!data.bolt12) throw 'no bolt12';
        } catch (e) {
            console.error('Failed to get offer', e);
            return;
        }

        console.debug('data', data);

        // post request to digital ocean (would normally hit zeus backend route)
        try {
            const res = await fetch('http://localhost:3000/record', {
                method: 'POST',
                body: JSON.stringify({
                    localPart: this.state.bolt12AddressLocalPart,
                    bolt12: data.bolt12
                })
            });
            const json = await res.json();
            console.debug('json', json);
        } catch (e) {
            console.error('Error posting dns record', e);
            return;
        }

        const { SettingsStore } = this.props;
        const { updateSettings } = SettingsStore;

        // save to settings
        await updateSettings({
            bolt12Address: {
                localPart: this.state.bolt12AddressLocalPart
            }
        });
    }

    render() {
        // const { navigation } = this.props
        const { navigation, SettingsStore } = this.props;
        const { bolt12AddressLocalPart } = this.state;
        const { implementation, updateSettings }: any = SettingsStore;
        // const { bolt12AddressLocalPart, loading } = this.state;

        return (
            <Screen>
                {/* style={{
                    flex: 1,
                    backgroundColor: themeColor('background')
                }}
            > */}
                <Header
                    leftComponent="Back"
                    containerStyle={{ borderBottomWidth: 0 }}
                    // rightComponent={SendScreen ? undefined : <AddButton />}
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
                        {/* {localeString('views.Receive.memo')} */}
                        Name
                    </Text>
                    <TextInput
                        // TODO: character filtering, localeStrings
                        // placeholder={localeString(
                        //     'views.Receive.memoPlaceholder'
                        // )}
                        placeholder="<name>@bolt12.me"
                        autoCapitalize="none"
                        value={bolt12AddressLocalPart}
                        onChangeText={async (text: string) => {
                            this.setState({ bolt12AddressLocalPart: text });
                            // TODO: Only update settings if it worked
                            // await updateSettings({
                            //     invoices: {
                            //         addressType,
                            //         memo: text,
                            //         expiry,
                            //         routeHints,
                            //         ampInvoice,
                            //         showCustomPreimageField
                            //     }
                            // });
                        }}
                    />
                    <View style={styles.button}>
                        <Button
                            // title={localeString(
                            //     'views.Settings.signMessage.button'
                            // )}
                            title="Submit"
                            disabled={!this.state.bolt12AddressLocalPart}
                            icon={{
                                name: 'create'
                            }}
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
