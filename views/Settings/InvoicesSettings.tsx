import * as React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import _map from 'lodash/map';

import Header from '../../components/Header';
import ModalBox from '../../components/ModalBox';
import Screen from '../../components/Screen';
import Switch from '../../components/Switch';
import TextInput from '../../components/TextInput';

import SettingsStore from '../../stores/SettingsStore';

import BackendUtils from '../../utils/BackendUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

interface InvoicesSettingsProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

interface InvoicesSettingsState {
    addressType: string;
    memo: string;
    expiry: string;
    routeHints: boolean;
    ampInvoice: boolean;
    showCustomPreimageField: boolean;
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
        routeHints: false,
        ampInvoice: false,
        showCustomPreimageField: false
    };

    async UNSAFE_componentWillMount() {
        const { getSettings } = this.props.SettingsStore;
        const settings = await getSettings();

        this.setState({
            addressType: settings?.invoices?.addressType || '0',
            memo: settings?.invoices?.memo || '',
            expiry: settings?.invoices?.expiry || '3600',
            routeHints: settings?.invoices?.routeHints || false,
            ampInvoice: settings?.invoices?.ampInvoice || false,
            showCustomPreimageField:
                settings?.invoices?.showCustomPreimageField || false
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

    render() {
        const { navigation } = this.props;
        const {
            addressType,
            memo,
            expiry,
            routeHints,
            ampInvoice,
            showCustomPreimageField
        } = this.state;
        const { implementation, updateSettings }: any =
            this.props.SettingsStore;

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
            <Icon
                name="settings"
                onPress={() => this.refs.modal.open()}
                color={themeColor('text')}
                underlayColor="transparent"
                size={30}
            />
        );

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Settings.Invoices.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'Lato-Regular'
                        }
                    }}
                    rightComponent={
                        BackendUtils.supportsAddressTypeSelection() && (
                            <SettingsButton />
                        )
                    }
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
                                    addressType,
                                    memo: text,
                                    expiry,
                                    routeHints,
                                    ampInvoice,
                                    showCustomPreimageField
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
                            <TextInput
                                keyboardType="numeric"
                                placeholder={'3600 (one hour)'}
                                value={expiry}
                                onChangeText={async (text: string) => {
                                    this.setState({
                                        expiry: text
                                    });
                                    await updateSettings({
                                        invoices: {
                                            addressType,
                                            memo,
                                            expiry: text,
                                            routeHints,
                                            ampInvoice,
                                            showCustomPreimageField
                                        }
                                    });
                                }}
                            />
                        </>
                    )}

                    {BackendUtils.isLNDBased() && (
                        <>
                            <Text
                                style={{
                                    ...styles.secondaryText,
                                    color: themeColor('secondaryText'),
                                    top: 20
                                }}
                            >
                                {localeString('views.Receive.routeHints')}
                            </Text>
                            <Switch
                                value={routeHints}
                                onValueChange={async () => {
                                    this.setState({
                                        routeHints: !routeHints
                                    });
                                    await updateSettings({
                                        invoices: {
                                            addressType,
                                            memo,
                                            expiry,
                                            routeHints: !routeHints,
                                            ampInvoice,
                                            showCustomPreimageField
                                        }
                                    });
                                }}
                            />
                        </>
                    )}

                    {BackendUtils.supportsAMP() && (
                        <>
                            <Text
                                style={{
                                    ...styles.secondaryText,
                                    color: themeColor('secondaryText'),
                                    top: 20
                                }}
                            >
                                {localeString('views.Receive.ampInvoice')}
                            </Text>
                            <Switch
                                value={ampInvoice}
                                onValueChange={async () => {
                                    this.setState({
                                        ampInvoice: !ampInvoice
                                    });
                                    await updateSettings({
                                        invoices: {
                                            addressType,
                                            memo,
                                            expiry,
                                            routeHints,
                                            ampInvoice: !ampInvoice,
                                            showCustomPreimageField
                                        }
                                    });
                                }}
                            />
                        </>
                    )}

                    {BackendUtils.supportsCustomPreimages() && (
                        <>
                            <Text
                                style={{
                                    ...styles.secondaryText,
                                    color: themeColor('secondaryText'),
                                    top: 20
                                }}
                            >
                                {localeString(
                                    'views.Settings.Invoices.showCustomPreimageField'
                                )}
                                {}
                            </Text>
                            <Switch
                                value={showCustomPreimageField}
                                onValueChange={async () => {
                                    this.setState({
                                        showCustomPreimageField:
                                            !showCustomPreimageField
                                    });
                                    await updateSettings({
                                        invoices: {
                                            addressType,
                                            memo,
                                            expiry,
                                            routeHints,
                                            ampInvoice,
                                            showCustomPreimageField:
                                                !showCustomPreimageField
                                        }
                                    });
                                }}
                            />
                        </>
                    )}
                </View>
                <ModalBox
                    style={{
                        backgroundColor: themeColor('background'),
                        borderTopLeftRadius: 20,
                        borderTopRightRadius: 20,
                        height: 450,
                        paddingLeft: 24,
                        paddingRight: 24
                    }}
                    swipeToClose={true}
                    backButtonClose={true}
                    position="bottom"
                    ref="modal"
                >
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
                                this.setState({ addressType: d.value });
                                await updateSettings({
                                    invoices: {
                                        addressType: d.value,
                                        memo,
                                        expiry,
                                        routeHints,
                                        ampInvoice,
                                        showCustomPreimageField
                                    }
                                });
                                this.refs.modal.close();
                            }}
                            style={{
                                backgroundColor: themeColor('secondary'),
                                borderColor:
                                    d.value === addressType
                                        ? themeColor('highlight')
                                        : themeColor('secondaryText'),
                                borderRadius: 4,
                                borderWidth: d.value === addressType ? 2 : 1,
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
                </ModalBox>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    secondaryText: {
        fontFamily: 'Lato-Regular'
    }
});
