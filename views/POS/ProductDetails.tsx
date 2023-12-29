import * as React from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    View,
    StyleSheet,
    TouchableOpacity
} from 'react-native';
import Product, { PricedIn, ProductStatus } from '../../models/Product';
import InventoryStore from '../../stores/InventoryStore';
import UnitsStore from '../../stores/UnitsStore';
import { inject, observer } from 'mobx-react';
import { v4 as uuidv4 } from 'uuid';
import { Divider, Icon, ListItem } from 'react-native-elements';

import Button from '../../components/Button';
import Header from '../../components/Header';
import Screen from '../../components/Screen';
import LoadingIndicator from '../../components/LoadingIndicator';
import TextInput from '../../components/TextInput';
import AmountInput from '../../components/AmountInput';
import Switch from '../../components/Switch';

import { themeColor } from '../../utils/ThemeUtils';
import { localeString } from '../../utils/LocaleUtils';

import DeleteIcon from '../../assets/images/SVG/Delete.svg';
import DropdownSetting from '../../components/DropdownSetting';
import PosStore from '../../stores/PosStore';

interface ProductProps {
    navigation: any;
    InventoryStore: InventoryStore;
    PosStore: PosStore;
    UnitsStore: UnitsStore;
}

interface ProductState {
    categories: Array<any>;
    product: Product | null;
    isLoading: boolean;
    isExisting: boolean;
    confirmDelete: boolean;
}

@inject('InventoryStore', 'PosStore', 'UnitsStore')
@observer
export default class ProductDetails extends React.Component<
    ProductProps,
    ProductState
> {
    constructor(props: ProductProps) {
        super(props);
        this.state = {
            categories: [],
            product: null,
            isLoading: true,
            isExisting: false,
            confirmDelete: false
        };
    }

    componentDidMount() {
        this.fetchProduct();
    }

    fetchProduct = async () => {
        this.props.navigation.addListener('didFocus', async () => {
            try {
                const { InventoryStore } = this.props;
                const { getInventory } = InventoryStore;
                const { products, categories } = await getInventory();

                const mappedCategories = categories
                    ? categories.map((category: any) => ({
                          key: category.name,
                          value: category.name
                      }))
                    : [];
                let categoryOptions: any[] = [
                    {
                        key: 'Uncategorized',
                        value: '',
                        translateKey: 'pos.views.Wallet.PosPane.uncategorized'
                    }
                ];
                categoryOptions = categoryOptions.concat(...mappedCategories);

                const productId = this.props.navigation.getParam(
                    'productId',
                    null
                );

                if (!productId) {
                    this.setState({
                        categories: categoryOptions,
                        product: new Product({
                            id: uuidv4(),
                            name: '',
                            sku: '',
                            pricedIn: PricedIn.Fiat,
                            price: 0,
                            category: '',
                            status: ProductStatus.Active
                        }),
                        isLoading: false,
                        isExisting: false
                    });
                    return;
                }

                if (products) {
                    const product =
                        products.find(
                            (product: Product) => product.id === productId
                        ) || null;

                    if (product) {
                        if (this.props.UnitsStore.units !== product.pricedIn) {
                            // change unit to match product
                            while (
                                this.props.UnitsStore.changeUnits() !==
                                product.pricedIn
                            ) {
                                continue;
                            }
                        }

                        this.setState({
                            categories: categoryOptions,
                            product,
                            isLoading: false,
                            isExisting: true
                        });
                    }
                }
            } catch (error) {
                console.log('Error fetching product:', error);
                this.setState({ isLoading: false });
            }
        });
    };

    setValue = (field: string, value: any) => {
        const { product } = this.state;
        if (product) {
            switch (field) {
                case 'status':
                    value = value
                        ? ProductStatus.Active
                        : ProductStatus.Inactive;
                    break;

                case 'price':
                    if (
                        value === '' ||
                        value === null ||
                        isNaN(parseFloat(value))
                    ) {
                        value = 0;
                    }
                    value = value;
                    break;
            }
            product[field] = value;
            this.setState({ product });
        }
    };

    saveProduct = async () => {
        const { InventoryStore } = this.props;
        const { product } = this.state;
        const { updateProducts } = InventoryStore;

        try {
            if (product) {
                if (product.status === ProductStatus.Inactive)
                    this.props.PosStore.clearCurrentOrder();
                await updateProducts([product]);
                this.props.navigation.goBack();
            }
        } catch (error) {
            console.log('Error saving product:', error);
        }
    };

    deleteItem = async () => {
        const { InventoryStore } = this.props;
        const { deleteProduct } = InventoryStore;
        const { product } = this.state;

        try {
            if (product) {
                await deleteProduct([product.id]);
                this.props.PosStore.clearCurrentOrder();
                this.props.navigation.goBack();
            }
        } catch (error) {
            console.log('Error deleting product:', error);
        }
    };

    confirmDelete = () => {
        this.setState({ confirmDelete: !this.state.confirmDelete });
    };

    isValid = () => {
        const { product } = this.state;

        return product && product?.name !== '' && product.price > 0;
    };

    render() {
        const { product, isLoading, isExisting } = this.state;
        const { navigation } = this.props;

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

        const Delete = () => (
            <TouchableOpacity onPress={() => this.confirmDelete()}>
                <View
                    style={{
                        width: 35,
                        height: 35,
                        borderRadius: 25,
                        backgroundColor: themeColor('delete'),
                        justifyContent: 'center',
                        alignItems: 'center'
                    }}
                >
                    <DeleteIcon
                        width={16}
                        height={16}
                        style={{ alignSelf: 'center' }}
                    />
                </View>
            </TouchableOpacity>
        );

        return (
            <>
                {isLoading ? (
                    <Screen>
                        <Header
                            leftComponent={<BackButton />}
                            centerComponent={{
                                text: localeString(
                                    'views.Settings.POS.Product'
                                ),
                                style: { color: themeColor('text') }
                            }}
                            backgroundColor="none"
                            containerStyle={{
                                borderBottomWidth: 0
                            }}
                        />
                        <View style={{ marginTop: 60 }}>
                            <LoadingIndicator />
                        </View>
                    </Screen>
                ) : (
                    <Screen>
                        <KeyboardAvoidingView
                            style={{
                                flex: 1,
                                backgroundColor: 'transparent'
                            }}
                            behavior={
                                Platform.OS === 'ios' ? 'padding' : undefined
                            }
                        >
                            <ScrollView
                                contentContainerStyle={{
                                    flexGrow: 1
                                }}
                            >
                                <Header
                                    leftComponent={<BackButton />}
                                    centerComponent={{
                                        text: localeString(
                                            'views.Settings.POS.Product'
                                        ),
                                        style: { color: themeColor('text') }
                                    }}
                                    rightComponent={
                                        isExisting ? <Delete /> : undefined
                                    }
                                    backgroundColor="transparent"
                                    containerStyle={{
                                        borderBottomWidth: 0
                                    }}
                                />
                                <View
                                    style={{
                                        padding: Platform.OS === 'ios' ? 8 : 0,
                                        paddingLeft: 15,
                                        paddingRight: 15
                                    }}
                                >
                                    <View>
                                        <TextInput
                                            onChangeText={(text: string) => {
                                                this.setValue('name', text);
                                            }}
                                            value={product?.name}
                                            placeholder={localeString(
                                                'views.Settings.POS.Product.name'
                                            )}
                                            placeholderTextColor={themeColor(
                                                'secondaryText'
                                            )}
                                            style={styles.textInput}
                                            autoCapitalize="none"
                                        />
                                        <TextInput
                                            onChangeText={(text: string) => {
                                                this.setValue('sku', text);
                                            }}
                                            value={product?.sku}
                                            placeholder={localeString(
                                                'views.Settings.POS.Product.sku'
                                            )}
                                            placeholderTextColor={themeColor(
                                                'secondaryText'
                                            )}
                                            style={styles.textInput}
                                            autoCapitalize="none"
                                        />
                                    </View>
                                    <AmountInput
                                        amount={String(
                                            product?.price == 0
                                                ? ''
                                                : product?.price
                                        )}
                                        title={localeString(
                                            'views.Settings.POS.Product.price'
                                        )}
                                        onAmountChange={(
                                            amount: string,
                                            satAmount: string | number
                                        ) => {
                                            const { UnitsStore } = this.props;
                                            let price: string | number;
                                            let pricedIn: PricedIn;
                                            if (UnitsStore.units === 'sats') {
                                                price = satAmount;
                                                pricedIn = PricedIn.Sats;
                                            } else {
                                                price = amount;
                                                pricedIn = PricedIn.Fiat;
                                            }
                                            this.setValue('pricedIn', pricedIn);
                                            this.setValue('price', price);
                                        }}
                                        preventUnitReset={true}
                                    />
                                    <DropdownSetting
                                        title={localeString(
                                            'views.Settings.POS.Category.name'
                                        )}
                                        selectedValue={product?.category ?? ''}
                                        onValueChange={async (
                                            value: string
                                        ) => {
                                            this.setValue('category', value);
                                        }}
                                        values={this.state.categories}
                                    />
                                    <ListItem
                                        containerStyle={{
                                            borderBottomWidth: 0,
                                            backgroundColor: 'transparent'
                                        }}
                                    >
                                        <ListItem.Title
                                            style={{
                                                color: themeColor(
                                                    'secondaryText'
                                                ),
                                                fontFamily:
                                                    'PPNeueMontreal-Book',
                                                left: -10
                                            }}
                                        >
                                            {localeString(
                                                'views.Settings.POS.Product.active'
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
                                                value={
                                                    product?.status ===
                                                    ProductStatus.Inactive
                                                        ? false
                                                        : true
                                                }
                                                onValueChange={async (
                                                    value: boolean
                                                ) => {
                                                    this.setValue(
                                                        'status',
                                                        value
                                                    );
                                                }}
                                            />
                                        </View>
                                    </ListItem>
                                </View>
                                <Divider
                                    orientation="horizontal"
                                    style={{ marginTop: 6 }}
                                />
                                <View
                                    style={{
                                        paddingHorizontal: 20,
                                        paddingVertical: 20
                                    }}
                                >
                                    {this.state.confirmDelete ? (
                                        <Button
                                            title={localeString(
                                                'views.Settings.POS.confirmDelete'
                                            )}
                                            onPress={() => this.deleteItem()}
                                            containerStyle={{
                                                borderColor:
                                                    themeColor('delete')
                                            }}
                                            titleStyle={{
                                                color: themeColor('delete')
                                            }}
                                            secondary
                                        />
                                    ) : (
                                        <Button
                                            title={localeString(
                                                'views.Settings.POS.saveProduct'
                                            )}
                                            onPress={async () => {
                                                this.saveProduct();
                                            }}
                                            containerStyle={{
                                                opacity: this.isValid()
                                                    ? 1
                                                    : 0.5
                                            }}
                                            disabled={!this.isValid()}
                                        />
                                    )}
                                </View>
                            </ScrollView>
                        </KeyboardAvoidingView>
                    </Screen>
                )}
            </>
        );
    }
}

const styles = StyleSheet.create({
    textInput: {
        fontSize: 20,
        width: '100%',
        fontFamily: 'PPNeueMontreal-Book',
        top: 5
    }
});
