import * as React from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { inject, observer } from 'mobx-react';

import Button from '../../components/Button';
import DropdownSetting from '../../components/DropdownSetting';
import Header from '../../components/Header';
import Screen from '../../components/Screen';
import TextInput from '../../components/TextInput';
import { ErrorMessage } from '../../components/SuccessErrorMessage';

import UTXOsStore from '../../stores/UTXOsStore';

import Base64Utils from '../../utils/Base64Utils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import Scan from '../../assets/images/SVG/Scan.svg';

import { walletrpc } from '../../proto/lightning';

const AddressTypes = [
    { key: 'Unknown', value: 'UNKNOWN' },
    { key: 'Witness pubkey hash', value: 'WITNESS_PUBKEY_HASH' },
    { key: 'Nested witness pubkey hash', value: 'NESTED_WITNESS_PUBKEY_HASH' },
    {
        key: 'Hybrid nested witness pubkey hash',
        value: 'HYBRID_NESTED_WITNESS_PUBKEY_HASH'
    },
    { key: 'Taproot pubkey', value: 'TAPROOT_PUBKEY' }
];

interface ImportAccountProps {
    exitSetup: any;
    navigation: any;
    UTXOsStore: UTXOsStore;
}

interface ImportAccountState {
    name: string;
    extended_public_key: string;
    master_key_fingerprint: string;
    address_type: number;
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
            address_type: walletrpc.AddressType.WITNESS_PUBKEY_HASH
        };
    }

    UNSAFE_componentWillMount = () => {
        const { navigation } = this.props;

        const extended_public_key = navigation.getParam('extended_public_key');
        if (extended_public_key) {
            this.setState({
                extended_public_key
            });
        }

        const master_key_fingerprint = navigation.getParam(
            'master_key_fingerprint'
        );
        if (master_key_fingerprint) {
            this.setState({
                master_key_fingerprint
            });
        }

        const address_type = navigation.getParam('address_type');
        if (address_type) {
            this.setState({
                address_type
            });
        }
    };

    render() {
        const { navigation, UTXOsStore } = this.props;
        const {
            name,
            extended_public_key,
            master_key_fingerprint,
            address_type
        } = this.state;
        const { errorMsg } = UTXOsStore;

        const ScanBadge = () => (
            <TouchableOpacity
                onPress={() => navigation.navigate('HandleAnythingQRScanner')}
                accessibilityLabel={localeString('general.scan')}
            >
                <Scan
                    fill={themeColor('text')}
                    width={30}
                    height={30}
                    style={{ marginLeft: 12 }}
                />
            </TouchableOpacity>
        );

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.ImportAccount.title'),
                        style: { color: themeColor('text') }
                    }}
                    rightComponent={<ScanBadge />}
                    navigation={navigation}
                />
                <View style={styles.content}>
                    <ScrollView keyboardShouldPersistTaps="handled">
                        {errorMsg && (
                            <ErrorMessage message={errorMsg} dismissable />
                        )}
                        <Text
                            style={{
                                ...styles.label,
                                color: themeColor('secondaryText')
                            }}
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
                            style={{
                                ...styles.label,
                                color: themeColor('secondaryText')
                            }}
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
                            style={{ paddingBottom: 10 }}
                        />
                        <>
                            <Text
                                style={{
                                    ...styles.label,
                                    color: themeColor('secondaryText')
                                }}
                            >
                                {localeString(
                                    'views.ImportAccount.masterKeyFingerprint'
                                )}
                            </Text>
                            <TextInput
                                placeholder={'C13E4B30'}
                                value={master_key_fingerprint}
                                onChangeText={(text: string) =>
                                    this.setState({
                                        master_key_fingerprint: text
                                    })
                                }
                            />
                        </>
                        <DropdownSetting
                            title={localeString(
                                'views.ImportAccount.addressType'
                            )}
                            selectedValue={walletrpc.AddressType[address_type]}
                            onValueChange={async (value: string) => {
                                this.setState({
                                    address_type: walletrpc.AddressType[value]
                                });
                            }}
                            values={AddressTypes}
                        />
                    </ScrollView>
                </View>
                <View style={{ bottom: 10 }}>
                    <Text
                        style={{
                            ...styles.label,
                            color: themeColor('text'),
                            padding: 15
                        }}
                    >
                        {localeString('views.ImportAccount.note')}
                    </Text>
                    <Button
                        title={localeString(
                            'views.ImportAccount.importAccount'
                        )}
                        onPress={() =>
                            this.props.UTXOsStore.importAccount({
                                ...this.state,
                                address_type: address_type
                                    ? Number(address_type)
                                    : undefined,
                                master_key_fingerprint: master_key_fingerprint
                                    ? Base64Utils.hexToBase64(
                                          Base64Utils.reverseMfpBytes(
                                              master_key_fingerprint
                                          )
                                      )
                                    : undefined,
                                dry_run: true
                            }).then((response) => {
                                if (response)
                                    navigation.navigate('ImportingAccount');
                            })
                        }
                    />
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    content: {
        flex: 1,
        paddingTop: 20,
        paddingBottom: 20,
        paddingLeft: 10,
        paddingRight: 10
    },
    label: {
        fontFamily: 'PPNeueMontreal-Medium'
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
