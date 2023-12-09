import * as React from 'react';
import {
    Text,
    View,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    Image,
    ScrollView
} from 'react-native';
import { SearchBar, Divider } from 'react-native-elements';
import Add from '../../assets/images/SVG/Add.svg';
import EncryptedStorage from 'react-native-encrypted-storage';

import { themeColor } from '../../utils/ThemeUtils';
import Screen from '../../components/Screen';
import Button from '../../components/Button';
import LoadingIndicator from '../../components/LoadingIndicator';
import Header from '../../components/Header';
import TextInput from '../../components/TextInput';
import { localeString } from '../../utils/LocaleUtils';
import BackendUtils from '../../utils/BackendUtils';

interface Bolt12AddressProps {
    navigation: any;
}

interface ContactsSettingsState {
    localPart: string;
    loading: boolean;
}

export default class Bolt12Address extends React.Component<
    Bolt12AddressProps,
    ContactsSettingsState
> {
    constructor(props: Bolt12AddressProps) {
        super(props);
        const SendScreen: boolean = this.props.navigation.getParam(
            'SendScreen',
            null
        );
        this.state = {
            localPart: '',
            loading: true
        };
    }

    componentDidMount() {
        // this.loadContacts();
        console.debug('HELLO TEST');
    }

    async requestPaymentAddress() {
        // make sure name is clean (filter characters in input)
        // verify not taken (skip for now)

        console.debug(`requesting ${this.state.localPart}@bolt12.me`);
        // fetch an offer from cln (visible/configureable to user? maybe later)

        // post request to digital ocean
        // save to settings
        // BackendUtils.getNewOffer().then((data: any) => {
        //     console.debug('data', data);
        //     console.debug('new offer', data.bolt12);
        // });
        const data = await BackendUtils.getNewOffer();
        console.debug('data', data);
    }

    render() {
        const { navigation } = this.props;
        const { localPart, loading } = this.state;

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
                        value={localPart}
                        onChangeText={async (text: string) => {
                            this.setState({ localPart: text });
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
