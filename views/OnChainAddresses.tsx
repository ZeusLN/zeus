import React, { useState } from 'react';
import {
    FlatList,
    TouchableHighlight,
    TouchableOpacity,
    View
} from 'react-native';
import { ListItem, SearchBar } from 'react-native-elements';
import Button from '../components/Button';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import cloneDeep from 'lodash/cloneDeep';
// leave as is, do not do tree-shaking
import { chain } from 'lodash';

import Amount from '../components/Amount';
import Header from '../components/Header';
import LoadingIndicator from '../components/LoadingIndicator';
import Screen from '../components/Screen';
import { Body } from '../components/text/Body';
import DropdownSetting from '../components/DropdownSetting';
import { Row } from '../components/layout/Row';
import { ErrorMessage } from '../components/SuccessErrorMessage';

import addressUtils from '../utils/AddressUtils';
import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import UTXOsStore from '../stores/UTXOsStore';

import NavigationService from '../NavigationService';

import Add from '../assets/images/SVG/Add.svg';
import CaretDown from '../assets/images/SVG/Caret Down.svg';
import CaretRight from '../assets/images/SVG/Caret Right.svg';

const AddressGroup = (props: any) => {
    const { addressGroup, selectionMode, selectedAddress, onAddressSelected } =
        props;
    const [isCollapsed, setCollapsed] = useState(false);
    return (
        <React.Fragment
            key={`${addressGroup.accountName}-${addressGroup.addressType}`}
        >
            <ListItem
                containerStyle={{
                    borderTopWidth: 2,
                    borderBottomWidth: 1,
                    borderColor: themeColor('secondaryText'),
                    backgroundColor: 'transparent'
                }}
            >
                <ListItem.Content>
                    <Row>
                        <TouchableOpacity
                            style={{
                                flex: 1,
                                flexDirection: 'row'
                            }}
                            onPress={() => setCollapsed(!isCollapsed)}
                        >
                            <Row>
                                {!isCollapsed ? (
                                    <CaretDown
                                        fill={themeColor('text')}
                                        width="30"
                                        height="30"
                                        style={{ marginRight: 10 }}
                                    />
                                ) : (
                                    <CaretRight
                                        fill={themeColor('text')}
                                        width="30"
                                        height="30"
                                        style={{ marginRight: 10 }}
                                    />
                                )}
                                <ListItem.Title
                                    style={{
                                        color: themeColor('text'),
                                        fontSize: 14
                                    }}
                                >
                                    {localeString('general.accountName')}:{' '}
                                    {addressGroup.accountName + '\n'}
                                    {localeString('general.addressType')}:{' '}
                                    {addressUtils.snakeToHumanReadable(
                                        addressGroup.addressType
                                    )}
                                    {' \n'}
                                    {localeString('general.count')}:{' '}
                                    {addressGroup.addresses.length}
                                    {addressGroup.changeAddresses &&
                                        '\n' +
                                            localeString(
                                                'views.OnChainAddresses.changeAddresses'
                                            )}
                                </ListItem.Title>
                            </Row>
                        </TouchableOpacity>
                        {!selectionMode && (
                            <TouchableOpacity
                                onPress={() =>
                                    NavigationService.navigate('Receive', {
                                        account: addressGroup.accountName,
                                        addressType: addressGroup.addressType,
                                        selectedIndex: 2,
                                        autoGenerateOnChain: true,
                                        autoGenerateChange:
                                            !!addressGroup.changeAddresses,
                                        hideRightHeaderComponent: true
                                    })
                                }
                                accessibilityLabel={localeString(
                                    'views.OnChainAddresses.createAddress'
                                )}
                            >
                                <Add
                                    fill={themeColor('text')}
                                    width="30"
                                    height="30"
                                    style={{ alignSelf: 'center' }}
                                />
                            </TouchableOpacity>
                        )}
                    </Row>
                </ListItem.Content>
            </ListItem>
            {!isCollapsed &&
                addressGroup.addresses.map((address: Address) => {
                    const isSelected =
                        selectionMode &&
                        addressUtils.extractAddressValue(address) ===
                            selectedAddress;
                    return (
                        <ListItem
                            key={`address-${addressUtils.extractAddressValue(
                                address
                            )}`}
                            containerStyle={{
                                borderBottomWidth: 0,
                                backgroundColor: isSelected
                                    ? themeColor('secondary')
                                    : 'transparent'
                            }}
                            onPress={() => {
                                if (selectionMode) {
                                    // Only update local selection, don't call callback yet
                                    onAddressSelected(
                                        addressUtils.extractAddressValue(
                                            address
                                        )
                                    );
                                } else {
                                    const addressStr =
                                        addressUtils.extractAddressValue(
                                            address
                                        ) || '';
                                    NavigationService.navigate('QR', {
                                        value: `bitcoin:${
                                            addressStr ===
                                            addressStr.toLowerCase()
                                                ? addressStr.toUpperCase()
                                                : addressStr
                                        }`,
                                        copyValue: addressStr
                                    });
                                }
                            }}
                        >
                            <ListItem.Content>
                                <Amount
                                    sats={address.balance}
                                    sensitive
                                    colorOverride={
                                        isSelected
                                            ? themeColor('highlight')
                                            : undefined
                                    }
                                />
                                <ListItem.Subtitle
                                    right
                                    style={{
                                        color: isSelected
                                            ? themeColor('highlight')
                                            : themeColor('secondaryText'),
                                        fontSize: 14
                                    }}
                                >
                                    {addressUtils.extractAddressValue(
                                        address
                                    ) || ''}
                                </ListItem.Subtitle>
                            </ListItem.Content>
                        </ListItem>
                    );
                })}
        </React.Fragment>
    );
};

interface SelectionModeConfig {
    selectionMode?: boolean;
    onAddressSelected?: (address: string) => void;
    selectedAddress?: string;
    showConfirmButton?: boolean;
    onConfirm?: (address: string) => void;
    onBack?: () => void;
    headerTitle?: string;
}

interface OnChainAddressesProps extends SelectionModeConfig {
    navigation: StackNavigationProp<any, any>;
    route: Route<
        'OnChainAddresses',
        {
            account: string;
        } & SelectionModeConfig
    >;
    UTXOsStore: UTXOsStore;
}

interface OnChainAddressesState {
    accounts: any;
    hideZeroBalance: boolean;
    hideChangeAddresses: boolean;
    sortBy: SortBy;
    searchText: string;
    selectedAddress: string;
}

enum SortBy {
    creationTimeAscending = 'creationTimeAscending',
    creationTimeDescending = 'creationTimeDescending',
    balanceAscending = 'balanceAscending',
    balanceDescending = 'balanceDescending'
}

interface Account {
    name: string;
    address_type: string;
    derivation_path: string;
    addresses: Address[];
}

interface Address {
    address: string;
    is_internal: boolean;
    balance: string;
    derivation_path: string; // requires LND >= 0.18
    public_key: string; // requires LND >= 0.18
}

interface AddressGroup {
    accountName: string;
    addressType: string;
    changeAddresses: boolean;
    addresses: Address[];
}

@inject('UTXOsStore')
@observer
export default class OnChainAddresses extends React.Component<
    OnChainAddressesProps,
    OnChainAddressesState
> {
    state = {
        accounts: [],
        hideZeroBalance: false,
        hideChangeAddresses: false,
        sortBy: SortBy.balanceDescending,
        searchText: '',
        selectedAddress: this.getConfigValue<string>('selectedAddress', '')
    };

    getConfigValue<T>(key: keyof SelectionModeConfig, defaultValue?: T): T {
        if (this.props[key] !== undefined) {
            return this.props[key] as unknown as T;
        }
        if (this.props.route?.params?.[key] !== undefined) {
            return this.props.route.params[key] as unknown as T;
        }
        return defaultValue as T;
    }

    async componentDidMount() {
        this.props.navigation.addListener('focus', async () => {
            this.loadAddresses();
        });
    }

    loadAddresses = async () => {
        try {
            const accounts = await this.props.UTXOsStore.listAddresses();

            if (!accounts || !Array.isArray(accounts)) {
                this.setState({ accounts: [] });
                return;
            }

            this.setState({
                accounts: cloneDeep(accounts)
            });
        } catch (error) {
            console.error('OnChainAddresses: Error loading addresses:', error);
            this.setState({ accounts: [] });
        }
    };

    // Update search text as the user types and filter results
    updateSearch = (text: string) => {
        this.setState({ searchText: text });
    };

    selectAddress = (address: string) => {
        const { selectedAddress } = this.state;

        const newAddress = selectedAddress === address ? '' : address;

        this.setState({ selectedAddress: newAddress });
    };

    confirmSelection = () => {
        const { selectedAddress } = this.state;
        const { navigation } = this.props;
        const onAddressSelected = this.getConfigValue<
            ((address: string) => void) | undefined
        >('onAddressSelected');
        const onConfirm = this.getConfigValue<
            ((address: string) => void) | undefined
        >('onConfirm');

        if (onAddressSelected) {
            onAddressSelected(selectedAddress);
        }

        if (onConfirm) {
            onConfirm(selectedAddress);
            return;
        }

        navigation.goBack();
    };

    renderSeparator = () => (
        <View
            style={{
                height: 0.4,
                backgroundColor: themeColor('separator')
            }}
        />
    );

    render() {
        const { UTXOsStore, navigation } = this.props;
        const {
            accounts,
            hideZeroBalance,
            hideChangeAddresses,
            searchText,
            selectedAddress
        } = this.state ?? {};
        const { loadingAddresses, loadingAddressesError } = UTXOsStore;
        const sortBy = this.state?.sortBy ?? SortBy.creationTimeDescending;

        const selectionMode = this.getConfigValue<boolean>(
            'selectionMode',
            false
        );

        let addressGroups: AddressGroup[] | undefined;

        if (
            accounts &&
            Array.isArray(accounts) &&
            accounts.length > 0 &&
            !loadingAddresses &&
            !loadingAddressesError
        ) {
            (accounts as any[]).forEach((account) => {
                if (!account.addresses || !Array.isArray(account.addresses)) {
                    account.addresses = [];
                }
            });

            if (sortBy === SortBy.creationTimeAscending) {
                accounts.forEach((account: Account) => {
                    if (account.addresses && account.addresses.length > 0) {
                        account.addresses.sort((a, b) => {
                            if (!a.derivation_path || !b.derivation_path)
                                return 0;
                            const aPath = a.derivation_path.split('/');
                            const bPath = b.derivation_path.split('/');
                            return (
                                Number(aPath[aPath.length - 1]) -
                                Number(bPath[bPath.length - 1])
                            );
                        });
                    }
                });
            } else if (sortBy === SortBy.creationTimeDescending) {
                accounts.forEach((account: Account) => {
                    if (account.addresses && account.addresses.length > 0) {
                        account.addresses.sort((a, b) => {
                            if (!a.derivation_path || !b.derivation_path)
                                return 0;
                            const aPath = a.derivation_path.split('/');
                            const bPath = b.derivation_path.split('/');
                            return (
                                Number(bPath[bPath.length - 1]) -
                                Number(aPath[aPath.length - 1])
                            );
                        });
                    }
                });
            } else if (sortBy === SortBy.balanceAscending) {
                accounts.forEach((account: Account) => {
                    if (account.addresses && account.addresses.length > 0) {
                        account.addresses.sort(
                            (a, b) =>
                                Number(a.balance || 0) - Number(b.balance || 0)
                        );
                    }
                });
            } else if (sortBy === SortBy.balanceDescending) {
                accounts.forEach((account: Account) => {
                    if (account.addresses && account.addresses.length > 0) {
                        account.addresses.sort(
                            (a, b) =>
                                Number(b.balance || 0) - Number(a.balance || 0)
                        );
                    }
                });
            }

            addressGroups = chain(
                JSON.parse(JSON.stringify(accounts)) as Account[]
            )
                .flatMap((account) => {
                    if (
                        !account.addresses ||
                        !Array.isArray(account.addresses)
                    ) {
                        return [];
                    }
                    return account.addresses.map((address) => ({
                        account: {
                            name: account.name || 'default',
                            address_type: account.address_type || 'bech32'
                        },
                        address
                    }));
                })
                .groupBy((t) => {
                    if (!t || !t.account || !t.address) {
                        return 'default;bech32;false';
                    }
                    const accountName = t.account?.name || 'default';
                    const addressType = t.account?.address_type || 'bech32';
                    const isInternal = t.address?.is_internal || false;
                    return `${accountName};${addressType};${isInternal}`;
                })
                .map((g) => {
                    if (!g || !g[0]) {
                        return {
                            accountName: 'default',
                            addressType: 'bech32',
                            changeAddresses: false,
                            addresses: []
                        };
                    }
                    return {
                        accountName: g[0]?.account?.name || 'default',
                        addressType: g[0]?.account?.address_type || 'bech32',
                        changeAddresses: g[0]?.address?.is_internal || false,
                        addresses: g
                            .map((a) => a.address)
                            .filter((addr) => addr && typeof addr === 'object')
                    };
                })
                .value();

            if (hideZeroBalance && addressGroups) {
                addressGroups.forEach((acc) => {
                    if (acc.addresses && Array.isArray(acc.addresses)) {
                        acc.addresses = acc.addresses.filter(
                            (addr) =>
                                addr && addr.balance && addr.balance !== '0'
                        );
                    }
                });
            }

            if (hideChangeAddresses && addressGroups) {
                addressGroups = addressGroups.filter((a) => !a.changeAddresses);
            }

            // Apply search filter
            if (searchText && addressGroups) {
                addressGroups = addressGroups
                    .map((group) => {
                        const filteredGroup = { ...group };
                        if (
                            filteredGroup.addresses &&
                            Array.isArray(filteredGroup.addresses)
                        ) {
                            filteredGroup.addresses = group.addresses.filter(
                                (addr) => {
                                    const addressValue =
                                        addressUtils.extractAddressValue(addr);
                                    return (
                                        (addressValue &&
                                            addressValue
                                                .toLowerCase()
                                                .includes(
                                                    searchText.toLowerCase()
                                                )) ||
                                        (group.accountName &&
                                            group.accountName
                                                .toLowerCase()
                                                .includes(
                                                    searchText.toLowerCase()
                                                ))
                                    );
                                }
                            );
                        } else {
                            filteredGroup.addresses = [];
                        }
                        return filteredGroup;
                    })
                    .filter(
                        (group) => group.addresses && group.addresses.length > 0
                    );
            }
        }

        const FilterAndSortingButtons = () => {
            return (
                <View
                    style={{
                        marginTop: 5,
                        marginBottom: 14,
                        paddingHorizontal: 10
                    }}
                >
                    <DropdownSetting
                        title={localeString('general.sorting')}
                        values={Object.keys(SortBy).map((s) => ({
                            key: localeString(
                                `views.OnChainAddresses.sortBy.${s}`
                            ),
                            translateKey: `views.OnChainAddresses.sortBy.${s}`,
                            value: s
                        }))}
                        selectedValue={sortBy}
                        onValueChange={(newSortBy: SortBy) =>
                            this.setState({ sortBy: newSortBy })
                        }
                    />
                    <View style={{ flexDirection: 'row' }}>
                        <TouchableHighlight
                            activeOpacity={0.7}
                            style={{
                                paddingHorizontal: 15,
                                paddingVertical: 6,
                                marginHorizontal: 3,
                                backgroundColor: themeColor('secondary'),
                                borderRadius: 20
                            }}
                            underlayColor={themeColor('disabled')}
                            onPress={() =>
                                this.setState({
                                    hideZeroBalance: !hideZeroBalance
                                })
                            }
                        >
                            <View>
                                <Body
                                    small
                                    bold
                                    color={
                                        hideZeroBalance ? 'highlight' : 'text'
                                    }
                                >
                                    {localeString(
                                        'views.OnChainAddresses.hideZeroBalanance'
                                    )}
                                </Body>
                            </View>
                        </TouchableHighlight>
                        <TouchableHighlight
                            activeOpacity={0.7}
                            style={{
                                paddingHorizontal: 15,
                                paddingVertical: 6,
                                marginHorizontal: 3,
                                backgroundColor: themeColor('secondary'),
                                borderRadius: 20
                            }}
                            underlayColor={themeColor('disabled')}
                            onPress={() =>
                                this.setState({
                                    hideChangeAddresses: !hideChangeAddresses
                                })
                            }
                        >
                            <View>
                                <Body
                                    small
                                    bold
                                    color={
                                        hideChangeAddresses
                                            ? 'highlight'
                                            : 'text'
                                    }
                                >
                                    {localeString(
                                        'views.OnChainAddresses.hideChangeAddresses'
                                    )}
                                </Body>
                            </View>
                        </TouchableHighlight>
                    </View>
                </View>
            );
        };

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text:
                            this.getConfigValue<string>('headerTitle') ||
                            (!selectionMode &&
                                localeString('views.OnChainAddresses.title')),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={
                        !loadingAddresses &&
                        !loadingAddressesError &&
                        !addressGroups &&
                        !selectionMode ? (
                            <TouchableOpacity
                                onPress={() =>
                                    navigation.navigate('Receive', {
                                        account: 'default',
                                        selectedIndex: 2,
                                        autoGenerateOnChain: true,
                                        hideRightHeaderComponent: true
                                    })
                                }
                                accessibilityLabel={localeString(
                                    'views.OnChainAddresses.createAddress'
                                )}
                            >
                                <Add
                                    fill={themeColor('text')}
                                    width="30"
                                    height="30"
                                    style={{ alignSelf: 'center' }}
                                />
                            </TouchableOpacity>
                        ) : undefined
                    }
                    navigation={navigation}
                />

                {/* Search bar */}
                {!loadingAddresses && (
                    <SearchBar
                        placeholder={localeString('general.search')}
                        // @ts-ignore:next-line
                        onChangeText={this.updateSearch}
                        value={searchText}
                        inputStyle={{
                            color: themeColor('text')
                        }}
                        placeholderTextColor={themeColor('secondaryText')}
                        containerStyle={{
                            backgroundColor: 'transparent',
                            borderTopWidth: 0,
                            borderBottomWidth: 0
                        }}
                        inputContainerStyle={{
                            borderRadius: 15,
                            backgroundColor: themeColor('secondary')
                        }}
                        // @ts-ignore:next-line
                        searchIcon={{
                            importantForAccessibility: 'no-hide-descendants',
                            accessibilityElementsHidden: true
                        }}
                    />
                )}

                {loadingAddresses ? (
                    <View style={{ padding: 50 }}>
                        <LoadingIndicator />
                    </View>
                ) : addressGroups && addressGroups.length > 0 ? (
                    <>
                        <FilterAndSortingButtons />
                        <FlatList
                            data={addressGroups}
                            renderItem={({ item: addressGroup }) => {
                                return (
                                    <AddressGroup
                                        addressGroup={addressGroup}
                                        selectionMode={selectionMode}
                                        selectedAddress={selectedAddress}
                                        onAddressSelected={this.selectAddress}
                                    />
                                );
                            }}
                            keyExtractor={(_, index) => `address-${index}`}
                            ItemSeparatorComponent={this.renderSeparator}
                            onEndReachedThreshold={50}
                            refreshing={loadingAddresses}
                            onRefresh={() => this.loadAddresses()}
                        />

                        {/* Confirm button for selection mode */}
                        {selectionMode && selectedAddress && (
                            <View style={{ padding: 10 }}>
                                <Button
                                    title={localeString('general.confirm')}
                                    onPress={this.confirmSelection}
                                    buttonStyle={{
                                        paddingTop: 10,
                                        paddingBottom: 10
                                    }}
                                />
                            </View>
                        )}
                    </>
                ) : loadingAddressesError ? (
                    <ErrorMessage message={loadingAddressesError} />
                ) : (
                    <Button
                        title={localeString(
                            'views.OnChainAddresses.noAddressesAvailable'
                        )}
                        icon={{
                            name: 'error-outline',
                            size: 25,
                            color: themeColor('text')
                        }}
                        onPress={() => this.loadAddresses()}
                        buttonStyle={{
                            backgroundColor: 'transparent',
                            borderRadius: 30
                        }}
                        titleStyle={{
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }}
                    />
                )}
            </Screen>
        );
    }
}
