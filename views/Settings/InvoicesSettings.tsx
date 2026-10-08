import * as React from 'react';
import { StyleSheet, TouchableOpacity, ScrollView, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import _map from 'lodash/map';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import DropdownSetting from '../../components/DropdownSetting';
import Header from '../../components/Header';
import ModalBox from '../../components/ModalBox';
import { Row } from '../../components/layout/Row';
import Screen from '../../components/Screen';
import Switch from '../../components/Switch';
import Text from '../../components/Text';
import TextInput from '../../components/TextInput';
import { Spacer } from '../../components/layout/Spacer';

import SettingsStore, {
    TIME_PERIOD_KEYS,
    DEFAULT_INVOICE_TYPE_KEYS,
    DefaultInvoiceType
} from '../../stores/SettingsStore';

import BackendUtils from '../../utils/BackendUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import { TimePeriod, expirySecondsFromInput } from '../../utils/ExpiryUtils';

import Gear from '../../assets/images/SVG/Gear.svg';

interface InvoicesSettingsProps {
    navigation: NativeStackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
}

interface InvoicesSettingsState {
    addressType: string;
    memo: string;
    receiverName: string;
    expiry: string;
    timePeriod: string;
    expirySeconds: string;
    routeHints: boolean;
    ampInvoice: boolean;
    blindedPaths: boolean;
    showCustomPreimageField: boolean;
    defaultInvoiceType: DefaultInvoiceType;
}

@inject('SettingsStore')
@observer
export default class InvoicesSettings extends React.Component<
    InvoicesSettingsProps,
    InvoicesSettingsState
> {
    state = {
        addressType: '0',
        memo: '',
        receiverName: '',
        expiry: '1',
        timePeriod: 'Hours',
        expirySeconds: '3600',
        routeHints: false,
        ampInvoice: false,
        blindedPaths: false,
        showCustomPreimageField: false,
        defaultInvoiceType: DefaultInvoiceType.Lightning
    };

    async componentDidMount() {
        const { SettingsStore } = this.props;
        const { getSettings } = SettingsStore;
        const settings = await getSettings();

        this.setState({
            addressType: settings?.invoices?.addressType || '0',
            memo: settings?.invoices?.memo || '',
            receiverName: settings?.invoices?.receiverName || '',
            expiry: settings?.invoices?.expiry || '1',
            timePeriod: settings?.invoices?.timePeriod || 'Hours',
            expirySeconds: settings?.invoices?.expirySeconds || '3600',
            routeHints: settings?.invoices?.routeHints || false,
            ampInvoice: settings?.invoices?.ampInvoice || false,
            blindedPaths: settings?.invoices?.blindedPaths || false,
            showCustomPreimageField:
                settings?.invoices?.showCustomPreimageField || false,
            defaultInvoiceType:
                settings?.invoices?.defaultInvoiceType ||
                DefaultInvoiceType.Lightning
        });
    }

    componentWillUnmount() {
        // Persist a memo, name or expiry typed just before leaving
        this.props.SettingsStore.flushPendingSettings();
    }

    renderSeparator = () => (
        <View
            style={{
                height: 1,
                backgroundColor: themeColor('separator')
            }}
        />
    );

    private modalBoxRef = React.createRef<ModalBox>();

    render() {
        const { navigation, SettingsStore } = this.props;
        const {
            addressType,
            memo,
            receiverName,
            expiry,
            timePeriod,
            routeHints,
            ampInvoice,
            blindedPaths,
            showCustomPreimageField,
            defaultInvoiceType
        } = this.state;
        const { updateSettingsGroup, updateSettingsGroupDebounced } =
            SettingsStore;

        const ADDRESS_TYPES = [];

        if (BackendUtils.supportsNestedSegWit()) {
            ADDRESS_TYPES.push({
                key: localeString('views.Receive.np2wkhKey'),
                value: '1',
                description: BackendUtils.supportsTaproot()
                    ? localeString('views.Receive.np2wkhDescription')
                    : localeString('views.Receive.np2wkhDescriptionAlt')
            });
        }

        ADDRESS_TYPES.push({
            key: localeString('views.Receive.p2wkhKey'),
            value: '0',
            description: localeString('views.Receive.p2wkhDescription')
        });

        if (BackendUtils.supportsTaproot()) {
            ADDRESS_TYPES.push({
                key: localeString('views.Receive.p2trKey'),
                value: '4',
                description: localeString('views.Receive.p2trDescription')
            });
        }

        const SettingsButton = () => (
            <TouchableOpacity onPress={() => this.modalBoxRef.current?.open()}>
                <Gear
                    style={{ alignSelf: 'center' }}
                    fill={themeColor('text')}
                />
            </TouchableOpacity>
        );

        const baseModalHeight = 300;
        const itemHeight = ADDRESS_TYPES.length <= 2 ? 25 : 50;
        const modalHeight = baseModalHeight + ADDRESS_TYPES.length * itemHeight;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Settings.Invoices.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={
                        BackendUtils.supportsAddressTypeSelection() && (
                            <SettingsButton />
                        )
                    }
                    navigation={navigation}
                />
                <ScrollView
                    style={{
                        paddingHorizontal: 15,
                        marginTop: 5
                    }}
                >
                    <>
                        <Text
                            style={{
                                ...styles.secondaryText,
                                color: themeColor('secondaryText')
                            }}
                            infoModalText={localeString(
                                'views.Settings.Invoices.memoExplainer'
                            )}
                        >
                            {localeString('views.Receive.memo')}
                        </Text>
                        <TextInput
                            placeholder={localeString(
                                'views.Receive.memoPlaceholder'
                            )}
                            value={memo}
                            onChangeText={(text: string) => {
                                this.setState({ memo: text });
                                updateSettingsGroupDebounced('invoices', {
                                    memo: text
                                });
                            }}
                        />
                    </>

                    <>
                        <Text
                            style={{
                                ...styles.secondaryText,
                                color: themeColor('secondaryText')
                            }}
                            infoModalText={localeString(
                                'views.Settings.Invoices.receiverNameExplainer'
                            )}
                        >
                            {localeString('views.Invoice.receiverName')}
                        </Text>
                        <TextInput
                            placeholder="Satoshi"
                            value={receiverName}
                            onChangeText={(text: string) => {
                                this.setState({ receiverName: text });
                                updateSettingsGroupDebounced('invoices', {
                                    receiverName: text
                                });
                            }}
                        />
                    </>

                    {BackendUtils.supportsOnchainReceiving() && (
                        <>
                            <Text
                                style={{
                                    ...styles.secondaryText,
                                    color: themeColor('secondaryText'),
                                    paddingTop: 10
                                }}
                                infoModalText={localeString(
                                    'views.Settings.Invoices.defaultInvoiceType.explainer'
                                )}
                            >
                                {localeString(
                                    'views.Settings.Invoices.defaultInvoiceType'
                                )}
                            </Text>
                            <DropdownSetting
                                selectedValue={defaultInvoiceType}
                                values={DEFAULT_INVOICE_TYPE_KEYS}
                                onValueChange={async (value: string) => {
                                    this.setState({
                                        defaultInvoiceType:
                                            value as DefaultInvoiceType
                                    });
                                    await updateSettingsGroup('invoices', {
                                        defaultInvoiceType:
                                            value as DefaultInvoiceType
                                    });
                                }}
                            />
                        </>
                    )}

                    {BackendUtils.supportsSettingInvoiceExpiration() && (
                        <>
                            <Text
                                style={{
                                    ...styles.secondaryText,
                                    color: themeColor('secondaryText'),
                                    paddingTop: 10
                                }}
                            >
                                {localeString('views.Receive.expiration')}
                            </Text>
                            <Row style={{ width: '100%' }}>
                                <TextInput
                                    keyboardType="numeric"
                                    value={expiry}
                                    style={{
                                        width: '58%'
                                    }}
                                    onChangeText={(text: string) => {
                                        const digits = text.replace(
                                            /[^0-9]/g,
                                            ''
                                        );
                                        const expirySeconds =
                                            expirySecondsFromInput(
                                                digits,
                                                timePeriod as TimePeriod
                                            );

                                        this.setState({
                                            expiry: digits,
                                            expirySeconds
                                        });
                                        if (digits && Number(digits) > 0) {
                                            updateSettingsGroupDebounced(
                                                'invoices',
                                                {
                                                    expiry: digits,
                                                    expirySeconds
                                                }
                                            );
                                        }
                                    }}
                                />
                                <Spacer width={4} />
                                <View
                                    style={{
                                        flex: 1
                                    }}
                                >
                                    <DropdownSetting
                                        selectedValue={timePeriod}
                                        values={TIME_PERIOD_KEYS}
                                        onValueChange={async (
                                            value: string
                                        ) => {
                                            const expirySeconds =
                                                expirySecondsFromInput(
                                                    expiry,
                                                    value as TimePeriod
                                                );

                                            this.setState({
                                                timePeriod: value,
                                                expirySeconds
                                            });

                                            await updateSettingsGroup(
                                                'invoices',
                                                {
                                                    timePeriod: value,
                                                    expirySeconds
                                                }
                                            );
                                        }}
                                    />
                                </View>
                            </Row>
                        </>
                    )}

                    {BackendUtils.isLNDBased() && (
                        <View
                            style={{
                                flexDirection: 'row',
                                marginTop: 20
                            }}
                        >
                            <View style={{ flex: 1 }}>
                                <Text
                                    style={{
                                        ...styles.secondaryText,
                                        color: themeColor('secondaryText')
                                    }}
                                    infoModalText={[
                                        localeString(
                                            'views.Receive.routeHintSwitchExplainer1'
                                        ),
                                        localeString(
                                            'views.Receive.routeHintSwitchExplainer2'
                                        )
                                    ]}
                                >
                                    {localeString('views.Receive.routeHints')}
                                </Text>
                            </View>
                            <View
                                style={{ alignSelf: 'center', marginLeft: 5 }}
                            >
                                <Switch
                                    value={routeHints}
                                    onValueChange={async (value: boolean) => {
                                        this.setState({
                                            routeHints: value
                                        });
                                        await updateSettingsGroup('invoices', {
                                            routeHints: value
                                        });
                                    }}
                                    disabled={blindedPaths}
                                />
                            </View>
                        </View>
                    )}

                    {BackendUtils.supportsAMP() && (
                        <View
                            style={{
                                flexDirection: 'row',
                                marginTop: 20
                            }}
                        >
                            <View style={{ flex: 1 }}>
                                <Text
                                    style={{
                                        ...styles.secondaryText,
                                        color: themeColor('secondaryText')
                                    }}
                                    infoModalText={[
                                        localeString(
                                            'views.Receive.ampSwitchExplainer1'
                                        ),
                                        localeString(
                                            'views.Receive.ampSwitchExplainer2'
                                        )
                                    ]}
                                    infoModalLink="https://docs.lightning.engineering/lightning-network-tools/lnd/amp"
                                >
                                    {localeString('views.Receive.ampInvoice')}
                                </Text>
                            </View>
                            <View
                                style={{ alignSelf: 'center', marginLeft: 5 }}
                            >
                                <Switch
                                    value={ampInvoice}
                                    onValueChange={async (value: boolean) => {
                                        this.setState({
                                            ampInvoice: value
                                        });
                                        await updateSettingsGroup('invoices', {
                                            ampInvoice: value
                                        });
                                    }}
                                    disabled={blindedPaths}
                                />
                            </View>
                        </View>
                    )}

                    {BackendUtils.supportsBolt11BlindedRoutes() && (
                        <View
                            style={{
                                flexDirection: 'row',
                                marginTop: 20
                            }}
                        >
                            <View style={{ flex: 1 }}>
                                <Text
                                    style={{
                                        ...styles.secondaryText,
                                        color: themeColor('secondaryText')
                                    }}
                                    infoModalText={[
                                        localeString(
                                            'views.Receive.blindedPathsExplainer1'
                                        ),
                                        localeString(
                                            'views.Receive.blindedPathsExplainer2'
                                        )
                                    ]}
                                >
                                    {localeString('views.Receive.blindedPaths')}
                                </Text>
                            </View>
                            <View
                                style={{ alignSelf: 'center', marginLeft: 5 }}
                            >
                                <Switch
                                    value={blindedPaths}
                                    onValueChange={async (value: boolean) => {
                                        this.setState({
                                            blindedPaths: value,
                                            ampInvoice: false,
                                            routeHints: false
                                        });

                                        await updateSettingsGroup('invoices', {
                                            blindedPaths: value,
                                            routeHints: false,
                                            ampInvoice: false
                                        });
                                    }}
                                />
                            </View>
                        </View>
                    )}

                    {BackendUtils.supportsCustomPreimages() && (
                        <View
                            style={{
                                flexDirection: 'row',
                                marginTop: 20
                            }}
                        >
                            <View style={{ flex: 1 }}>
                                <Text
                                    style={{
                                        ...styles.secondaryText,
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.Invoices.showCustomPreimageField'
                                    )}
                                    {}
                                </Text>
                            </View>
                            <View
                                style={{ alignSelf: 'center', marginLeft: 5 }}
                            >
                                <Switch
                                    value={showCustomPreimageField}
                                    onValueChange={async (value: boolean) => {
                                        this.setState({
                                            showCustomPreimageField: value
                                        });
                                        await updateSettingsGroup('invoices', {
                                            showCustomPreimageField: value
                                        });
                                    }}
                                />
                            </View>
                        </View>
                    )}
                </ScrollView>
                <ModalBox
                    style={{
                        backgroundColor: themeColor('modalBackground'),
                        borderTopLeftRadius: 20,
                        borderTopRightRadius: 20,
                        height: modalHeight,
                        paddingLeft: 24,
                        paddingRight: 24
                    }}
                    swipeToClose={true}
                    backButtonClose={true}
                    position="bottom"
                    ref={this.modalBoxRef}
                >
                    <ScrollView>
                        <Text
                            style={{
                                color: themeColor('text'),
                                fontSize: 24,
                                fontWeight: 'bold',
                                paddingTop: 24,
                                paddingBottom: 24
                            }}
                        >
                            {localeString('views.Receive.addressType')}
                        </Text>
                        {_map(ADDRESS_TYPES, (d, index) => (
                            <TouchableOpacity
                                key={index}
                                onPress={async () => {
                                    // If same address type is selected, close modal
                                    if (d.value === addressType) {
                                        this.modalBoxRef.current?.close();
                                        return;
                                    }
                                    this.setState({ addressType: d.value });
                                    await updateSettingsGroup('invoices', {
                                        addressType: d.value
                                    });
                                    this.modalBoxRef.current?.close();
                                }}
                                style={{
                                    backgroundColor: themeColor('secondary'),
                                    borderColor:
                                        d.value === addressType
                                            ? themeColor('highlight')
                                            : themeColor('secondaryText'),
                                    borderRadius: 4,
                                    borderWidth:
                                        d.value === addressType ? 2 : 1,
                                    padding: 16,
                                    marginBottom: 24
                                }}
                            >
                                <Text
                                    style={{
                                        color: themeColor('text'),
                                        fontSize: 16,
                                        fontWeight: 'bold',
                                        marginBottom: 4
                                    }}
                                >
                                    {d.key}
                                </Text>
                                <Text
                                    style={{
                                        color: themeColor('text'),
                                        fontSize: 16,
                                        fontWeight: 'normal'
                                    }}
                                >
                                    {d.description}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </ModalBox>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    secondaryText: {
        fontFamily: 'PPNeueMontreal-Book'
    }
});
