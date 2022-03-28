import * as React from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { Header, Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import Button from './../../components/Button';
import { ErrorMessage } from './../../components/SuccessErrorMessage';
import LoadingIndicator from './../../components/LoadingIndicator';
import TextInput from './../../components/TextInput';

import Base64Utils from './../../utils/Base64Utils';
import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';

import Scan from './../../assets/images/SVG/Scan.svg';

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

@inject('UTXOsStore')
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
        const parsed = JSON.parse(qrResponse);
        const name = (parsed.keystore && parsed.keystore.label) || '';
        const extended_public_key =
            parsed.ExtPubKey || (parsed.keystore && parsed.keystore.xpub) || '';
        const master_key_fingerprint = parsed.MasterFingerprint || '';
        const address_type = parsed.wallet_type || '';

        this.setState({
            name,
            extended_public_key,
            master_key_fingerprint,
            address_type
        });
    };

    render() {
        const { navigation, UTXOsStore } = this.props;
        const { errorMsg, importingAccount, accountToImport } = UTXOsStore;
        const {
            name,
            extended_public_key,
            master_key_fingerprint,
            address_type
        } = this.state;

        if (accountToImport) {
            navigation.navigate('ImportingAccount');
        }

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.goBack()}
                color={themeColor('text')}
                underlayColor="transparent"
            />
        );

        const ScanBadge = ({ navigation }: { navigation: any }) => (
            <TouchableOpacity
                onPress={() => navigation.navigate('ImportAccountQRScanner')}
            >
                <Scan fill={themeColor('text')} />
            </TouchableOpacity>
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
                    rightComponent={<ScanBadge navigation={navigation} />}
                    backgroundColor={themeColor('background')}
                    containerStyle={{
                        borderBottomWidth: 0
                    }}
                />
                <View style={styles.content}>
                    {!!errorMsg && <ErrorMessage message={errorMsg} />}
                    {!!importingAccount && <LoadingIndicator />}
                    <Text style={styles.label}>
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
                    <Text style={styles.label}>
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

                    <>
                        <Text style={styles.label}>
                            {localeString(
                                'views.ImportAccount.masterKeyFingerprint'
                            )}
                        </Text>
                        <TextInput
                            placeholder="E65423A4"
                            value={master_key_fingerprint}
                            onChangeText={(text: string) =>
                                this.setState({
                                    master_key_fingerprint: text
                                })
                            }
                        />
                    </>

                    <Text style={styles.label}>
                        {localeString('views.ImportAccount.addressType')}
                    </Text>
                    <TextInput
                        placeholder={'standard'}
                        value={address_type}
                        onChangeText={(text: string) =>
                            this.setState({
                                address_type: text
                            })
                        }
                    />
                    <View style={styles.button}>
                        <Button
                            title="Import Account"
                            onPress={() =>
                                UTXOsStore.importAccount({
                                    ...this.state,
                                    dry_run: true
                                })
                            }
                        />
                    </View>
                </View>
            </ScrollView>
        );
    }
}

const styles = StyleSheet.create({
    content: {
        paddingTop: 20,
        paddingBottom: 20,
        paddingLeft: 15,
        paddingRight: 15
    },
    label: {
        color: themeColor('secondaryText')
    },
    button: {
        paddingTop: 10,
        paddingBottom: 10,
        width: '90%',
        alignSelf: 'center'
    },
    clipboardImport: {
        padding: 10,
        backgroundColor: 'rgba(92, 99,216, 1)',
        color: 'white'
    }
});
