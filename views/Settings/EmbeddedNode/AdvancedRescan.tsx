import * as React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import Button from '../../../components/Button';
import Header from '../../../components/Header';
import LoadingIndicator from '../../../components/LoadingIndicator';
import Screen from '../../../components/Screen';
import TextInput from '../../../components/TextInput';
import { ErrorMessage } from '../../../components/SuccessErrorMessage';

import { localeString } from '../../../utils/LocaleUtils';
import { themeColor } from '../../../utils/ThemeUtils';

import NodeInfoStore from '../../../stores/NodeInfoStore';
import UTXOsStore from '../../../stores/UTXOsStore';

interface EmbeddedNodeAdvancedRescanSettingsProps {
    navigation: StackNavigationProp<any, any>;
    NodeInfoStore: NodeInfoStore;
    UTXOsStore: UTXOsStore;
}

interface EmbeddedNodeAdvancedRescanSettingsState {
    blockHeight: string;
}

@inject('NodeInfoStore', 'UTXOsStore')
@observer
export default class EmbeddedNodeAdvancedRescanSettings extends React.Component<
    EmbeddedNodeAdvancedRescanSettingsProps,
    EmbeddedNodeAdvancedRescanSettingsState
> {
    state = {
        blockHeight: ''
    };

    UNSAFE_componentWillMount() {
        const { NodeInfoStore } = this.props;
        const { nodeInfo } = NodeInfoStore;

        this.setState({
            blockHeight: nodeInfo?.block_height?.toString() || '0'
        });
    }

    render() {
        const { navigation, UTXOsStore } = this.props;
        const { blockHeight } = this.state;
        const { rescanErrorMsg, attemptingRescan } = UTXOsStore;

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString(
                                'views.Settings.EmbeddedNode.AdvancedRescan.title'
                            ),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }
                        }}
                        navigation={navigation}
                    />
                    <ScrollView>
                        <View style={{ margin: 10 }}>
                            {attemptingRescan && <LoadingIndicator />}
                            {rescanErrorMsg && (
                                <ErrorMessage message={rescanErrorMsg} />
                            )}
                            <>
                                <Text
                                    style={{
                                        fontFamily: 'PPNeueMontreal-Book',
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {localeString(
                                        'views.Transaction.blockHeight'
                                    )}
                                </Text>
                                <TextInput
                                    placeholder={'481824'}
                                    value={blockHeight}
                                    onChangeText={(text: string) =>
                                        this.setState({ blockHeight: text })
                                    }
                                    keyboardType="numeric"
                                />
                            </>
                            <>
                                <View style={{ marginTop: 20 }}>
                                    <Button
                                        title={localeString(
                                            'views.Settings.EmbeddedNode.AdvancedRescan.start'
                                        )}
                                        onPress={() => {
                                            UTXOsStore.rescan(
                                                Number(blockHeight)
                                            ).then(() => {
                                                if (!rescanErrorMsg)
                                                    navigation.navigate(
                                                        'Wallet'
                                                    );
                                            });
                                        }}
                                    />
                                </View>
                            </>
                        </View>
                    </ScrollView>
                </View>
            </Screen>
        );
    }
}
