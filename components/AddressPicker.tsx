import * as React from 'react';
import {
    FlatList,
    StyleSheet,
    View,
    Text,
    TouchableHighlight,
    TextInput
} from 'react-native';
import { ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { chain } from 'lodash';

import Amount from './Amount';
import Button from './Button';
import Header from './Header';
import LoadingIndicator from './LoadingIndicator';
import Screen from './Screen';
import DropdownSetting from './DropdownSetting';
import { Body } from './text/Body';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';
import AddressUtils from '../utils/AddressUtils';

import MessageSignStore from '../stores/MessageSignStore';

interface AddressPickerProps {
    navigation: any;
    route: any;
    onValueChange?: (address: string) => void;
    selectedAddress?: string;
    MessageSignStore: MessageSignStore;
    onConfirm?: (address: string) => void;
    onBack?: () => void;
}

interface AddressPickerState {
    selectedAddress: string;
    collapsedGroups: Record<string, boolean>;
    searchText: string;
    hideZeroBalance: boolean;
    hideChangeAddresses: boolean;
    sortBy: SortBy;
}

enum SortBy {
    alphabeticalAscending = 'alphabeticalAscending',
    alphabeticalDescending = 'alphabeticalDescending',
    balanceAscending = 'balanceAscending',
    balanceDescending = 'balanceDescending'
}

interface Address {
    address: string;
    type: string;
    accountName?: string;
    addressType?: string;
    isInternal?: boolean;
    balance?: string;
}

interface AddressGroup {
    accountName: string;
    addressType: string;
    changeAddresses: boolean;
    addresses: Address[];
}

@inject('MessageSignStore')
@observer
export default class AddressPicker extends React.Component<
    AddressPickerProps,
    AddressPickerState
> {
    private searchInputRef = React.createRef<TextInput>();
    private localSearchText = '';

    state = {
        selectedAddress: this.props.selectedAddress || '',
        collapsedGroups: {} as Record<string, boolean>,
        searchText: '',
        hideZeroBalance: false,
        hideChangeAddresses: false,
        sortBy: SortBy.balanceDescending
    };

    componentDidMount() {
        const { MessageSignStore } = this.props;
        if (MessageSignStore.addresses.length === 0) {
            MessageSignStore.loadAddresses();
        }
    }

    handleSearchSubmit = () => {
        if (this.localSearchText !== this.state.searchText) {
            this.setState({ searchText: this.localSearchText });

            if (this.searchInputRef && this.searchInputRef.current) {
                this.searchInputRef.current.setNativeProps({
                    text: this.localSearchText
                });
            }
        }
    };

    selectAddress = (address: string) => {
        const { selectedAddress } = this.state;

        const newAddress = selectedAddress === address ? '' : address;

        this.setState({ selectedAddress: newAddress });

        if (this.props.onValueChange) {
            this.props.onValueChange(newAddress);
        }
    };

    toggleGroupCollapse = (groupId: string) => {
        this.setState((prevState) => ({
            collapsedGroups: {
                ...prevState.collapsedGroups,
                [groupId]: !prevState.collapsedGroups[groupId]
            }
        }));
    };

    confirmSelection = () => {
        const { selectedAddress } = this.state;
        const { onConfirm, navigation, route } = this.props;

        if (onConfirm) {
            onConfirm(selectedAddress);
            return;
        }

        const { onAddressSelected } = route?.params || {};

        if (onAddressSelected && typeof onAddressSelected === 'function') {
            try {
                onAddressSelected(selectedAddress);
                navigation.goBack();
            } catch (error) {
                console.error('Error in address selection callback:', error);
                navigation.goBack();
            }
        } else {
            navigation.goBack();
        }
    };

    handleBackPress = () => {
        const { onBack, navigation } = this.props;

        if (onBack) {
            onBack();
            return;
        }

        navigation.goBack();
    };

    renderAddressGroup = ({ item }: { item: AddressGroup }) => {
        const { selectedAddress, collapsedGroups } = this.state;
        const groupId = `${item.accountName}-${item.addressType}`;
        const isCollapsed = !!collapsedGroups[groupId];

        return (
            <React.Fragment key={groupId}>
                <ListItem
                    containerStyle={{
                        borderTopWidth: 2,
                        borderBottomWidth: 1,
                        borderColor: themeColor('secondaryText'),
                        backgroundColor: 'transparent'
                    }}
                    onPress={() => this.toggleGroupCollapse(groupId)}
                >
                    <ListItem.Content>
                        <View
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center'
                            }}
                        >
                            <View style={{ marginRight: 10 }}>
                                {!isCollapsed ? (
                                    <Text
                                        style={{
                                            color: themeColor('text'),
                                            fontSize: 18
                                        }}
                                    >
                                        ▼
                                    </Text>
                                ) : (
                                    <Text
                                        style={{
                                            color: themeColor('text'),
                                            fontSize: 18
                                        }}
                                    >
                                        ▶
                                    </Text>
                                )}
                            </View>
                            <View style={{ flex: 1 }}>
                                <ListItem.Title
                                    style={{
                                        color: themeColor('text'),
                                        fontSize: 14
                                    }}
                                >
                                    {localeString('general.accountName')}:{' '}
                                    {item.accountName + '\n'}
                                    {localeString('general.addressType')}:{' '}
                                    {AddressUtils.snakeToHumanReadable(
                                        item.addressType
                                    )}
                                    {' \n'}
                                    {localeString('general.count')}:{' '}
                                    {item.addresses.length}
                                    {item.changeAddresses &&
                                        '\n' +
                                            localeString(
                                                'views.OnChainAddresses.changeAddresses'
                                            )}
                                </ListItem.Title>
                            </View>
                        </View>
                    </ListItem.Content>
                </ListItem>

                {!isCollapsed &&
                    item.addresses.map((address: Address) => (
                        <ListItem
                            key={`address-${address.address}`}
                            containerStyle={{
                                borderBottomWidth: 0,
                                backgroundColor:
                                    address.address === selectedAddress
                                        ? themeColor('highlight') + '30' // 30% opacity
                                        : 'transparent'
                            }}
                            onPress={() => this.selectAddress(address.address)}
                        >
                            <ListItem.Content>
                                {address.balance !== undefined && (
                                    <Amount sats={address.balance} sensitive />
                                )}
                                <ListItem.Subtitle
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontSize: 14
                                    }}
                                >
                                    {address.address}
                                </ListItem.Subtitle>
                            </ListItem.Content>
                            {address.address === selectedAddress && (
                                <View style={{ marginLeft: 10 }}>
                                    <Text
                                        style={{
                                            color: themeColor('highlight'),
                                            fontSize: 16
                                        }}
                                    >
                                        ✓
                                    </Text>
                                </View>
                            )}
                        </ListItem>
                    ))}
            </React.Fragment>
        );
    };

    render() {
        const { MessageSignStore, navigation } = this.props;
        const { addresses, loading } = MessageSignStore;
        const {
            selectedAddress,
            searchText,
            hideZeroBalance,
            hideChangeAddresses,
            sortBy
        } = this.state;

        let addressGroups: AddressGroup[] = [];

        if (addresses && addresses.length > 0) {
            let sortedAddresses = [...addresses];

            switch (sortBy) {
                case SortBy.alphabeticalAscending:
                    sortedAddresses.sort((a, b) =>
                        a.address.localeCompare(b.address)
                    );
                    break;
                case SortBy.alphabeticalDescending:
                    sortedAddresses.sort((a, b) =>
                        b.address.localeCompare(a.address)
                    );
                    break;
                case SortBy.balanceAscending:
                    sortedAddresses.sort(
                        (a: any, b: any) =>
                            Number(a.balance || 0) - Number(b.balance || 0)
                    );
                    break;
                case SortBy.balanceDescending:
                    sortedAddresses.sort(
                        (a: any, b: any) =>
                            Number(b.balance || 0) - Number(a.balance || 0)
                    );
                    break;
            }

            if (searchText) {
                sortedAddresses = sortedAddresses.filter(
                    (addr) =>
                        addr.address
                            .toLowerCase()
                            .includes(searchText.toLowerCase()) ||
                        (addr.accountName &&
                            addr.accountName
                                .toLowerCase()
                                .includes(searchText.toLowerCase()))
                );
            }

            const groupedAddresses = chain(sortedAddresses)
                .groupBy(function (addr: Address) {
                    const accountName =
                        addr.accountName ||
                        localeString('general.defaultNodeNickname');
                    const addressType =
                        addr.addressType || localeString('general.unknown');
                    const isInternal =
                        addr.isInternal !== undefined
                            ? String(addr.isInternal)
                            : 'false';
                    return `${accountName};${addressType};${isInternal}`;
                })
                .value();

            addressGroups = Object.entries(groupedAddresses).map(
                ([key, addrGroup]) => {
                    const [accountName, addressType, isInternalStr] =
                        key.split(';');
                    return {
                        accountName:
                            accountName ||
                            localeString('general.defaultNodeNickname'),
                        addressType:
                            addressType || localeString('general.unknown'),
                        changeAddresses: isInternalStr === 'true',
                        addresses: addrGroup
                    };
                }
            );

            // Apply zero balance filter
            if (hideZeroBalance) {
                addressGroups.forEach(
                    (acc) =>
                        (acc.addresses = acc.addresses.filter(
                            (addr: any) =>
                                addr.balance && Number(addr.balance) > 0
                        ))
                );
                // Remove empty groups after filtering
                addressGroups = addressGroups.filter(
                    (group) => group.addresses.length > 0
                );
            }

            // Apply change addresses filter
            if (hideChangeAddresses) {
                addressGroups = addressGroups.filter((a) => !a.changeAddresses);
            }
        }

        const FilterAndSortingOptions = () => (
            <View style={styles.filterContainer}>
                <View style={styles.searchContainer}>
                    <TextInput
                        ref={this.searchInputRef}
                        style={[
                            styles.searchInput,
                            {
                                backgroundColor: themeColor('secondary'),
                                color: themeColor('text')
                            }
                        ]}
                        placeholder={localeString('general.search')}
                        placeholderTextColor={themeColor('secondaryText')}
                        defaultValue={searchText}
                        onChangeText={(text) => {
                            this.localSearchText = text;
                        }}
                        onSubmitEditing={this.handleSearchSubmit}
                        underlineColorAndroid="transparent"
                        returnKeyType="search"
                        blurOnSubmit={false}
                        autoCapitalize="none"
                    />
                </View>

                <DropdownSetting
                    title={localeString('general.sorting')}
                    values={Object.keys(SortBy).map((s) => ({
                        key: s,
                        translateKey: `views.AddressPicker.sortBy.${s}`,
                        value: s
                    }))}
                    selectedValue={sortBy}
                    onValueChange={(value) =>
                        this.setState({ sortBy: value as SortBy })
                    }
                />

                <View style={styles.filterButtons}>
                    <TouchableHighlight
                        activeOpacity={0.7}
                        style={[
                            styles.filterButton,
                            { backgroundColor: themeColor('secondary') }
                        ]}
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
                                color={hideZeroBalance ? 'highlight' : 'text'}
                            >
                                {localeString(
                                    'views.OnChainAddresses.hideZeroBalanance'
                                )}
                            </Body>
                        </View>
                    </TouchableHighlight>

                    <TouchableHighlight
                        activeOpacity={0.7}
                        style={[
                            styles.filterButton,
                            { backgroundColor: themeColor('secondary') }
                        ]}
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
                                    hideChangeAddresses ? 'highlight' : 'text'
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

        return (
            <Screen>
                <Header
                    leftComponent={{
                        icon: 'arrow-back',
                        color: themeColor('text'),
                        onPress: this.handleBackPress
                    }}
                    centerComponent={{
                        text: localeString(
                            'views.Settings.SignMessage.selectAddress'
                        ),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />

                <View style={styles.container}>
                    {loading ? (
                        <LoadingIndicator />
                    ) : (
                        <>
                            <FilterAndSortingOptions />

                            {addressGroups.length > 0 ? (
                                <FlatList
                                    data={addressGroups}
                                    renderItem={this.renderAddressGroup}
                                    keyExtractor={(_item, index) =>
                                        `group-${index}`
                                    }
                                />
                            ) : (
                                <Text
                                    style={{
                                        color: themeColor('text'),
                                        textAlign: 'center',
                                        marginTop: 20
                                    }}
                                >
                                    {searchText
                                        ? localeString(
                                              'general.noSearchResults'
                                          )
                                        : localeString(
                                              'views.Settings.SignMessage.noAddressesAvailable'
                                          )}
                                </Text>
                            )}
                        </>
                    )}

                    <View style={styles.buttonContainer}>
                        <Button
                            title={localeString('general.confirm')}
                            onPress={this.confirmSelection}
                            disabled={!selectedAddress}
                        />
                    </View>
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 10
    },
    buttonContainer: {
        padding: 20
    },
    text: {
        fontFamily: 'PPNeueMontreal-Book'
    },
    filterContainer: {
        marginBottom: 15
    },
    searchContainer: {
        marginBottom: 10
    },
    searchInput: {
        height: 40,
        borderRadius: 10,
        paddingHorizontal: 10,
        fontFamily: 'PPNeueMontreal-Book'
    },
    filterButtons: {
        flexDirection: 'row',
        marginTop: 10
    },
    filterButton: {
        paddingHorizontal: 15,
        paddingVertical: 6,
        marginHorizontal: 3,
        borderRadius: 20
    }
});
