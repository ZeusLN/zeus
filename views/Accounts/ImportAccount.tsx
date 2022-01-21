import * as React from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View
} from 'react-native';
import Clipboard from '@react-native-community/clipboard';
import { inject, observer } from 'mobx-react';
import { Button, CheckBox, Header, Icon } from 'react-native-elements';
import FeeTable from './../../components/FeeTable';
import UTXOPicker from './../../components/UTXOPicker';

import RESTUtils from './../../utils/RESTUtils';
import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';

import SettingsStore from './../../stores/SettingsStore';
import UTXOsStore from './../../stores/UTXOsStore';

interface ImportAccountProps {
    exitSetup: any;
    navigation: any;
    SettingsStore: SettingsStore;
    UTXOsStore: UTXOsStore;
}

interface ImportAccountState {
    name: string;
    extended_public_key: string;
    master_key_fingerprint: string;
    address_type: string;
}

@inject('SettingsStore', 'UTXOsStore')
@observer
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
        const { SettingsStore, UTXOsStore, navigation } = this.props;
        const {
            name,
            extended_public_key,
            master_key_fingerprint,
            address_type
        } = this.state;

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.goBack()}
                color="#fff"
                underlayColor="transparent"
            />
        );

        return (
            <ScrollView
                style={{
                    flex: 1,
                    backgroundColor: themeColor('background'),
                    color: themeColor('text')
                }}
            >
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: localeString('views.ImportAccount.title'),
                        style: { color: themeColor('text') }
                    }}
                    backgroundColor="grey"
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
                        style={{
                            ...styles.textInput,
                            color: themeColor('text')
                        }}
                        placeholderTextColor="gray"
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
                        style={{
                            ...styles.textInput,
                            color: themeColor('text')
                        }}
                        placeholderTextColor="gray"
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
                        style={{
                            ...styles.textInput,
                            color: themeColor('text')
                        }}
                        placeholderTextColor="gray"
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
                        style={{
                            ...styles.textInput,
                            color: themeColor('text')
                        }}
                        placeholderTextColor="gray"
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
    textInput: {
        fontSize: 20
    },
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
