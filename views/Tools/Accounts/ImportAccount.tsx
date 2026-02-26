import * as React from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ListItem } from '@rneui/themed';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import Button from '../../../components/Button';
import DropdownSetting from '../../../components/DropdownSetting';
import Header from '../../../components/Header';
import Screen from '../../../components/Screen';
import Switch from '../../../components/Switch';
import TextInput from '../../../components/TextInput';
import { ErrorMessage } from '../../../components/SuccessErrorMessage';

import UTXOsStore from '../../../stores/UTXOsStore';
import NodeInfoStore from '../../../stores/NodeInfoStore';
import SettingsStore from '../../../stores/SettingsStore';

import Base64Utils from '../../../utils/Base64Utils';
import { localeString } from '../../../utils/LocaleUtils';
import { themeColor } from '../../../utils/ThemeUtils';

import Scan from '../../../assets/images/SVG/Scan.svg';

import { walletrpc } from '../../../proto/lightning';

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
    navigation: StackNavigationProp<any, any>;
    UTXOsStore: UTXOsStore;
    SettingsStore: SettingsStore;
    NodeInfoStore: NodeInfoStore;
    route: Route<
        'ImportAccount',
        {
            name: string;
            extended_public_key: string;
            master_key_fingerprint: string;
            address_type: number;
        }
    >;
}

interface ImportAccountState {
    name: string;
    extended_public_key: string;
    master_key_fingerprint: string;
    address_type: number;
    existing_account: boolean;
    block_height: number;
    addresses_to_generate: number;
    understood: boolean;
}

@inject('UTXOsStore', 'SettingsStore', 'NodeInfoStore')
@observer
export default class ImportAccount extends React.Component<
    ImportAccountProps,
    ImportAccountState
> {
    constructor(props: ImportAccountProps) {
        super(props);
        this.state = {
            name: '',
            extended_public_key: '',
            master_key_fingerprint: '',
            address_type: walletrpc.AddressType.WITNESS_PUBKEY_HASH,
            existing_account: false,
            block_height: 800000,
            addresses_to_generate: 50,
            understood: false
        };
    }

    handleParams = (props: ImportAccountProps) => {
        const { NodeInfoStore } = props;
        const {
            name,
            extended_public_key,
            master_key_fingerprint,
            address_type
        } = props.route.params ?? {};

        if (name) {
            this.setState({ name });
        }

        if (extended_public_key) {
            this.setState({ extended_public_key });
        }

        if (master_key_fingerprint) {
            this.setState({ master_key_fingerprint });
        }

        if (address_type) {
            this.setState({ address_type });
        }

        if (NodeInfoStore?.nodeInfo?.currentBlockHeight) {
            this.setState({
                block_height: NodeInfoStore?.nodeInfo?.currentBlockHeight
            });
        }
    };

    componentDidMount() {
        this.handleParams(this.props);
    }

    componentDidUpdate(prevProps: ImportAccountProps) {
        // Use deep comparison instead of reference equality to catch param changes
        // Reference equality can fail in production when React Navigation reuses object references
        const currentParams = this.props.route.params ?? {};
        const prevParams = prevProps.route.params ?? {};

        // Check if any of the relevant params have changed
        if (
            currentParams.name !== prevParams.name ||
            currentParams.extended_public_key !==
                prevParams.extended_public_key ||
            currentParams.master_key_fingerprint !==
                prevParams.master_key_fingerprint ||
            currentParams.address_type !== prevParams.address_type
        ) {
            this.handleParams(this.props);
        }
    }

    render() {
        const { navigation, UTXOsStore, SettingsStore } = this.props;
        const {
            name,
            extended_public_key,
            master_key_fingerprint,
            address_type,
            existing_account,
            block_height,
            addresses_to_generate,
            understood
        } = this.state;
        const { errorMsg } = UTXOsStore;
        const { implementation } = SettingsStore;

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

        if (!understood) {
            return (
                <SafeAreaView
                    style={{
                        flex: 1,
                        backgroundColor: themeColor('background')
                    }}
                    edges={['top', 'bottom']}
                >
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <View style={{ marginHorizontal: 10 }}>
                            <ErrorMessage
                                message={localeString(
                                    'general.warning'
                                ).toUpperCase()}
                            />
                        </View>
                        <Text
                            style={{
                                ...styles.warningText,
                                color: themeColor('text')
                            }}
                        >
                            {localeString('views.ImportAccount.Warning.text1')}
                        </Text>
                        <Text
                            style={{
                                ...styles.warningText,
                                color: themeColor('text')
                            }}
                        >
                            {localeString('views.ImportAccount.Warning.text2')}
                        </Text>
                        <Text
                            style={{
                                ...styles.warningText,
                                color: themeColor('text')
                            }}
                        >
                            {localeString(
                                'views.ImportAccount.Warning.text3'
                            ).replace('Zeus', 'ZEUS')}
                        </Text>
                        {implementation !== 'embedded-lnd' && (
                            <Text
                                style={{
                                    ...styles.warningText,
                                    color: themeColor('text')
                                }}
                            >
                                {localeString(
                                    'views.ImportAccount.note'
                                ).replace('Zeus', 'ZEUS')}
                            </Text>
                        )}
                    </ScrollView>
                    <View style={{ paddingVertical: 10 }}>
                        <Button
                            onPress={() => this.setState({ understood: true })}
                            title={localeString('general.iUnderstand')}
                        />
                    </View>
                </SafeAreaView>
            );
        }

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
                    <ScrollView
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        {errorMsg && (
                            <ErrorMessage message={errorMsg} dismissable />
                        )}
                        <Text
                            style={{
                                ...styles.label,
                                color: themeColor('secondaryText')
                            }}
                        >
                            {localeString('general.accountName')}
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
                            onValueChange={async (
                                value: keyof typeof walletrpc.AddressType
                            ) => {
                                this.setState({
                                    address_type: walletrpc.AddressType[value]
                                });
                            }}
                            values={AddressTypes}
                        />
                        <ListItem
                            containerStyle={{
                                borderBottomWidth: 0,
                                backgroundColor: 'transparent'
                            }}
                        >
                            <ListItem.Title
                                style={{
                                    color: themeColor('secondaryText'),
                                    fontFamily: 'PPNeueMontreal-Book',
                                    left: -10
                                }}
                            >
                                {localeString(
                                    'views.ImportAccount.existingAccount'
                                )}
                            </ListItem.Title>
                            <View
                                style={{
                                    flex: 1,
                                    flexDirection: 'row',
                                    justifyContent: 'flex-end'
                                }}
                            >
                                <Switch
                                    value={existing_account}
                                    onValueChange={(value: boolean) => {
                                        this.setState({
                                            existing_account: value
                                        });
                                    }}
                                />
                            </View>
                        </ListItem>
                        {existing_account && (
                            <>
                                <Text
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontFamily: 'PPNeueMontreal-Book',
                                        marginBottom: 10
                                    }}
                                >
                                    {localeString(
                                        'general.experimental'
                                    ).toUpperCase()}
                                </Text>
                                <Text
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontFamily: 'PPNeueMontreal-Book',
                                        marginBottom: 10
                                    }}
                                >
                                    {localeString(
                                        'views.ImportAccount.existingAccountNote'
                                    )}
                                    .
                                </Text>
                                <Text
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontFamily: 'PPNeueMontreal-Book',
                                        marginBottom: 10
                                    }}
                                >
                                    {localeString(
                                        'views.ImportAccount.existingAccountNote2'
                                    )}
                                </Text>
                                <>
                                    <Text
                                        style={{
                                            ...styles.label,
                                            color: themeColor('secondaryText')
                                        }}
                                    >
                                        {localeString(
                                            'views.NodeInfo.blockHeight'
                                        )}
                                    </Text>
                                    <TextInput
                                        value={block_height.toString()}
                                        onChangeText={(text: string) => {
                                            const block_height = Number(text);
                                            if (isNaN(block_height)) return;
                                            this.setState({
                                                block_height
                                            });
                                        }}
                                        keyboardType="numeric"
                                    />
                                </>
                                <>
                                    <Text
                                        style={{
                                            ...styles.label,
                                            color: themeColor('secondaryText')
                                        }}
                                    >
                                        {localeString(
                                            'views.ImportAccount.addressesToGenerate'
                                        )}
                                    </Text>
                                    <TextInput
                                        value={addresses_to_generate.toString()}
                                        onChangeText={(text: string) => {
                                            const addresses_to_generate =
                                                Number(text);
                                            if (isNaN(addresses_to_generate))
                                                return;
                                            this.setState({
                                                addresses_to_generate
                                            });
                                        }}
                                        keyboardType="numeric"
                                    />
                                </>
                            </>
                        )}
                    </ScrollView>
                </View>
                <View style={{ bottom: 10 }}>
                    <Button
                        title={localeString(
                            'views.ImportAccount.importAccount'
                        )}
                        onPress={() =>
                            this.props.UTXOsStore.importAccount({
                                name,
                                extended_public_key,
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
                                dry_run: true,
                                birthday_height: existing_account
                                    ? block_height
                                    : undefined,
                                addresses_to_generate: existing_account
                                    ? addresses_to_generate
                                    : undefined
                            }).then((response: any) => {
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
    warningText: {
        fontFamily: 'PPNeueMontreal-Book',
        margin: 10,
        fontSize: 20
    },
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
