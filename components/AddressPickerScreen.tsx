import * as React from 'react';
import { View } from 'react-native';
import { inject, observer } from 'mobx-react';

import AddressPicker from './AddressPicker';
import MessageSignStore from '../stores/MessageSignStore';

interface AddressPickerScreenProps {
    navigation: any;
    route: any;
    MessageSignStore: MessageSignStore;
}

@inject('MessageSignStore')
@observer
export default class AddressPickerScreen extends React.Component<AddressPickerScreenProps> {
    handleConfirm = (selectedAddress: string) => {
        const { navigation, route } = this.props;
        const { returnToScreen, returnParams = {} } = route?.params || {};

        if (returnToScreen) {
            navigation.navigate({
                name: returnToScreen,
                params: {
                    ...returnParams,
                    selectedAddress,
                    timestamp: Date.now()
                },
                merge: true
            });
        } else {
            navigation.goBack();
        }
    };

    handleBack = () => {
        const { navigation, route } = this.props;
        const { returnToScreen, returnParams = {} } = route?.params || {};

        if (returnToScreen) {
            navigation.navigate({
                name: returnToScreen,
                params: {
                    ...returnParams,
                    timestamp: Date.now()
                },
                merge: true
            });
        } else {
            navigation.goBack();
        }
    };

    render() {
        const { navigation, route, MessageSignStore } = this.props;
        const selectedAddress = route?.params?.selectedAddress || '';

        return (
            <View style={{ flex: 1 }}>
                <AddressPicker
                    navigation={navigation}
                    route={route}
                    MessageSignStore={MessageSignStore}
                    selectedAddress={selectedAddress}
                    onConfirm={this.handleConfirm}
                    onBack={this.handleBack}
                />
            </View>
        );
    }
}
