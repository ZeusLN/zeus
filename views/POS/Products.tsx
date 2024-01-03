import * as React from 'react';
import { FlatList, TouchableOpacity, View } from 'react-native';
import { Icon, ListItem, SearchBar } from 'react-native-elements';
import AddIcon from '../../assets/images/SVG/Add.svg';
import { inject, observer } from 'mobx-react';

import Header from '../../components/Header';
import Screen from '../../components/Screen';

import InventoryStore from '../../stores/InventoryStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import Product from '../../models/Product';
import LoadingIndicator from '../../components/LoadingIndicator';

interface ProductsProps {
    navigation: any;
    InventoryStore: InventoryStore;
}

interface ProductsState {
    search: string;
    products: Array<Product>;
}

@inject('InventoryStore')
@observer
export default class Products extends React.Component<
    ProductsProps,
    ProductsState
> {
    state = {
        search: '',
        products: []
    };

    async componentDidMount() {
        this.props.navigation.addListener('didFocus', async () => {
            this.loadProducts();
        });
    }

    async loadProducts() {
        const { InventoryStore } = this.props;
        const { getInventory } = InventoryStore;
        const { products } = await getInventory();

        this.setState({
            products: products
                ? products.sort((a, b) => a.name.localeCompare(b.name))
                : []
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
        const { navigation, InventoryStore } = this.props;
        const { products, search } = this.state;
        const { loading } = InventoryStore;

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => {
                    navigation.goBack();
                }}
                color={themeColor('text')}
                underlayColor="transparent"
                size={35}
            />
        );
        const Add = ({ navigation }: { navigation: any }) => (
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
                        leftComponent={<BackButton />}
                        centerComponent={{
                            text: localeString('views.Settings.POS.Products'),
                            style: { color: themeColor('text') }
                        }}
                        rightComponent={<Add navigation={navigation} />}
                    />
                    <SearchBar
                        placeholder={localeString('general.search')}
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
                    {!loading && (
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
                </View>
            </Screen>
        );
    }
}
