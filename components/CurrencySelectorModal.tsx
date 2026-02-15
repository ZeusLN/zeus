import * as React from 'react';
import { View, Dimensions } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';

import ModalBox from './ModalBox';
import ToggleButton from './ToggleButton';
import CurrencyList from './CurrencyList';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface CurrencySelectorModalProps {
    navigation?: StackNavigationProp<any, any>;
    onClose?: () => void;
}

interface CurrencySelectorModalState {
    activeTab: 'currencies' | 'converter';
}

export default class CurrencySelectorModal extends React.Component<
    CurrencySelectorModalProps,
    CurrencySelectorModalState
> {
    private modalRef = React.createRef<ModalBox>();

    constructor(props: CurrencySelectorModalProps) {
        super(props);
        this.state = {
            activeTab: 'currencies'
        };
    }

    open = () => {
        this.modalRef.current?.open();
    };

    close = () => {
        this.modalRef.current?.close();
    };

    handleClose = () => {
        const { onClose } = this.props;
        if (onClose) onClose();
        this.setState({ activeTab: 'currencies' });
    };

    handleTabToggle = (key: string) => {
        if (key === 'converter') {
            // Navigate to the existing CurrencyConverter screen
            const { navigation } = this.props;
            if (navigation) {
                this.close();
                navigation.navigate('CurrencyConverter');
            }
        } else {
            this.setState({ activeTab: key as 'currencies' | 'converter' });
        }
    };

    handleCurrencySelect = (_currency: string, _type: 'unit' | 'fiat') => {
        this.close();
    };

    render() {
        const { activeTab } = this.state;

        const TAB_OPTIONS = [
            {
                key: 'currencies',
                label: localeString('views.Settings.Currency.title')
            },
            {
                key: 'converter',
                label: localeString('views.Settings.CurrencyConverter.title')
            }
        ];

        return (
            <ModalBox
                ref={this.modalRef}
                style={{
                    height: SCREEN_HEIGHT * 0.9,
                    backgroundColor: themeColor('background'),
                    borderTopLeftRadius: 20,
                    borderTopRightRadius: 20
                }}
                swipeToClose={true}
                swipeArea={60}
                backButtonClose={true}
                backdropPressToClose={true}
                backdrop={true}
                position="bottom"
                onClosed={this.handleClose}
                coverScreen={true}
            >
                <View style={{ flex: 1, paddingTop: 8 }}>
                    <View
                        style={{
                            width: 40,
                            height: 4,
                            backgroundColor: themeColor('secondaryText'),
                            borderRadius: 2,
                            alignSelf: 'center',
                            marginBottom: 16
                        }}
                    />

                    <ToggleButton
                        options={TAB_OPTIONS}
                        value={activeTab}
                        onToggle={this.handleTabToggle}
                    />

                    <View style={{ flex: 1, marginTop: 16 }}>
                        <CurrencyList onSelect={this.handleCurrencySelect} />
                    </View>
                </View>
            </ModalBox>
        );
    }
}
