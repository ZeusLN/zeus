import * as React from 'react';
import { View, Dimensions } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';

import ModalBox from './ModalBox';
import ToggleButton from './ToggleButton';
import CurrencyList from './CurrencyList';
import CurrencyConverterContent from './CurrencyConverterContent';

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
    private converterRef = React.createRef<CurrencyConverterContent>();
    private focusListener: any = null;
    private pendingReopen = false;

    constructor(props: CurrencySelectorModalProps) {
        super(props);
        this.state = {
            activeTab: 'currencies'
        };
    }

    componentDidMount() {
        const { navigation } = this.props;
        if (navigation) {
            this.focusListener = navigation.addListener('focus', () => {
                if (this.pendingReopen) {
                    this.pendingReopen = false;
                    this.open();
                }
            });
        }
    }

    componentWillUnmount() {
        if (this.focusListener) {
            this.focusListener();
        }
    }

    open = () => {
        this.modalRef.current?.open();
        this.converterRef.current?.refresh();
    };

    close = () => {
        this.modalRef.current?.close();
    };

    handleClose = () => {
        // Don't reset tab or call onClose if we're about to reopen
        if (this.pendingReopen) return;
        const { onClose } = this.props;
        if (onClose) onClose();
        this.setState({ activeTab: 'currencies' });
    };

    handleTabToggle = (key: string) => {
        this.setState({ activeTab: key as 'currencies' | 'converter' });
        if (key === 'converter') {
            this.converterRef.current?.refresh();
        }
    };

    handleCurrencySelect = (_currency: string, _type: 'unit' | 'fiat') => {
        this.close();
    };

    handleConverterNavigateAway = () => {
        this.pendingReopen = true;
        this.close();
    };

    render() {
        const { navigation } = this.props;
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
                        {activeTab === 'currencies' && (
                            <CurrencyList
                                onSelect={this.handleCurrencySelect}
                            />
                        )}
                        {activeTab === 'converter' && navigation && (
                            <CurrencyConverterContent
                                ref={this.converterRef}
                                navigation={navigation}
                                fromModal
                                onNavigateAway={
                                    this.handleConverterNavigateAway
                                }
                            />
                        )}
                    </View>
                </View>
            </ModalBox>
        );
    }
}
