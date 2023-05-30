import * as React from 'react';
import { Keyboard, View, TextInput } from 'react-native';
import EncryptedStorage from 'react-native-encrypted-storage';
import { inject, observer } from 'mobx-react';

import Header from '../components/Header';
import Screen from '../components/Screen';
import Button from '../components/Button';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import NotesStore from '../stores/NotesStore';

interface AddNotesProps {
    navigation: any;
    NotesStore: NotesStore;
}
interface AddNotesState {
    notes?: string;
    payment_hash?: string;
    txid?: string;
    RPreimage?: string;
    isNoteStored?: boolean;
}

@inject('NotesStore')
@observer
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
        const RPreimage: string = this.props.navigation.getParam(
            'getRPreimage',
            null
        );

        this.state = {
            notes: '',
            payment_hash,
            txid,
            RPreimage,
            isNoteStored: false
        };
    }
    async componentDidMount() {
        const key: string =
            'note-' +
            (this.state.txid ||
                this.state.payment_hash ||
                this.state.RPreimage);
        const storedNotes = await EncryptedStorage.getItem(key);
        if (storedNotes) {
            this.setState({ notes: storedNotes, isNoteStored: true });
        }
    }

    render() {
        const { navigation, NotesStore } = this.props;
        const { storeNoteKeys, removeNoteKeys } = NotesStore;
        const { payment_hash, txid, RPreimage, isNoteStored } = this.state;
        const { notes } = this.state;
        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: isNoteStored
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
                            if (!text) {
                                const key: string =
                                    'note-' +
                                    (payment_hash || txid || RPreimage);
                                removeNoteKeys(key);
                            }
                        }}
                        multiline
                        numberOfLines={0}
                        style={{ fontSize: 20, color: themeColor('text') }}
                        value={notes}
                        placeholder={localeString('views.Payment.writeNote')}
                        onSubmitEditing={() => Keyboard.dismiss()}
                    />
                </View>
                <Button
                    title={
                        isNoteStored
                            ? localeString('views.SendingLightning.UpdateNote')
                            : localeString('views.SendingLightning.AddANote')
                    }
                    onPress={async () => {
                        const key: string =
                            'note-' + (payment_hash || txid || RPreimage);
                        await EncryptedStorage.setItem(key, notes);
                        await storeNoteKeys(key, notes);
                        navigation.goBack();
                    }}
                    containerStyle={{ position: 'absolute', bottom: 40 }}
                    buttonStyle={{ padding: 15 }}
                />
            </Screen>
        );
    }
}
