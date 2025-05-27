import * as React from 'react';
import {
    FlatList,
    StyleSheet,
    View,
    Text,
    TouchableHighlight
} from 'react-native';
import { ListItem, SearchBar } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { chain } from 'lodash';

import Amount from './Amount';
import Button from './Button';
import Header from './Header';
import LoadingIndicator from './LoadingIndicator';
import Screen from './Screen';
import DropdownSetting from './DropdownSetting';
import { Body } from './text/Body';
import { Row } from './layout/Row';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';
import AddressUtils from '../utils/AddressUtils';

import MessageSignStore from '../stores/MessageSignStore';

import CaretDown from '../assets/images/SVG/Caret Down.svg';
import CaretRight from '../assets/images/SVG/Caret Right.svg';

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
    allAddressGroups: AddressGroup[]; // Store all address groups
    filteredAddressGroups: AddressGroup[]; // Store filtered address groups for display
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
    private searchInputRef = React.createRef<any>();
    private localSearchText = '';

    state = {
        selectedAddress: this.props.selectedAddress || '',
        collapsedGroups: {} as Record<string, boolean>,
        searchText: '',
        hideZeroBalance: false,
        hideChangeAddresses: false,
        sortBy: SortBy.balanceDescending,
        allAddressGroups: [],
        filteredAddressGroups: []
    };

    componentDidMount() {
        const { MessageSignStore } = this.props;
        const { route } = this.props;

        // If an address was selected and passed via navigation params, use it
        const selectedAddress =
            route?.params?.selectedAddress || this.props.selectedAddress || '';

        this.setState({
            selectedAddress
        });

        if (MessageSignStore.addresses.length === 0) {
            MessageSignStore.loadAddresses();
        }
    }

    // Process addresses and update address groups when addresses are loaded or filters change
    static getDerivedStateFromProps(
        props: AddressPickerProps,
        state: AddressPickerState
    ) {
        const { addresses } = props.MessageSignStore;
        const { hideZeroBalance, hideChangeAddresses, sortBy, searchText } =
            state;

        if (!addresses || addresses.length === 0) {
            return null;
        }

        // Process and sort addresses based on current sort setting
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

        // Group addresses by account and type
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

        // Create address groups
        let addressGroups = Object.entries(groupedAddresses).map(
            ([key, addrGroup]) => {
                const [accountName, addressType, isInternalStr] =
                    key.split(';');
                return {
                    accountName:
                        accountName ||
                        localeString('general.defaultNodeNickname'),
                    addressType: addressType || localeString('general.unknown'),
                    changeAddresses: isInternalStr === 'true',
                    addresses: addrGroup
                };
            }
        );

        // Apply zero balance filter
        if (hideZeroBalance) {
            addressGroups.forEach((acc) => {
                acc.addresses = acc.addresses.filter(
                    (addr: any) => addr.balance && Number(addr.balance) > 0
                );
            });
            // Remove empty groups after filtering
            addressGroups = addressGroups.filter(
                (group) => group.addresses.length > 0
            );
        }

        // Apply change addresses filter
        if (hideChangeAddresses) {
            addressGroups = addressGroups.filter((a) => !a.changeAddresses);
        }

        // Store these as the complete set of address groups
        const allAddressGroups = addressGroups;

        // Now filter by search text if needed
        let filteredAddressGroups = [...allAddressGroups];
        if (searchText) {
            filteredAddressGroups = allAddressGroups
                .map((group) => {
                    const filteredGroup = { ...group };
                    filteredGroup.addresses = group.addresses.filter(
                        (addr) =>
                            addr.address
                                .toLowerCase()
                                .includes(searchText.toLowerCase()) ||
                            (addr.accountName &&
                                addr.accountName
                                    .toLowerCase()
                                    .includes(searchText.toLowerCase()))
                    );
                    return filteredGroup;
                })
                .filter((group) => group.addresses.length > 0);
        }

        return {
            allAddressGroups,
            filteredAddressGroups
        };
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

    // Update search text as the user types and filter results immediately
    updateSearch = (text: string) => {
        this.setState({ searchText: text });
        // The filtering now happens automatically in getDerivedStateFromProps
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
                        <Row>
                            <View style={{ marginRight: 10 }}>
                                {!isCollapsed ? (
                                    <CaretDown
                                        fill={themeColor('text')}
                                        width="30"
                                        height="30"
                                    />
                                ) : (
                                    <CaretRight
                                        fill={themeColor('text')}
                                        width="30"
                                        height="30"
                                    />
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
                        </Row>
                    </ListItem.Content>
                </ListItem>

                {!isCollapsed &&
                    item.addresses.map((address: Address) => {
                        const isSelected = address.address === selectedAddress;
                        return (
                            <ListItem
                                key={`address-${address.address}`}
                                containerStyle={{
                                    borderBottomWidth: 0,
                                    backgroundColor: isSelected
                                        ? themeColor('secondary') // Use secondary color for better contrast
                                        : 'transparent'
                                }}
                                onPress={() =>
                                    this.selectAddress(address.address)
                                }
                            >
                                <ListItem.Content>
                                    {address.balance !== undefined && (
                                        <Amount
                                            sats={address.balance}
                                            sensitive
                                            colorOverride={
                                                isSelected
                                                    ? themeColor('highlight')
                                                    : undefined
                                            }
                                        />
                                    )}
                                    <ListItem.Subtitle
                                        style={{
                                            color: isSelected
                                                ? themeColor('highlight')
                                                : themeColor('secondaryText'),
                                            fontSize: 14
                                        }}
                                    >
                                        {address.address}
                                    </ListItem.Subtitle>
                                </ListItem.Content>
                            </ListItem>
                        );
                    })}
            </React.Fragment>
        );
    };

    render() {
        const { MessageSignStore, navigation } = this.props;
        const { loading } = MessageSignStore;
        const {
            selectedAddress,
            searchText,
            hideZeroBalance,
            hideChangeAddresses,
            sortBy,
            filteredAddressGroups
        } = this.state;

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
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
                    {!loading && (
                        <SearchBar
                            ref={this.searchInputRef}
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
                                importantForAccessibility:
                                    'no-hide-descendants',
                                accessibilityElementsHidden: true
                            }}
                        />
                    )}

                    <View style={styles.container}>
                        {loading ? (
                            <LoadingIndicator />
                        ) : (
                            <>
                                <View>
                                    <DropdownSetting
                                        title={localeString('general.sorting')}
                                        values={Object.keys(SortBy).map(
                                            (s) => ({
                                                key: s,
                                                translateKey: `views.AddressPicker.sortBy.${s}`,
                                                value: s
                                            })
                                        )}
                                        selectedValue={sortBy}
                                        onValueChange={(value) =>
                                            this.setState({
                                                sortBy: value as SortBy
                                            })
                                        }
                                    />

                                    <View style={styles.filterButtons}>
                                        <TouchableHighlight
                                            activeOpacity={0.7}
                                            style={[
                                                styles.filterButton,
                                                {
                                                    backgroundColor:
                                                        themeColor('secondary')
                                                }
                                            ]}
                                            underlayColor={themeColor(
                                                'disabled'
                                            )}
                                            onPress={() =>
                                                this.setState({
                                                    hideZeroBalance:
                                                        !hideZeroBalance
                                                })
                                            }
                                        >
                                            <View>
                                                <Body
                                                    small
                                                    bold
                                                    color={
                                                        hideZeroBalance
                                                            ? 'highlight'
                                                            : 'text'
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
                                            style={[
                                                styles.filterButton,
                                                {
                                                    backgroundColor:
                                                        themeColor('secondary')
                                                }
                                            ]}
                                            underlayColor={themeColor(
                                                'disabled'
                                            )}
                                            onPress={() =>
                                                this.setState({
                                                    hideChangeAddresses:
                                                        !hideChangeAddresses
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

                                {filteredAddressGroups.length > 0 ? (
                                    <FlatList
                                        data={filteredAddressGroups}
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
                            {!loading && filteredAddressGroups.length > 0 && (
                                <Button
                                    title={localeString('general.confirm')}
                                    onPress={this.confirmSelection}
                                    disabled={!selectedAddress}
                                />
                            )}
                        </View>
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
        padding: 10
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
        marginTop: 10,
        marginBottom: 10
    },
    filterButton: {
        paddingHorizontal: 15,
        paddingVertical: 6,
        marginHorizontal: 3,
        borderRadius: 20
    }
});
