import * as React from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    View,
    TextInput
} from 'react-native';
import Clipboard from '@react-native-community/clipboard';
import { inject, observer } from 'mobx-react';
import { Button, CheckBox, Header, Icon } from 'react-native-elements';
import FeeTable from './../components/FeeTable';
import UTXOPicker from './../components/UTXOPicker';

import NodeUriUtils from './../utils/NodeUriUtils';
import RESTUtils from './../utils/RESTUtils';
import { localeString } from './../utils/LocaleUtils';
import { themeColor } from './../utils/ThemeUtils';

import ChannelsStore from './../stores/ChannelsStore';
import SettingsStore from './../stores/SettingsStore';
import FeeStore from './../stores/FeeStore';
import BalanceStore from './../stores/BalanceStore';
import UTXOsStore from './../stores/UTXOsStore';

interface ImportAccountProps {
    exitSetup: any;
    navigation: any;
    ChannelsStore: ChannelsStore;
    BalanceStore: BalanceStore;
    SettingsStore: SettingsStore;
    FeeStore: FeeStore;
    UTXOsStore: UTXOsStore;
}

interface ImportAccountState {
    response: string;
}

@inject(
    'ChannelsStore',
    'SettingsStore',
    'FeeStore',
    'BalanceStore',
    'UTXOsStore'
)
@observer
export default class ImportAccount extends React.Component<
    ImportAccountProps,
    ImportAccountState
> {
    constructor(props: any) {
        super(props);
        const { navigation } = props;
        const qrResponse = navigation.getParam('qrResponse', null);

        this.state = {
            response: qrResponse
        };
    }

    async UNSAFE_componentWillMount() {
        const clipboard = await Clipboard.getString();

        if (NodeUriUtils.isValidNodeUri(clipboard)) {
            this.setState({
                suggestImport: clipboard
            });
        }
    }

    render() {
        const { SettingsStore, UTXOsStore, navigation } = this.props;
        const {
            node_pubkey_string,
            local_funding_amount,
            min_confs,
            host,
            sat_per_byte,
            suggestImport,
            utxoBalance
        } = this.state;

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.goBack()}
                color="#fff"
                underlayColor="transparent"
            />
        );

        return (
            <ScrollView style={styles.scrollView}>
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: 'Import Account',
                        style: { color: themeColor('text') }
                    }}
                    backgroundColor="grey"
                />
                <View style={styles.content}>
                    <Text style={styles.label}>{this.state.response}</Text>
                    <Button
                        title="Scan"
                        onPress={() =>
                            navigation.navigate('ImportAccountQRScanner')
                        }
                    />
                </View>
            </ScrollView>
        );
    }
}

const styles = StyleSheet.create({
    scrollView: {
        flex: 1,
        backgroundColor: themeColor('background'),
        color: themeColor('text')
    },
    textInput: {
        fontSize: 20,
        color: themeColor('text')
    },
    content: {
        paddingTop: 20,
        paddingBottom: 20,
        paddingLeft: 5,
        paddingRight: 5
    },
    label: {
        textDecorationLine: 'underline',
        color: themeColor('text')
    },
    button: {
        paddingTop: 10,
        paddingBottom: 10,
        width: 250,
        alignSelf: 'center'
    },
    clipboardImport: {
        padding: 10,
        backgroundColor: 'rgba(92, 99,216, 1)',
        color: 'white'
    }
});
