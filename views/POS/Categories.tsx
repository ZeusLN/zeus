import * as React from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import { ListItem, SearchBar } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import Header from '../../components/Header';
import LoadingIndicator from '../../components/LoadingIndicator';
import Screen from '../../components/Screen';

import InventoryStore from '../../stores/InventoryStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import ProductCategory from '../../models/ProductCategory';

import AddIcon from '../../assets/images/SVG/Add.svg';

interface ProductCategoriesProps {
    navigation: any;
    InventoryStore: InventoryStore;
}

interface ProductCategoriesState {
    search: string;
    categories: Array<ProductCategory>;
    loading: boolean;
}

@inject('InventoryStore')
@observer
export default class ProductCategories extends React.Component<
    ProductCategoriesProps,
    ProductCategoriesState
> {
    state = {
        search: '',
        categories: [],
        loading: true
    };

    async componentDidMount() {
        this.props.navigation.addListener('didFocus', async () => {
            this.loadCategories();
        });
    }

    async loadCategories() {
        const { InventoryStore } = this.props;
        const { getInventory } = InventoryStore;
        const { categories } = await getInventory();

        this.setState({
            categories: categories
                ? categories.sort((a, b) => a.name.localeCompare(b.name))
                : [],
            loading: false
        });

        return categories;
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

        const categories = await this.loadCategories();

        const result = categories.filter((item: ProductCategory) =>
            item.name.toLowerCase().includes(value.toLowerCase())
        );
        this.setState({ categories: result });
    };

    render() {
        const { navigation } = this.props;
        const { categories, search, loading } = this.state;

        const Add = ({ navigation }: { navigation: any }) => (
            <TouchableOpacity
                onPress={() => navigation.navigate('ProductCategoryDetails')}
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
                            text: localeString('views.Settings.POS.Categories'),
                            style: { color: themeColor('text') }
                        }}
                        rightComponent={<Add navigation={navigation} />}
                        navigation={navigation}
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
                    {!loading && categories?.length > 0 && (
                        <FlatList
                            data={categories}
                            renderItem={({
                                item
                            }: {
                                item: ProductCategory;
                            }) => (
                                <ListItem
                                    containerStyle={{
                                        borderBottomWidth: 0,
                                        backgroundColor: 'transparent'
                                    }}
                                    onPress={async () => {
                                        navigation.navigate(
                                            'ProductCategoryDetails',
                                            { categoryId: item.id }
                                        );
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
                            keyExtractor={(item: ProductCategory, index) =>
                                `${item.id}-${index}`
                            }
                            ItemSeparatorComponent={this.renderSeparator}
                        />
                    )}
                    {!loading && categories.length === 0 && (
                        <Text
                            style={{
                                color: themeColor('secondaryText'),
                                fontFamily: 'PPNeueMontreal-Book',
                                alignSelf: 'center',
                                marginTop: 20
                            }}
                        >
                            {localeString(
                                'views.Settings.POS.Category.noCategoriesDefined'
                            )}
                        </Text>
                    )}
                </View>
            </Screen>
        );
    }
}
