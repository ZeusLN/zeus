import * as React from 'react';
import { StyleSheet, TouchableOpacity, ScrollView, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import BigNumber from 'bignumber.js';
import _map from 'lodash/map';
import { StackNavigationProp } from '@react-navigation/stack';

import DropdownSetting from '../../components/DropdownSetting';
import Header from '../../components/Header';
import ModalBox from '../../components/ModalBox';
import { Row } from '../../components/layout/Row';
import Screen from '../../components/Screen';
import Switch from '../../components/Switch';
import Text from '../../components/Text';
import TextInput from '../../components/TextInput';

import SettingsStore, { TIME_PERIOD_KEYS } from '../../stores/SettingsStore';

import BackendUtils from '../../utils/BackendUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import Gear from '../../assets/images/SVG/Gear.svg';

interface InvoicesSettingsProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
}

interface InvoicesSettingsState {
    addressType: string;
    memo: string;
    expiry: string;
    timePeriod: string;
    expirySeconds: string;
    routeHints: boolean;
    ampInvoice: boolean;
    blindedPaths: boolean;
    showCustomPreimageField: boolean;
    displayAmountOnInvoice: boolean;
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
        expiry: '3600',
        timePeriod: 'Seconds',
        expirySeconds: '3600',
        routeHints: false,
        ampInvoice: false,
        blindedPaths: false,
        showCustomPreimageField: false,
        displayAmountOnInvoice: false
    };

    async UNSAFE_componentWillMount() {
        const { SettingsStore } = this.props;
        const { getSettings } = SettingsStore;
        const settings = await getSettings();

        this.setState({
            addressType: settings?.invoices?.addressType || '0',
            memo: settings?.invoices?.memo || '',
            expiry: settings?.invoices?.expiry || '3600',
            timePeriod: settings?.invoices?.timePeriod || 'Seconds',
            expirySeconds: settings?.invoices?.expirySeconds || '3600',
            routeHints: settings?.invoices?.routeHints || false,
            ampInvoice: settings?.invoices?.ampInvoice || false,
            blindedPaths: settings?.invoices?.blindedPaths || false,
            showCustomPreimageField:
                settings?.invoices?.showCustomPreimageField || false,
            displayAmountOnInvoice:
                settings?.invoices?.displayAmountOnInvoice || false
        });
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
            expiry,
            timePeriod,
            routeHints,
            ampInvoice,
            blindedPaths,
            showCustomPreimageField,
            displayAmountOnInvoice
        } = this.state;
        const { implementation, settings, updateSettings }: any = SettingsStore;

        const ADDRESS_TYPES = BackendUtils.supportsTaproot()
            ? [
                  {
                      key: localeString('views.Receive.np2wkhKey'),
                      value: '1',
                      description: localeString(
                          'views.Receive.np2wkhDescription'
                      )
                  },
                  {
                      key: localeString('views.Receive.p2wkhKey'),
                      value: '0',
                      description: localeString(
                          'views.Receive.p2wkhDescription'
                      )
                  },
                  {
                      key: localeString('views.Receive.p2trKey'),
                      value: '4',
                      description: localeString('views.Receive.p2trDescription')
                  }
              ]
            : [
                  {
                      key: localeString('views.Receive.np2wkhKey'),
                      value: '1',
                      description: localeString(
                          'views.Receive.np2wkhDescriptionAlt'
                      )
                  },
                  {
                      key: localeString('views.Receive.p2wkhKey'),
                      value: '0',
                      description: localeString(
                          'views.Receive.p2wkhDescription'
                      )
                  }
              ];

        const SettingsButton = () => (
            <TouchableOpacity onPress={() => this.modalBoxRef.current?.open()}>
                <Gear
                    style={{ alignSelf: 'center' }}
                    fill={themeColor('text')}
                />
            </TouchableOpacity>
        );

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
                    <Text
                        style={{
                            ...styles.secondaryText,
                            color: themeColor('secondaryText')
                        }}
                    >
                        {localeString('views.Receive.memo')}
                    </Text>
                    <TextInput
                        placeholder={localeString(
                            'views.Receive.memoPlaceholder'
                        )}
                        value={memo}
                        onChangeText={async (text: string) => {
                            this.setState({ memo: text });
                            await updateSettings({
                                invoices: {
                                    ...settings.invoices,
                                    memo: text
                                }
                            });
                        }}
                    />

                    {implementation !== 'lndhub' && (
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
                                    onChangeText={async (text: string) => {
                                        let expirySeconds = '3600';
                                        if (timePeriod === 'Seconds') {
                                            expirySeconds = text;
                                        } else if (timePeriod === 'Minutes') {
                                            expirySeconds = new BigNumber(text)
                                                .multipliedBy(60)
                                                .toString();
                                        } else if (timePeriod === 'Hours') {
                                            expirySeconds = new BigNumber(text)
                                                .multipliedBy(60 * 60)
                                                .toString();
                                        } else if (timePeriod === 'Days') {
                                            expirySeconds = new BigNumber(text)
                                                .multipliedBy(60 * 60 * 24)
                                                .toString();
                                        } else if (timePeriod === 'Weeks') {
                                            expirySeconds = new BigNumber(text)
                                                .multipliedBy(60 * 60 * 24 * 7)
                                                .toString();
                                        }

                                        this.setState({
                                            expiry: text,
                                            expirySeconds
                                        });
                                        await updateSettings({
                                            invoices: {
                                                ...settings.invoices,
                                                expiry: text,
                                                expirySeconds
                                            }
                                        });
                                    }}
                                />
                                <View
                                    style={{
                                        flex: 1,
                                        // TODO
                                        top: -5
                                    }}
                                >
                                    <DropdownSetting
                                        selectedValue={timePeriod}
                                        values={TIME_PERIOD_KEYS}
                                        disabled={
                                            SettingsStore.settingsUpdateInProgress
                                        }
                                        onValueChange={async (
                                            value: string
                                        ) => {
                                            let expirySeconds;
                                            if (value === 'Seconds') {
                                                expirySeconds = expiry;
                                            } else if (value === 'Minutes') {
                                                expirySeconds = new BigNumber(
                                                    expiry
                                                )
                                                    .multipliedBy(60)
                                                    .toString();
                                            } else if (value === 'Hours') {
                                                expirySeconds = new BigNumber(
                                                    expiry
                                                )
                                                    .multipliedBy(60 * 60)
                                                    .toString();
                                            } else if (value === 'Days') {
                                                expirySeconds = new BigNumber(
                                                    expiry
                                                )
                                                    .multipliedBy(60 * 60 * 24)
                                                    .toString();
                                            } else if (value === 'Weeks') {
                                                expirySeconds = new BigNumber(
                                                    expiry
                                                )
                                                    .multipliedBy(
                                                        60 * 60 * 24 * 7
                                                    )
                                                    .toString();
                                            }

                                            this.setState({
                                                timePeriod: value,
                                                expirySeconds: expirySeconds
                                                    ? expirySeconds
                                                    : ''
                                            });

                                            await updateSettings({
                                                invoices: {
                                                    ...settings.invoices,
                                                    timePeriod: value,
                                                    expirySeconds
                                                }
                                            });
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
                                    onValueChange={async () => {
                                        this.setState({
                                            routeHints: !routeHints
                                        });
                                        await updateSettings({
                                            invoices: {
                                                ...settings.invoices,
                                                routeHints: !routeHints
                                            }
                                        });
                                    }}
                                    disabled={
                                        blindedPaths ||
                                        SettingsStore.settingsUpdateInProgress
                                    }
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
                                    onValueChange={async () => {
                                        this.setState({
                                            ampInvoice: !ampInvoice
                                        });
                                        await updateSettings({
                                            invoices: {
                                                ...settings.invoices,
                                                ampInvoice: !ampInvoice
                                            }
                                        });
                                    }}
                                    disabled={
                                        blindedPaths ||
                                        SettingsStore.settingsUpdateInProgress
                                    }
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
                                    disabled={
                                        SettingsStore.settingsUpdateInProgress
                                    }
                                    onValueChange={async () => {
                                        this.setState({
                                            blindedPaths: !blindedPaths,
                                            ampInvoice: false,
                                            routeHints: false
                                        });

                                        await updateSettings({
                                            invoices: {
                                                ...settings.invoices,
                                                blindedPaths: !blindedPaths,
                                                routeHints: false,
                                                ampInvoice: false
                                            }
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
                                    disabled={
                                        SettingsStore.settingsUpdateInProgress
                                    }
                                    onValueChange={async () => {
                                        this.setState({
                                            showCustomPreimageField:
                                                !showCustomPreimageField
                                        });
                                        await updateSettings({
                                            invoices: {
                                                ...settings.invoices,
                                                showCustomPreimageField:
                                                    !showCustomPreimageField
                                            }
                                        });
                                    }}
                                />
                            </View>
                        </View>
                    )}

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
                                    'views.Settings.Invoices.displayAmountOnInvoice'
                                )}
                                {}
                            </Text>
                        </View>
                        <View style={{ alignSelf: 'center', marginLeft: 5 }}>
                            <Switch
                                value={displayAmountOnInvoice}
                                disabled={
                                    SettingsStore.settingsUpdateInProgress
                                }
                                onValueChange={async () => {
                                    this.setState({
                                        displayAmountOnInvoice:
                                            !displayAmountOnInvoice
                                    });
                                    await updateSettings({
                                        invoices: {
                                            ...settings.invoices,
                                            displayAmountOnInvoice:
                                                !displayAmountOnInvoice
                                        }
                                    });
                                }}
                            />
                        </View>
                    </View>
                </ScrollView>
                <ModalBox
                    style={{
                        backgroundColor: themeColor('background'),
                        borderTopLeftRadius: 20,
                        borderTopRightRadius: 20,
                        height: BackendUtils.supportsTaproot() ? 450 : 350,
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
                                    await updateSettings({
                                        invoices: {
                                            ...settings.invoices,
                                            addressType: d.value
                                        }
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
