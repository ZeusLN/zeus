import React, { useState } from 'react';
import {
    FlatList,
    TouchableHighlight,
    TouchableOpacity,
    View
} from 'react-native';
import { Button, ListItem } from 'react-native-elements';
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

import AddressUtils from '../utils/AddressUtils';
import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import UTXOsStore from '../stores/UTXOsStore';

import NavigationService from '../NavigationService';

import Add from '../assets/images/SVG/Add.svg';
import CaretDown from '../assets/images/SVG/Caret Down.svg';
import CaretRight from '../assets/images/SVG/Caret Right.svg';

const AddressGroup = (props: any) => {
    const addressGroup = props.addressGroup;
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
                                    {AddressUtils.snakeToHumanReadable(
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
                    </Row>
                </ListItem.Content>
            </ListItem>
            {!isCollapsed &&
                addressGroup.addresses.map((address: Address) => (
                    <ListItem
                        key={`address-${address.address}`}
                        containerStyle={{
                            borderBottomWidth: 0,
                            backgroundColor: 'transparent'
                        }}
                        onPress={() => {
                            const addressStr = address.address;
                            NavigationService.navigate('QR', {
                                value: `bitcoin:${
                                    addressStr === addressStr.toLowerCase()
                                        ? address.address.toUpperCase()
                                        : address.address
                                }`,
                                copyValue: addressStr
                            });
                        }}
                    >
                        <ListItem.Content>
                            <Amount sats={address.balance} sensitive />
                            <ListItem.Subtitle
                                right
                                style={{
                                    color: themeColor('secondaryText'),
                                    fontSize: 14
                                }}
                            >
                                {address.address}
                            </ListItem.Subtitle>
                        </ListItem.Content>
                    </ListItem>
                ))}
        </React.Fragment>
    );
};

interface OnChainAddressesProps {
    navigation: StackNavigationProp<any, any>;
    route: Route<'OnChainAddresses', { account: string }>;
    UTXOsStore: UTXOsStore;
}

interface OnChainAddressesState {
    accounts: any;
    hideZeroBalance: boolean;
    hideChangeAddresses: boolean;
    sortBy: SortBy;
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
        sortBy: SortBy.balanceDescending
    };

    async componentDidMount() {
        this.props.navigation.addListener('focus', async () => {
            this.loadAddresses();
        });
    }

    loadAddresses = async () => {
        const accounts = await this.props.UTXOsStore.listAddresses();
        this.setState({
            accounts: cloneDeep(accounts)
        });
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
        const { accounts, hideZeroBalance, hideChangeAddresses } =
            this.state ?? {};
        const { loadingAddresses, loadingAddressesError } = UTXOsStore;
        const sortBy = this.state?.sortBy ?? SortBy.creationTimeDescending;

        let addressGroups: AddressGroup[] | undefined;

        if (
            accounts.length > 0 &&
            !loadingAddresses &&
            !loadingAddressesError
        ) {
            if (sortBy === SortBy.creationTimeAscending) {
                accounts?.forEach((account: Account) =>
                    account.addresses.sort(
                        (a, b) =>
                            Number(a.derivation_path.split('/').at(-1)) -
                            Number(b.derivation_path.split('/').at(-1))
                    )
                );
            } else if (sortBy === SortBy.creationTimeDescending) {
                accounts?.forEach((account: Account) =>
                    account.addresses.sort(
                        (a, b) =>
                            Number(b.derivation_path.split('/').at(-1)) -
                            Number(a.derivation_path.split('/').at(-1))
                    )
                );
            } else if (sortBy === SortBy.balanceAscending) {
                accounts?.forEach((account: Account) =>
                    account.addresses.sort(
                        (a, b) => Number(a.balance) - Number(b.balance)
                    )
                );
            } else if (sortBy === SortBy.balanceDescending) {
                accounts?.forEach((account: Account) =>
                    account.addresses.sort(
                        (a, b) => Number(b.balance) - Number(a.balance)
                    )
                );
            }

            addressGroups = chain(
                JSON.parse(JSON.stringify(accounts)) as Account[]
            )
                .flatMap((account) =>
                    account.addresses.map((address) => ({ account, address }))
                )
                .groupBy(
                    (t) =>
                        `${t.account.name};${t.account.address_type};${t.address.is_internal}`
                )
                .map((g) => ({
                    accountName: g[0].account.name,
                    addressType: g[0].account.address_type,
                    changeAddresses: g[0].address.is_internal,
                    addresses: g.map((a) => a.address)
                }))
                .value();

            if (hideZeroBalance) {
                addressGroups.forEach(
                    (acc) =>
                        (acc.addresses = acc.addresses.filter(
                            (addr) => addr.balance && addr.balance !== '0'
                        ))
                );
            }

            if (hideChangeAddresses) {
                addressGroups = addressGroups.filter((a) => !a.changeAddresses);
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
                        onValueChange={(newSortBy) =>
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
                        text: localeString('views.OnChainAddresses.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={
                        !loadingAddresses &&
                        !loadingAddressesError &&
                        !addressGroups ? (
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
                                    <AddressGroup addressGroup={addressGroup} />
                                );
                            }}
                            keyExtractor={(_, index) => `address-${index}`}
                            ItemSeparatorComponent={this.renderSeparator}
                            onEndReachedThreshold={50}
                            refreshing={loadingAddresses}
                            onRefresh={() => this.loadAddresses()}
                        />
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
