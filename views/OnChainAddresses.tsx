import * as React from 'react';
import {
    FlatList,
    TouchableHighlight,
    TouchableOpacity,
    Vibration,
    View
} from 'react-native';
import { Button, ListItem } from 'react-native-elements';
import { observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Clipboard from '@react-native-clipboard/clipboard';

import Amount from './../components/Amount';
import Header from '../components/Header';
import LoadingIndicator from './../components/LoadingIndicator';
import Screen from './../components/Screen';
import { Body } from '../components/text/Body';
import DropdownSetting from '../components/DropdownSetting';

import { localeString } from './../utils/LocaleUtils';
import BackendUtils from './../utils/BackendUtils';
import { themeColor } from './../utils/ThemeUtils';

import Add from '../assets/images/SVG/Add.svg';

interface OnChainAddressesProps {
    navigation: StackNavigationProp<any, any>;
    route: Route<'OnChainAddresses', { account: string }>;
}

interface OnChainAddressesState {
    loading: boolean;
    accounts: Account[];
    hideZeroBalance: boolean;
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

@observer
export default class OnChainAddresses extends React.Component<
    OnChainAddressesProps,
    OnChainAddressesState
> {
    componentDidMount(): void {
        this.loadAddresses();
    }

    private loadAddresses = async () => {
        this.setState({ loading: true });
        const listAddressesResponse = await BackendUtils.listAddresses();
        this.setState({
            accounts: listAddressesResponse.account_with_addresses,
            loading: false
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
        const { navigation } = this.props;
        const { loading, accounts, hideZeroBalance } = this.state ?? {};
        const sortBy = this.state?.sortBy ?? SortBy.creationTimeAscending;

        // todo:
        // group by address.is_internal (1 -> change address)
        // sort by last part of derivation path
        // filter for hiding change addresses

        if (sortBy === SortBy.creationTimeAscending) {
            accounts?.forEach((account) =>
                account.addresses.sort(
                    (a, b) =>
                        a.derivation_path?.localeCompare(b.derivation_path) ??
                        -1
                )
            );
        } else if (sortBy === SortBy.creationTimeDescending) {
            accounts?.forEach((account) =>
                account.addresses.sort(
                    (a, b) =>
                        b.derivation_path?.localeCompare(a.derivation_path) ??
                        -1
                )
            );
        } else if (sortBy === SortBy.balanceAscending) {
            accounts?.forEach((account) =>
                account.addresses.sort(
                    (a, b) => Number(a.balance) - Number(b.balance)
                )
            );
        } else if (sortBy === SortBy.balanceDescending) {
            accounts?.forEach((account) =>
                account.addresses.sort(
                    (a, b) => Number(b.balance) - Number(a.balance)
                )
            );
        }

        let filteredAccounts = accounts
            ? (JSON.parse(JSON.stringify(accounts)) as Account[])
            : undefined;

        if (hideZeroBalance && filteredAccounts) {
            filteredAccounts.forEach(
                (acc) =>
                    (acc.addresses = acc.addresses.filter(
                        (addr) => addr.balance !== '0'
                    ))
            );
            filteredAccounts = filteredAccounts.filter(
                (a) => a.addresses.length > 0
            );
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
                            key: s,
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
                                paddingLeft: 15,
                                paddingRight: 15,
                                paddingTop: 6,
                                paddingBottom: 6,
                                marginLeft: 3,
                                marginRight: 3,
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
                    }
                    navigation={navigation}
                />
                {loading ? (
                    <View style={{ padding: 50 }}>
                        <LoadingIndicator />
                    </View>
                ) : filteredAccounts && filteredAccounts.length > 0 ? (
                    <>
                        <FilterAndSortingButtons />
                        <FlatList
                            data={filteredAccounts}
                            renderItem={({ item: account }) => {
                                return (
                                    <React.Fragment>
                                        <ListItem
                                            containerStyle={{
                                                borderTopWidth: 2,
                                                borderBottomWidth: 1,
                                                borderColor:
                                                    themeColor('secondaryText'),
                                                backgroundColor: 'transparent'
                                            }}
                                        >
                                            <ListItem.Content>
                                                <ListItem.Title
                                                    style={{
                                                        color: themeColor(
                                                            'text'
                                                        ),
                                                        fontSize: 14
                                                    }}
                                                >
                                                    {localeString(
                                                        'general.accountName'
                                                    )}
                                                    : {account.name + '\n'}
                                                    {localeString(
                                                        'general.addressType'
                                                    )}
                                                    : {account.address_type}
                                                </ListItem.Title>
                                            </ListItem.Content>
                                        </ListItem>
                                        {account.addresses.map((address) => (
                                            <ListItem
                                                containerStyle={{
                                                    borderBottomWidth: 0,
                                                    backgroundColor:
                                                        'transparent'
                                                }}
                                                onPress={() => {
                                                    Clipboard.setString(
                                                        address.address
                                                    );
                                                    Vibration.vibrate(50);
                                                }}
                                            >
                                                <ListItem.Content>
                                                    <Amount
                                                        sats={address.balance}
                                                        sensitive
                                                    />
                                                    <ListItem.Subtitle
                                                        right
                                                        style={{
                                                            color: themeColor(
                                                                'secondaryText'
                                                            ),
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
                            }}
                            keyExtractor={(_, index) => `address-${index}`}
                            ItemSeparatorComponent={this.renderSeparator}
                            onEndReachedThreshold={50}
                            refreshing={loading}
                            onRefresh={() => this.loadAddresses()}
                        />
                    </>
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
