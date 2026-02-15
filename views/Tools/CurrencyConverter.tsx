import * as React from 'react';
import { TouchableOpacity } from 'react-native';

import { observer, inject } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import Screen from '../../components/Screen';
import Header from '../../components/Header';
import CurrencyConverterContent from '../../components/CurrencyConverterContent';
import { Row } from '../../components/layout/Row';

import { themeColor } from '../../utils/ThemeUtils';
import { localeString } from '../../utils/LocaleUtils';

import FiatStore from '../../stores/FiatStore';

import Add from '../../assets/images/SVG/Add.svg';
import Checkmark from '../../assets/images/SVG/Checkmark.svg';
import Edit from '../../assets/images/SVG/Pen.svg';

interface CurrencyConverterProps {
    navigation: StackNavigationProp<any, any>;
    FiatStore?: FiatStore;
    route: Route<'CurrencyConverter', { selectedCurrency: string }>;
}

interface CurrencyConverterState {
    editMode: boolean;
    inputValuesCount: number;
}

@inject('FiatStore')
@observer
export default class CurrencyConverter extends React.Component<
    CurrencyConverterProps,
    CurrencyConverterState
> {
    private contentRef = React.createRef<CurrencyConverterContent>();

    constructor(props: CurrencyConverterProps) {
        super(props);
        this.state = {
            editMode: false,
            inputValuesCount: 2
        };
    }

    componentDidMount() {
        const selectedCurrency = this.props.route.params?.selectedCurrency;
        if (selectedCurrency) {
            this.contentRef.current?.addCurrency(selectedCurrency);
        }
    }

    componentDidUpdate(prevProps: CurrencyConverterProps) {
        const selectedCurrency = this.props.route.params?.selectedCurrency;
        const prevSelectedCurrency = prevProps.route.params?.selectedCurrency;

        if (selectedCurrency && selectedCurrency !== prevSelectedCurrency) {
            this.contentRef.current?.addCurrency(selectedCurrency);
            this.props.navigation.setParams({ selectedCurrency: null });
        }
    }

    handleToggleEditMode = () => {
        this.contentRef.current?.toggleEditMode();
        this.setState((prev) => ({ editMode: !prev.editMode }));
    };

    handleAddPress = () => {
        this.props.navigation.navigate('SelectCurrency', {
            currencyConverter: true
        });
    };

    handleInputValuesChanged = (count: number) => {
        if (count !== this.state.inputValuesCount) {
            this.setState({ inputValuesCount: count });
        }
    };

    render() {
        const { navigation } = this.props;
        const { editMode, inputValuesCount } = this.state;

        const AddButton = () => (
            <TouchableOpacity
                onPress={this.handleAddPress}
                accessibilityLabel={localeString('general.add')}
            >
                <Add
                    fill={themeColor('text')}
                    width="30"
                    height="30"
                    style={{
                        alignSelf: 'center',
                        marginLeft: 8,
                        marginTop: -4
                    }}
                />
            </TouchableOpacity>
        );

        const EditButton = () => (
            <TouchableOpacity onPress={this.handleToggleEditMode}>
                {editMode ? (
                    <Checkmark
                        width={30}
                        height={30}
                        style={{
                            alignSelf: 'center',
                            marginTop: -4,
                            marginRight: 4
                        }}
                    />
                ) : (
                    <Edit
                        fill={themeColor('text')}
                        style={{
                            alignSelf: 'center',
                            marginTop: -4,
                            marginRight: 4
                        }}
                    />
                )}
            </TouchableOpacity>
        );

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    rightComponent={
                        <Row>
                            {inputValuesCount > 2 && <EditButton />}
                            <AddButton />
                        </Row>
                    }
                    centerComponent={{
                        text: localeString(
                            'views.Settings.CurrencyConverter.title'
                        ),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />
                <CurrencyConverterContent
                    ref={this.contentRef}
                    navigation={navigation}
                    showToolbar={false}
                    onInputValuesChanged={this.handleInputValuesChanged}
                />
            </Screen>
        );
    }
}
