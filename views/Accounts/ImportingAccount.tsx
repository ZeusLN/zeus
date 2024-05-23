import * as React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import Button from './../../components/Button';
import Header from '../../components/Header';
import {
    SuccessMessage,
    ErrorMessage
} from './../../components/SuccessErrorMessage';
import KeyValue from './../../components/KeyValue';
import Screen from '../../components/Screen';

import Base64Utils from '../../utils/Base64Utils';
import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';

import UTXOsStore from '../../stores/UTXOsStore';

import { walletrpc } from '../../proto/lightning';

interface ImportingAccountProps {
    exitSetup: any;
    navigation: StackNavigationProp<any, any>;
    UTXOsStore: UTXOsStore;
}

@inject('UTXOsStore')
@observer
export default class ImportingAccount extends React.Component<
    ImportingAccountProps,
    {}
> {
    render() {
        const { navigation, UTXOsStore } = this.props;
        const { accountToImport, errorMsg, success } = UTXOsStore;
        const { account, dry_run_external_addrs, dry_run_internal_addrs } =
            accountToImport;
        const {
            name,
            extended_public_key,
            master_key_fingerprint,
            address_type,
            derivation_path,
            watch_only
        } = account;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.ImportAccount.title'),
                        style: { color: themeColor('text') }
                    }}
                    navigation={navigation}
                />
                <ScrollView style={styles.content}>
                    {!!errorMsg && <ErrorMessage message={errorMsg} />}
                    {success && (
                        <SuccessMessage
                            message={localeString(
                                'views.ImportAccount.success'
                            )}
                        />
                    )}
                    <KeyValue
                        keyValue={localeString('views.ImportAccount.name')}
                        value={name}
                    />

                    <KeyValue
                        keyValue={localeString(
                            'views.ImportAccount.extendedPubKey'
                        )}
                        value={extended_public_key}
                    />

                    {!!master_key_fingerprint && (
                        <KeyValue
                            keyValue={localeString(
                                'views.ImportAccount.masterKeyFingerprint'
                            )}
                            value={Base64Utils.reverseMfpBytes(
                                Base64Utils.base64ToHex(master_key_fingerprint)
                            ).toUpperCase()}
                        />
                    )}

                    <KeyValue
                        keyValue={localeString(
                            'views.ImportAccount.addressType'
                        )}
                        value={
                            walletrpc.AddressType[address_type] || address_type
                        }
                    />

                    <KeyValue
                        keyValue={localeString(
                            'views.ImportAccount.derivationPath'
                        )}
                        value={derivation_path}
                    />

                    <KeyValue
                        keyValue={localeString('views.ImportAccount.watchOnly')}
                        value={watch_only ? 'True' : 'False'}
                    />

                    <Text
                        style={{
                            fontFamily: 'PPNeueMontreal-Medium',
                            color: themeColor('secondaryText'),
                            paddingTop: 15
                        }}
                    >
                        {localeString('views.ImportAccount.externalAddrs')}
                    </Text>
                    <Text
                        style={{
                            fontFamily: 'PPNeueMontreal-Medium',
                            color: themeColor('text'),
                            paddingTop: 15,
                            paddingBottom: 15
                        }}
                    >
                        {dry_run_external_addrs.join(', ')}
                    </Text>

                    <Text
                        style={{
                            fontFamily: 'PPNeueMontreal-Medium',
                            color: themeColor('secondaryText')
                        }}
                    >
                        {localeString('views.ImportAccount.internalAddrs')}
                    </Text>
                    <Text
                        style={{
                            fontFamily: 'PPNeueMontreal-Medium',
                            color: themeColor('text'),
                            paddingTop: 15,
                            paddingBottom: 15
                        }}
                    >
                        {dry_run_internal_addrs.join(', ')}
                    </Text>
                </ScrollView>
                <View style={{ bottom: 10 }}>
                    <View style={styles.button}>
                        <Button
                            title={localeString(
                                'views.ImportAccount.importAccount'
                            )}
                            onPress={() =>
                                UTXOsStore.importAccount({
                                    name,
                                    extended_public_key,
                                    master_key_fingerprint,
                                    address_type,
                                    dry_run: false
                                }).then(() => navigation.popTo('Wallet'))
                            }
                        />
                    </View>
                </View>
            </Screen>
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
    button: {
        paddingTop: 10,
        paddingBottom: 10,
        width: '100%',
        alignSelf: 'center'
    },
    clipboardImport: {
        padding: 10,
        backgroundColor: 'rgba(92, 99,216, 1)',
        color: 'white'
    }
});
