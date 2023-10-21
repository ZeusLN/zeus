import * as React from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    View,
    StyleSheet,
    TouchableOpacity
} from 'react-native';
import ProductCategory from '../../models/ProductCategory';
import InventoryStore from '../../stores/InventoryStore';
import { inject, observer } from 'mobx-react';
import { v4 as uuidv4 } from 'uuid';
import { Divider, Icon } from 'react-native-elements';

import Button from '../../components/Button';
import Header from '../../components/Header';
import Screen from '../../components/Screen';
import LoadingIndicator from '../../components/LoadingIndicator';
import TextInput from '../../components/TextInput';

import { themeColor } from '../../utils/ThemeUtils';
import { localeString } from '../../utils/LocaleUtils';

import DeleteIcon from '../../assets/images/SVG/Delete.svg';
import PosStore from '../../stores/PosStore';

interface ProductCategoryProps {
    navigation: any;
    InventoryStore: InventoryStore;
    PosStore: PosStore;
}

interface ProductCategoryState {
    category: ProductCategory | null;
    isLoading: boolean;
    isExisting: boolean;
    confirmDelete: boolean;
}

@inject('InventoryStore', 'PosStore')
@observer
export default class ProductCategoryDetails extends React.Component<
    ProductCategoryProps,
    ProductCategoryState
> {
    constructor(props: ProductCategoryProps) {
        super(props);
        this.state = {
            category: null,
            isLoading: true,
            isExisting: false,
            confirmDelete: false
        };
    }

    componentDidMount() {
        this.fetchCategory();
    }

    fetchCategory = async () => {
        this.props.navigation.addListener('didFocus', async () => {
            try {
                const categoryId = this.props.navigation.getParam(
                    'categoryId',
                    null
                );

                if (!categoryId) {
                    this.setState({
                        category: new ProductCategory({
                            id: uuidv4(),
                            name: ''
                        }),
                        isLoading: false,
                        isExisting: false
                    });
                    return;
                }

                const { InventoryStore } = this.props;
                const { getInventory } = InventoryStore;
                const { categories } = await getInventory();

                if (categories) {
                    const category =
                        categories.find(
                            (category: ProductCategory) =>
                                category.id === categoryId
                        ) || null;

                    if (category) {
                        this.setState({
                            category,
                            isLoading: false,
                            isExisting: true
                        });
                    }
                }
            } catch (error) {
                console.log('Error fetching category:', error);
                this.setState({ isLoading: false });
            }
        });
    };

    setName = (name: string) => {
        const { category } = this.state;
        if (category) {
            category.name = name;
            this.setState({ category });
        }
    };

    saveCategory = async () => {
        const { InventoryStore } = this.props;
        const { category } = this.state;
        const { updateCategories } = InventoryStore;

        try {
            if (category) {
                await updateCategories(category);
                this.props.navigation.goBack();
            }
        } catch (error) {
            console.log('Error saving category:', error);
        }
    };

    deleteItem = async () => {
        const { InventoryStore } = this.props;
        const { deleteCategory, deleteProduct, getInventory } = InventoryStore;
        const { category } = this.state;
        const { products } = await getInventory();

        try {
            if (category) {
                const deleteProductIds = products
                    .filter((product) => product.category === category.name)
                    .map((product) => product.id);
                await deleteProduct(deleteProductIds);
                await deleteCategory(category.id);
                this.props.PosStore.clearCurrentOrder();
                this.props.navigation.goBack();
            }
        } catch (error) {
            console.log('Error deleting category:', error);
        }
    };

    confirmDelete = () => {
        this.setState({ confirmDelete: !this.state.confirmDelete });
    };

    render() {
        const { category, isLoading, isExisting } = this.state;
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
                                    'views.Settings.POS.Category'
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
                                            'views.Settings.POS.Category'
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
                                    <TextInput
                                        onChangeText={(text: string) => {
                                            this.setName(text);
                                        }}
                                        value={category?.name}
                                        placeholder={localeString(
                                            'views.Settings.POS.Category.name'
                                        )}
                                        placeholderTextColor={themeColor(
                                            'secondaryText'
                                        )}
                                        style={styles.textInput}
                                        autoCapitalize="none"
                                    />
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
                                                'views.Settings.POS.saveCategory'
                                            )}
                                            onPress={async () => {
                                                this.saveCategory();
                                            }}
                                            containerStyle={{
                                                opacity:
                                                    category?.name !== ''
                                                        ? 1
                                                        : 0.5
                                            }}
                                            disabled={category?.name === ''}
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
        fontFamily: 'Lato-Regular',
        top: 5,
        color: themeColor('text')
    }
});
