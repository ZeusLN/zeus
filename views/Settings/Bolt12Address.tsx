import * as React from 'react';
import { Platform, Text, View, StyleSheet, ScrollView } from 'react-native';
import { inject, observer } from 'mobx-react';
import { ButtonGroup } from '@rneui/themed';
import NfcManager from 'react-native-nfc-manager';

import { themeColor } from '../../utils/ThemeUtils';

import Button from '../../components/Button';
import CollapsedQR from '../../components/CollapsedQR';
import Header from '../../components/Header';
import LoadingIndicator from '../../components/LoadingIndicator';
import Screen from '../../components/Screen';
import { ErrorMessage } from '../../components/SuccessErrorMessage';
import TextInput from '../../components/TextInput';

import { localeString } from '../../utils/LocaleUtils';
import BackendUtils from '../../utils/BackendUtils';
import { getButtonGroupStyles } from '../../utils/buttonGroupStyles';

import SettingsStore from '../../stores/SettingsStore';

interface Bolt12AddressSettingsProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

interface Bolt12AddressSettingsState {
    newLocalPart: string;
    existingLocalPart: string;
    existingOffer: string;
    selectedIndex: number;
    nfcSupported: boolean;
    loading: boolean;
    error: string;
}

type CreateOfferResponse = {
    active: boolean;
    bolt12: string;
    created: boolean;
    offerId: string;
    singleUse: boolean;
    used: boolean;
};

const HOST = 'twelve.cash';

@inject('SettingsStore')
@observer
export default class Bolt12AddressSettings extends React.Component<
    Bolt12AddressSettingsProps,
    Bolt12AddressSettingsState
> {
    state = {
        newLocalPart: '',
        existingLocalPart: '',
        existingOffer: '',
        selectedIndex: 0,
        nfcSupported: false,
        loading: false,
        error: ''
    };

    async componentDidMount() {
        const { SettingsStore } = this.props;
        const { getSettings } = SettingsStore;
        const settings = await getSettings();

        const existingLocalPart = settings?.bolt12Address?.localPart || '';
        const existingOffer = settings?.bolt12Address?.offer || '';

        this.setState({
            newLocalPart: '',
            existingLocalPart,
            existingOffer
        });

        if (existingLocalPart && !existingOffer) {
            this.lookupOffer(existingLocalPart);
        }

        if (Platform.OS === 'android') {
            try {
                const nfcSupported = await NfcManager.isSupported();
                this.setState({ nfcSupported });
            } catch {
                this.setState({ nfcSupported: false });
            }
        }
    }

    // addresses created before the offer string was persisted in settings:
    // recover it from the node's active offers by the label set at creation
    async lookupOffer(localPart: string) {
        const { SettingsStore } = this.props;
        const { updateSettings } = SettingsStore;

        const address = `${localPart}@${HOST}`;

        try {
            const data = await BackendUtils.listOffers();
            const match = (data?.offers || []).find(
                (offer: any) => offer.label === address && offer.bolt12
            );
            if (!match) return;
            if (this.state.existingLocalPart !== localPart) return;

            await updateSettings({
                bolt12Address: {
                    localPart,
                    offer: match.bolt12
                }
            });
            this.setState({ existingOffer: match.bolt12 });
        } catch (e) {
            console.error('Failed to look up BOLT 12 address offer:', e);
        }
    }

    async requestPaymentAddress() {
        const { SettingsStore } = this.props;
        const { newLocalPart } = this.state;
        const { updateSettings } = SettingsStore;

        this.setState({
            loading: true
        });

        const address = `${newLocalPart}@${HOST}`;

        let data: CreateOfferResponse;
        try {
            data = await BackendUtils.createOffer({
                description: address,
                label: address
            });
            if (!data.bolt12)
                throw localeString(
                    'views.Settings.Bolt12Address.error.noBolt12'
                );
        } catch (e) {
            console.error();
            this.setState({
                loading: false,
                error: `${localeString(
                    'views.Settings.Bolt12Address.error.failedToGetOffer'
                )}: ${e}`
            });
            return;
        }

        try {
            const res = await fetch(`https://${HOST}/record`, {
                method: 'POST',
                body: JSON.stringify({
                    localPart: newLocalPart,
                    bolt12: data.bolt12
                })
            });

            if (res.status === 409) {
                this.setState({
                    loading: false,
                    error: localeString(
                        'views.Settings.Bolt12Address.error.handleTaken'
                    )
                });
                return;
            } else if (res.status !== 201) {
                this.setState({
                    loading: false,
                    error: localeString(
                        'views.Settings.Bolt12Address.error.failedToCreate'
                    )
                });
                return;
            }

            await updateSettings({
                bolt12Address: {
                    localPart: this.state.newLocalPart,
                    offer: data.bolt12
                }
            });
            this.setState({
                newLocalPart: '',
                existingLocalPart: this.state.newLocalPart,
                existingOffer: data.bolt12,
                selectedIndex: 0,
                loading: false
            });
        } catch (e) {
            console.error(e);
            this.setState({
                loading: false,
                error: localeString(
                    'views.Settings.Bolt12Address.error.failedToCreate'
                )
            });
            return;
        }
    }

    render() {
        const { navigation } = this.props;
        const {
            newLocalPart,
            existingLocalPart,
            existingOffer,
            selectedIndex,
            nfcSupported,
            loading,
            error
        } = this.state;

        const address = `${existingLocalPart}@${HOST}`;

        const tabs = [
            {
                title: localeString('general.address'),
                value: `lightning:${address}`,
                copyValue: address,
                label: address
            },
            ...(existingOffer
                ? [
                      {
                          title: localeString(
                              'views.Settings.Bolt12Address.offer'
                          ),
                          value: `lightning:${existingOffer}`,
                          copyValue: existingOffer,
                          label: existingOffer
                      }
                  ]
                : [])
        ];
        const active = tabs[selectedIndex] || tabs[0];

        const groupStyles = getButtonGroupStyles();
        const tabButtons = tabs.map((tab, idx) => ({
            element: () => (
                <Text
                    style={{
                        ...styles.tabText,
                        color:
                            selectedIndex === idx
                                ? themeColor('background')
                                : themeColor('text')
                    }}
                >
                    {tab.title}
                </Text>
            )
        }));

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Settings.Bolt12Address'),
                        style: {
                            ...styles.secondaryText,
                            color: themeColor('text')
                        }
                    }}
                    rightComponent={
                        loading ? <LoadingIndicator size={30} /> : <></>
                    }
                    containerStyle={{ borderBottomWidth: 0 }}
                    navigation={navigation}
                />
                <ScrollView style={{ flex: 1 }}>
                    {error && <ErrorMessage message={error} />}
                    {existingLocalPart ? (
                        <View style={{ paddingHorizontal: 15 }}>
                            {existingOffer && (
                                <ButtonGroup
                                    onPress={(index) =>
                                        this.setState({ selectedIndex: index })
                                    }
                                    selectedIndex={selectedIndex}
                                    buttons={tabButtons}
                                    selectedButtonStyle={
                                        groupStyles.selectedButtonStyle
                                    }
                                    containerStyle={groupStyles.containerStyle}
                                    innerBorderStyle={
                                        groupStyles.innerBorderStyle
                                    }
                                />
                            )}
                            <CollapsedQR
                                value={active.value}
                                copyValue={active.copyValue}
                                expanded
                                textBottom
                                truncateLongValue
                                hideText
                                labelBottom={active.label}
                                nfcSupported={nfcSupported}
                            />
                            <View style={styles.button}>
                                <Button
                                    title={localeString(
                                        'views.Settings.Bolt12Address.changeButton'
                                    )}
                                    onPress={() => {
                                        this.setState({
                                            existingLocalPart: '',
                                            existingOffer: '',
                                            newLocalPart: '',
                                            selectedIndex: 0
                                        });
                                    }}
                                />
                            </View>
                        </View>
                    ) : (
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
                                {localeString(
                                    'views.Settings.Bolt12Address.handle'
                                )}
                            </Text>
                            <View
                                style={{
                                    display: 'flex',
                                    flexDirection: 'row'
                                }}
                            >
                                <TextInput
                                    value={newLocalPart}
                                    onChangeText={(text: string) => {
                                        this.setState({
                                            newLocalPart: text
                                        });
                                    }}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    style={{
                                        flex: 1,
                                        flexDirection: 'row'
                                    }}
                                />
                                <Text
                                    style={{
                                        fontFamily: 'PPNeueMontreal-Book',
                                        color: themeColor('text'),
                                        fontSize: 20,
                                        marginLeft: 5,
                                        marginTop: 27
                                    }}
                                >
                                    @{HOST}
                                </Text>
                            </View>
                            <View style={styles.button}>
                                <Button
                                    title={localeString(
                                        'views.Settings.Bolt12Address.requestButton'
                                    )}
                                    disabled={!this.state.newLocalPart}
                                    onPress={() => this.requestPaymentAddress()}
                                />
                            </View>
                        </View>
                    )}
                </ScrollView>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    secondaryText: {
        fontFamily: 'PPNeueMontreal-Book'
    },
    tabText: {
        fontFamily: 'PPNeueMontreal-Book'
    },
    button: {
        padding: 10
    }
});
