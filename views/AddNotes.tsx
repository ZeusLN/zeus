import * as React from 'react';
import EncryptedStorage from 'react-native-encrypted-storage';
import { View, TextInput } from 'react-native';
import TransactionsStore from '../stores/TransactionsStore';
import { inject, observer } from 'mobx-react';

import Header from '../components/Header';
import Screen from '../components/Screen';
import Button from '../components/Button';

import { themeColor } from '../utils/ThemeUtils';

interface AddNotesProps {
    navigation: any;
    TransactionsStore: TransactionsStore;
}
interface AddNotesState {
    notes?: string;
}

@inject('TransactionsStore')
@observer
export default class AddNotes extends React.Component<
    AddNotesProps,
    AddNotesState
> {
    constructor(props: any) {
        super(props);
        this.state = {
            notes: ''
        };
    }

    render() {
        const { navigation, TransactionsStore } = this.props;
        const { payment_hash } = TransactionsStore;
        const { notes } = this.state;
        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: 'Add a note',
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'Lato-Regular',
                            fontSize: 20
                        }
                    }}
                    navigation={navigation}
                />
                <View style={{ padding: 20 }}>
                    <TextInput
                        onChangeText={(text: string) => {
                            this.setState({ notes: text });
                        }}
                        multiline
                        numberOfLines={0}
                        style={{ fontSize: 20 }}
                    />
                </View>
                <Button
                    onPress={async () => {
                        navigation.navigate('SendingLightning');
                        await EncryptedStorage.setItem(payment_hash, notes);
                    }}
                    containerStyle={{ position: 'absolute', bottom: 40 }}
                    buttonStyle={{ padding: 15 }}
                    title="add note"
                />
            </Screen>
        );
    }
}
