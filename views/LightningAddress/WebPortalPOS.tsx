import * as React from 'react';
import { ScrollView, View } from 'react-native';
import { Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import Button from '../../components/Button';
import Header from '../../components/Header';
import LoadingIndicator from '../../components/LoadingIndicator';
import Screen from '../../components/Screen';
import Switch from '../../components/Switch';
import { Row } from '../../components/layout/Row';
import { ErrorMessage } from '../../components/SuccessErrorMessage';

import SettingsStore from '../../stores/SettingsStore';
import LightningAddressStore from '../../stores/LightningAddressStore';
import UnitsStore from '../../stores/UnitsStore';
import { CATEGORY_KEY, PRODUCT_KEY } from '../../stores/InventoryStore';

import Storage from '../../storage';

interface WebPortalPOSProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
    LightningAddressStore: LightningAddressStore;
    UnitsStore: UnitsStore;
}

interface WebPortalPOSState {
    posEnabled: boolean | undefined;
    fiatEnabled: boolean | undefined;
    selectedCurrency: string | undefined;
}

@inject('SettingsStore', 'LightningAddressStore', 'UnitsStore')
@observer
export default class WebPortalPOS extends React.Component<
    WebPortalPOSProps,
    WebPortalPOSState
> {
    state = {
        posEnabled: false,
        fiatEnabled: false,
        selectedCurrency: ''
    };

    async UNSAFE_componentWillMount() {
        const { SettingsStore } = this.props;
        const { settings } = SettingsStore;

        this.setState({
            posEnabled: settings.lightningAddress?.posEnabled,
            fiatEnabled: settings.fiatEnabled,
            selectedCurrency: settings.fiat
        });
    }

    async componentDidUpdate(
        _prevProps: Readonly<WebPortalPOSProps>,
        prevState: Readonly<WebPortalPOSState>,
        _snapshot?: any
    ): Promise<void> {
        const { settings } = this.props.SettingsStore;
        if (prevState.selectedCurrency !== settings.fiat) {
            this.setState({
                selectedCurrency: settings.fiat
            });
        }
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
        const { navigation, SettingsStore, LightningAddressStore, UnitsStore } =
            this.props;
        const { posEnabled, fiatEnabled, selectedCurrency } = this.state;
        const { updateSettings, settings }: any = SettingsStore;
        const { update, loading, error_msg } = LightningAddressStore;

        const LIST_ITEMS = [
            {
                label: localeString('views.Settings.POS.Categories'),
                path: 'Categories'
            },
            {
                label: localeString('views.Settings.POS.Products'),
                path: 'Products'
            }
        ];

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString(
                            'views.Settings.LightningAddress.webPortalPos'
                        ),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={
                        <Row>{loading && <LoadingIndicator size={30} />}</Row>
                    }
                    navigation={navigation}
                />
                {error_msg && <ErrorMessage message={error_msg} />}
                <ScrollView
                    style={{ flex: 1 }}
                    keyboardShouldPersistTaps="handled"
                >
                    <ListItem
                        containerStyle={{
                            borderBottomWidth: 0,
                            backgroundColor: 'transparent'
                        }}
                    >
                        <ListItem.Title
                            style={{
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }}
                        >
                            {localeString('views.Settings.enabled')}
                        </ListItem.Title>
                        <View
                            style={{
                                flex: 1,
                                flexDirection: 'row',
                                justifyContent: 'flex-end'
                            }}
                        >
                            <Switch
                                value={posEnabled}
                                onValueChange={async () => {
                                    this.setState({
                                        posEnabled: !posEnabled
                                    });
                                    await updateSettings({
                                        lightningAddress: {
                                            ...settings.lightningAddress,
                                            posEnabled: !posEnabled
                                        }
                                    });
                                }}
                            />
                        </View>
                    </ListItem>
                    {posEnabled && (
                        <>
                            {LIST_ITEMS.map((item, index) => (
                                <ListItem
                                    containerStyle={{
                                        borderBottomWidth: 0,
                                        backgroundColor: 'none'
                                    }}
                                    onPress={() =>
                                        navigation.navigate(item.path)
                                    }
                                    key={`${item.label}-${index}`}
                                >
                                    <ListItem.Content>
                                        <ListItem.Title
                                            style={{
                                                color: themeColor('text'),
                                                fontFamily:
                                                    'PPNeueMontreal-Book'
                                            }}
                                        >
                                            {item.label}
                                        </ListItem.Title>
                                    </ListItem.Content>
                                    <Icon
                                        name="keyboard-arrow-right"
                                        color={themeColor('secondaryText')}
                                    />
                                </ListItem>
                            ))}
                            <ListItem
                                containerStyle={{
                                    borderBottomWidth: 0,
                                    backgroundColor: 'transparent'
                                }}
                            >
                                <ListItem.Title
                                    style={{
                                        color: themeColor('text'),
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.LightningAddress.webPortalPos.enableFiat'
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
                                        value={fiatEnabled}
                                        onValueChange={async () => {
                                            const newFiatEnabled = !fiatEnabled;
                                            this.setState({
                                                fiatEnabled: newFiatEnabled
                                            });
                                            await updateSettings({
                                                fiatEnabled: newFiatEnabled
                                            });
                                            if (!newFiatEnabled) {
                                                if (
                                                    UnitsStore.units === 'fiat'
                                                ) {
                                                    UnitsStore.resetUnits();
                                                }
                                            }
                                        }}
                                    />
                                </View>
                            </ListItem>
                            {fiatEnabled && (
                                <>
                                    <ListItem
                                        containerStyle={{
                                            backgroundColor: 'transparent'
                                        }}
                                        onPress={() =>
                                            navigation.navigate(
                                                'SelectCurrency'
                                            )
                                        }
                                    >
                                        <ListItem.Content>
                                            <ListItem.Title
                                                style={{
                                                    color: themeColor('text'),
                                                    fontFamily:
                                                        'PPNeueMontreal-Book'
                                                }}
                                            >
                                                {localeString(
                                                    'views.Settings.Currency.selectCurrency'
                                                ) + ` (${selectedCurrency})`}
                                            </ListItem.Title>
                                        </ListItem.Content>
                                        <Icon
                                            name="keyboard-arrow-right"
                                            color={themeColor('text')}
                                        />
                                    </ListItem>
                                </>
                            )}
                        </>
                    )}
                </ScrollView>
                <View style={{ bottom: 15 }}>
                    <Button
                        title={localeString(
                            'views.Settings.LightningAddress.webPortalPos.syncSettings'
                        )}
                        onPress={async () => {
                            const categoriesString = await Storage.getItem(
                                CATEGORY_KEY
                            );
                            const productsString = await Storage.getItem(
                                PRODUCT_KEY
                            );
                            const categories =
                                JSON.parse(categoriesString) || [];
                            const products = JSON.parse(productsString) || [];

                            await update({
                                pos_enabled: posEnabled,
                                pos_currency_code:
                                    posEnabled && fiatEnabled
                                        ? settings.fiat
                                        : '',
                                pos_categories: posEnabled ? categories : [],
                                pos_products: posEnabled ? products : []
                            }).then(() => {
                                navigation.goBack();
                            });
                        }}
                        disabled={loading}
                    />
                </View>
            </Screen>
        );
    }
}
