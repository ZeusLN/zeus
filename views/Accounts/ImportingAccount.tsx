import * as React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Header, Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import Button from './../../components/Button';
import CollapsedQR from './../../components/CollapsedQR';
import {
    SuccessMessage,
    ErrorMessage
} from './../../components/SuccessErrorMessage';
import KeyValue from './../../components/KeyValue';

import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';

interface ImportingAccountProps {
    exitSetup: any;
    navigation: any;
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
                    backgroundColor={themeColor('background')}
                    containerStyle={{
                        borderBottomWidth: 0
                    }}
                />
                <View style={styles.content}>
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
                            value={master_key_fingerprint}
                        />
                    )}

                    <KeyValue
                        keyValue={localeString(
                            'views.ImportAccount.addressType'
                        )}
                        value={address_type}
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

                    <KeyValue
                        keyValue={localeString(
                            'views.ImportAccount.externalAddrs'
                        )}
                        value={dry_run_external_addrs.join(', ')}
                    />

                    <KeyValue
                        keyValue={localeString(
                            'views.ImportAccount.internalAddrs'
                        )}
                        value={dry_run_internal_addrs.join(', ')}
                    />

                    <Text
                        style={{
                            color: themeColor('text'),
                            marginTop: 20,
                            alignSelf: 'center'
                        }}
                    >
                        Verification Address
                    </Text>
                    <CollapsedQR value={dry_run_external_addrs[0]} />

                    <View style={styles.button}>
                        <Button
                            title="Import Account"
                            onPress={() =>
                                UTXOsStore.importAccount({
                                    name,
                                    extended_public_key,
                                    master_key_fingerprint,
                                    address_type,
                                    dry_run: false
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
