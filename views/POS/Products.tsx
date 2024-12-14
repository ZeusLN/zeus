import * as React from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import { ListItem, SearchBar } from 'react-native-elements';
import AddIcon from '../../assets/images/SVG/Add.svg';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import Header from '../../components/Header';
import LoadingIndicator from '../../components/LoadingIndicator';
import Screen from '../../components/Screen';

import InventoryStore from '../../stores/InventoryStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import Product from '../../models/Product';

interface ProductsProps {
    navigation: StackNavigationProp<any, any>;
    InventoryStore: InventoryStore;
}

interface ProductsState {
    search: string;
    products: Array<Product>;
    loading: boolean;
}

@inject('InventoryStore')
@observer
export default class Products extends React.Component<
    ProductsProps,
    ProductsState
> {
    state = {
        search: '',
        products: [],
        loading: true
    };

    async componentDidMount() {
        this.props.navigation.addListener('focus', async () =>
            this.loadProducts()
        );
    }

    async loadProducts() {
        const { InventoryStore } = this.props;
        const { getInventory } = InventoryStore;
        const { products } = await getInventory();

        this.setState({
            products: products
                ? products.sort((a, b) => a.name.localeCompare(b.name))
                : [],
            loading: false
        });

        return products;
    }

    renderSeparator = () => (
        <View
            style={{
                height: 1,
                backgroundColor: themeColor('separator')
            }}
        />
    );

    updateSearch = async (value: string) => {
        this.setState({ search: value });

        const products = await this.loadProducts();

        const result = products.filter((item: Product) =>
            item.name.toLowerCase().includes(value.toLowerCase())
        );
        this.setState({ products: result });
    };

    render() {
        const { navigation } = this.props;
        const { products, search, loading } = this.state;

        const Add = ({
            navigation
        }: {
            navigation: StackNavigationProp<any, any>;
        }) => (
            <TouchableOpacity
                onPress={() => navigation.navigate('ProductDetails')}
            >
                <View
                    style={{
                        width: 35,
                        height: 35,
                        borderRadius: 25,
                        backgroundColor: themeColor('chain'),
                        justifyContent: 'center',
                        alignItems: 'center'
                    }}
                >
                    <AddIcon
                        fill={themeColor('background')}
                        width={16}
                        height={16}
                        style={{ alignSelf: 'center' }}
                    />
                </View>
            </TouchableOpacity>
        );

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString('views.Settings.POS.Products'),
                            style: { color: themeColor('text') }
                        }}
                        rightComponent={<Add navigation={navigation} />}
                        navigation={navigation}
                    />
                    <SearchBar
                        placeholder={localeString('general.search')}
                        // @ts-ignore:next-line
                        onChangeText={this.updateSearch}
                        value={search}
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
                    />
                    {loading && (
                        <View style={{ margin: 20 }}>
                            <LoadingIndicator />
                        </View>
                    )}
                    {!loading && products?.length > 0 && (
                        <FlatList
                            data={products}
                            renderItem={({ item }: { item: Product }) => (
                                <ListItem
                                    containerStyle={{
                                        borderBottomWidth: 0,
                                        backgroundColor: 'transparent'
                                    }}
                                    onPress={async () => {
                                        navigation.navigate('ProductDetails', {
                                            productId: item.id
                                        });
                                    }}
                                >
                                    <ListItem.Content>
                                        <ListItem.Title
                                            style={{
                                                color: themeColor('text')
                                            }}
                                        >
                                            {item.name}
                                        </ListItem.Title>
                                    </ListItem.Content>
                                </ListItem>
                            )}
                            keyExtractor={(item: Product, index) =>
                                `${item.id}-${index}`
                            }
                            ItemSeparatorComponent={this.renderSeparator}
                        />
                    )}
                    {!loading && products.length === 0 && (
                        <Text
                            style={{
                                color: themeColor('secondaryText'),
                                fontFamily: 'PPNeueMontreal-Book',
                                alignSelf: 'center',
                                marginTop: 20
                            }}
                        >
                            {localeString(
                                'views.Settings.POS.Product.noProductsDefined'
                            )}
                        </Text>
                    )}
                </View>
            </Screen>
        );
    }
}
