import * as React from 'react';
import { View, TextInput } from 'react-native';
import EncryptedStorage from 'react-native-encrypted-storage';

import Header from '../components/Header';
import Screen from '../components/Screen';
import Button from '../components/Button';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

interface AddNotesProps {
    navigation: any;
}
interface AddNotesState {
    notes?: string;
    payment_hash?: string;
    txid?: string;
}

export default class AddNotes extends React.Component<
    AddNotesProps,
    AddNotesState
> {
    constructor(props: any) {
        super(props);
        const payment_hash: string = this.props.navigation.getParam(
            'payment_hash',
            null
        );
        const txid: string = this.props.navigation.getParam('txid', null);

        this.state = {
            notes: '',
            payment_hash,
            txid
        };
    }
    async componentDidMount() {
        const key: any = 'note-' + (this.state.txid || this.state.payment_hash);
        const storedNotes = await EncryptedStorage.getItem(key);
        if (storedNotes) {
            this.setState({ notes: storedNotes });
        }
    }

    render() {
        const { navigation } = this.props;
        const { payment_hash, txid } = this.state;
        const { notes } = this.state;
        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: notes
                            ? localeString('views.SendingLightning.UpdateNote')
                            : localeString('views.SendingLightning.AddANote'),
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
                        style={{ fontSize: 20, color: themeColor('text') }}
                        value={notes}
                    />
                </View>
                <Button
                    title={
                        notes
                            ? localeString('views.SendingLightning.UpdateNote')
                            : localeString('views.SendingLightning.AddANote')
                    }
                    onPress={async () => {
                        navigation.goBack();
                        const key: any = 'note-' + (payment_hash || txid);
                        await EncryptedStorage.setItem(key, notes);
                    }}
                    containerStyle={{ position: 'absolute', bottom: 40 }}
                    buttonStyle={{ padding: 15 }}
                />
            </Screen>
        );
    }
}
