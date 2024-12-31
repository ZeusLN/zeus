import * as React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import Header from '../components/Header';
import Screen from '../components/Screen';
import Button from '../components/Button';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import Storage from '../storage';

import NotesStore from '../stores/NotesStore';
import TextInput from '../components/TextInput';

import SaveIcon from '../assets/images/SVG/Save.svg';

interface AddNotesProps {
    navigation: StackNavigationProp<any, any>;
    NotesStore: NotesStore;
    route: Route<'AddNotes', { noteKey: string }>;
}
interface AddNotesState {
    notes?: string;
    noteKey?: string;
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
        const { noteKey } = this.props.route.params ?? {};

        this.state = {
            notes: '',
            noteKey,
            isNoteStored: false
        };
    }
    async componentDidMount() {
        const { noteKey } = this.state;
        const storedNotes = await Storage.getItem(noteKey!);
        if (storedNotes) {
            this.setState({ notes: storedNotes, isNoteStored: true });
        }
    }

    render() {
        const { navigation, NotesStore } = this.props;
        const { storeNoteKeys, removeNoteKeys } = NotesStore;
        const { noteKey, isNoteStored } = this.state;
        const { notes } = this.state;

        const saveNote = async () => {
            if (noteKey) {
                Storage.setItem(noteKey, notes || '');
                await storeNoteKeys(noteKey, notes || '');
            }

            navigation.goBack();
        };

        const saveButton = () => (
            <TouchableOpacity onPress={() => saveNote()}>
                <SaveIcon
                    stroke={themeColor('text')}
                    fill={themeColor('text')}
                    height={40}
                    width={40}
                />
            </TouchableOpacity>
        );
        return (
            <Screen>
                <View
                    style={{
                        flexDirection: 'column',
                        height: '100%'
                    }}
                >
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: isNoteStored
                                ? localeString(
                                      'views.SendingLightning.UpdateNote'
                                  )
                                : localeString(
                                      'views.SendingLightning.AddANote'
                                  ),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book',
                                fontSize: 20
                            }
                        }}
                        rightComponent={saveButton()}
                        navigation={navigation}
                    />
                    <TextInput
                        onChangeText={(text: string) => {
                            this.setState({ notes: text });
                            if (!text) {
                                removeNoteKeys(noteKey!);
                            }
                        }}
                        multiline
                        numberOfLines={0}
                        style={{
                            padding: 20,
                            flexGrow: 1,
                            flexShrink: 1,
                            backgroundColor: 'none'
                        }}
                        textInputStyle={{
                            height: '100%',
                            textAlignVertical: 'top',
                            marginTop: -13
                        }}
                        value={notes}
                        placeholder={localeString('views.Payment.writeNote')}
                    />
                    <View
                        style={{
                            marginHorizontal: 20,
                            marginBottom: 20,
                            marginTop: 10
                        }}
                    >
                        <Button
                            title={localeString(
                                'views.Settings.SetPassword.save'
                            )}
                            onPress={() => saveNote()}
                            buttonStyle={{
                                padding: 15
                            }}
                        />
                    </View>
                </View>
            </Screen>
        );
    }
}
