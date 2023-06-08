import * as React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from 'react-native-elements';

import Header from '../../components/Header';
import TextInput from '../../components/TextInput';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

interface ImportAccountProps {
    exitSetup: any;
    navigation: any;
}

interface ImportAccountState {
    name: string;
    extended_public_key: string;
    master_key_fingerprint: string;
    address_type: string;
}

export default class ImportAccount extends React.Component<
    ImportAccountProps,
    ImportAccountState
> {
    constructor(props: any) {
        super(props);
        this.state = {
            name: '',
            extended_public_key: '',
            master_key_fingerprint: '',
            address_type: ''
        };
    }

    UNSAFE_componentWillReceiveProps = (newProps: any) => {
        const { navigation } = newProps;
        const qrResponse = navigation.getParam('qrResponse', null);
        console.log('~~~');
        console.log(qrResponse);
        const parsed = JSON.parse(qrResponse);
        const name = (parsed.keystore && parsed.keystore.label) || '';
        const extended_public_key =
            parsed.ExtPubKey || (parsed.keystore && parsed.keystore.xpub) || '';
        const master_key_fingerprint =
            parsed.MasterFingerprint ||
            (parsed.keystore && parsed.keystore.ckcc_xfp.toString()) ||
            '';
        const address_type = parsed.wallet_type || '';

        this.setState({
            name,
            extended_public_key,
            master_key_fingerprint,
            address_type
        });
    };

    render() {
        const { navigation } = this.props;
        const {
            name,
            extended_public_key,
            master_key_fingerprint,
            address_type
        } = this.state;

        return (
            <ScrollView
                style={{
                    flex: 1,
                    backgroundColor: themeColor('background')
                }}
                keyboardShouldPersistTaps="handled"
            >
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.ImportAccount.title'),
                        style: { color: themeColor('text') }
                    }}
                    navigation={navigation}
                />
                <View style={styles.content}>
                    <Text
                        style={{ ...styles.label, color: themeColor('text') }}
                    >
                        {localeString('views.ImportAccount.name')}
                    </Text>
                    <TextInput
                        placeholder={'My airgapped hardware wallet'}
                        value={name}
                        onChangeText={(text: string) =>
                            this.setState({
                                name: text
                            })
                        }
                    />
                    <Text
                        style={{ ...styles.label, color: themeColor('text') }}
                    >
                        {localeString('views.ImportAccount.extendedPubKey')}
                    </Text>
                    <TextInput
                        placeholder={
                            'xpub6CrfKnKeMWmHvuVWVsggTAPH2cwEHVnuHoVoqFcqZDgFAs1eM4UzjYsnjocuAHdzKp13uEn86RpZCBsY54iwvV5uLoxdvJHYiSFhgp5Pead'
                        }
                        value={extended_public_key}
                        onChangeText={(text: string) =>
                            this.setState({
                                extended_public_key: text
                            })
                        }
                        numberOfLines={4}
                        multiline
                    />
                    <Text
                        style={{ ...styles.label, color: themeColor('text') }}
                    >
                        {localeString(
                            'views.ImportAccount.masterKeyFingerprint'
                        )}
                    </Text>
                    <TextInput
                        placeholder={"m/44'/0'/0'/0"}
                        value={master_key_fingerprint}
                        onChangeText={(text: string) =>
                            this.setState({
                                master_key_fingerprint: text
                            })
                        }
                    />
                    <Text
                        style={{ ...styles.label, color: themeColor('text') }}
                    >
                        {localeString('views.ImportAccount.addressType')}
                    </Text>
                    <TextInput
                        placeholder={'mkf'}
                        value={address_type}
                        onChangeText={(text: string) =>
                            this.setState({
                                address_type: text
                            })
                        }
                    />
                    <Button
                        title="ImportAccount"
                        onPress={() =>
                            this.props.UTXOsStore.importAccount({
                                ...this.state,
                                dry_run: true
                            })
                        }
                    />
                    <Button
                        title="Scan"
                        onPress={() =>
                            navigation.navigate('ImportAccountQRScanner')
                        }
                    />
                </View>
            </ScrollView>
        );
    }
}

const styles = StyleSheet.create({
    content: {
        paddingTop: 20,
        paddingBottom: 20,
        paddingLeft: 5,
        paddingRight: 5
    },
    label: {
        textDecorationLine: 'underline'
    },
    button: {
        paddingTop: 10,
        paddingBottom: 10,
        width: 250,
        alignSelf: 'center'
    },
    clipboardImport: {
        padding: 10,
        backgroundColor: 'rgba(92, 99,216, 1)',
        color: 'white'
    }
});
