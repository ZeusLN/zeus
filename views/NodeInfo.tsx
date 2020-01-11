import * as React from 'react';
import {
    StyleSheet,
    ScrollView,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { Button, ButtonGroup, Header, Icon } from 'react-native-elements';
import CollapsedQR from './../components/CollapsedQR';
import SetFeesForm from './../components/SetFeesForm';
import { inject, observer } from 'mobx-react';

import NodeInfoStore from './../stores/NodeInfoStore';
import SettingsStore from './../stores/SettingsStore';

interface NodeInfoProps {
    navigation: any;
    NodeInfoStore: NodeInfoStore;
    SettingsStore: SettingsStore;
}

interface NodeInfoState {
    selectedIndex: number;
}

@inject('NodeInfoStore', 'FeeStore', 'UnitsStore', 'SettingsStore')
@observer
export default class NodeInfo extends React.Component<
    NodeInfoProps,
    NodeInfoState
> {
    state = {
        selectedIndex: 0
    };

    componentWillMount() {
        const { NodeInfoStore, FeeStore } = this.props;
        NodeInfoStore.getNodeInfo();
        FeeStore.getFees();
    }

    updateIndex = (selectedIndex: number) => {
        this.setState({
            selectedIndex
        });
    };

    render() {
        const {
            navigation,
            FeeStore,
            NodeInfoStore,
            UnitsStore,
            SettingsStore
        } = this.props;
        const { selectedIndex } = this.state;
        const { nodeInfo } = NodeInfoStore;
        const { dayEarned, weekEarned, monthEarned } = FeeStore;
        const { changeUnits, getAmount, units } = UnitsStore;
        const { settings } = SettingsStore;
        const { theme } = settings;

        const generalInfoButton = () => (
            <React.Fragment>
                <Text>General Info</Text>
            </React.Fragment>
        );

        const feesButton = () => (
            <React.Fragment>
                <Text>Fee Report</Text>
            </React.Fragment>
        );

        const buttons = [
            { element: generalInfoButton },
            { element: feesButton }
        ];

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.navigate('Wallet')}
                color="#fff"
                underlayColor="transparent"
            />
        );

        const URIs = (props: { uris: Array<string> }) => {
            const items: any = [];

            props.uris.forEach((uri, key) => {
                items.push(
                    <React.Fragment key={key}>
                        <CollapsedQR
                            value={uri}
                            theme={theme}
                            copyText="Copy URI"
                        />
                    </React.Fragment>
                );
            });

            return items;
        };

        const FeeReportView = () => (
            <React.Fragment>
                <TouchableOpacity onPress={() => changeUnits()}>
                    <Text
                        style={
                            theme === 'dark' ? styles.labelDark : styles.label
                        }
                    >
                        Earned today:
                    </Text>
                    <Text
                        style={
                            theme === 'dark' ? styles.valueDark : styles.value
                        }
                    >
                        {units && getAmount(dayEarned)}
                    </Text>

                    <Text
                        style={
                            theme === 'dark' ? styles.labelDark : styles.label
                        }
                    >
                        Earned this week:
                    </Text>
                    <Text
                        style={
                            theme === 'dark' ? styles.valueDark : styles.value
                        }
                    >
                        {units && getAmount(weekEarned)}
                    </Text>

                    <Text
                        style={
                            theme === 'dark' ? styles.labelDark : styles.label
                        }
                    >
                        Earned this month:
                    </Text>
                    <Text
                        style={
                            theme === 'dark' ? styles.valueDark : styles.value
                        }
                    >
                        {units && getAmount(monthEarned)}
                    </Text>
                </TouchableOpacity>

                <SetFeesForm />
            </React.Fragment>
        );

        const NodeInfoView = () => (
            <React.Fragment>
                <Text
                    style={theme === 'dark' ? styles.labelDark : styles.label}
                >
                    Alias:
                </Text>
                <Text
                    style={theme === 'dark' ? styles.valueDark : styles.value}
                >
                    {nodeInfo.alias}
                </Text>

                <Text
                    style={theme === 'dark' ? styles.labelDark : styles.label}
                >
                    Version:
                </Text>
                <Text
                    style={theme === 'dark' ? styles.valueDark : styles.value}
                >
                    {nodeInfo.version}
                </Text>

                {!!nodeInfo.synced_to_chain && (
                    <View>
                        <Text
                            style={
                                theme === 'dark'
                                    ? styles.labelDark
                                    : styles.label
                            }
                        >
                            Synced to Chain:
                        </Text>
                        <Text
                            style={{
                                ...styles.value,
                                color: nodeInfo.synced_to_chain
                                    ? 'green'
                                    : 'red'
                            }}
                        >
                            {nodeInfo.synced_to_chain ? 'True' : 'False'}
                        </Text>
                    </View>
                )}

                <Text
                    style={theme === 'dark' ? styles.labelDark : styles.label}
                >
                    Block Height
                </Text>
                <Text
                    style={theme === 'dark' ? styles.valueDark : styles.value}
                >
                    {nodeInfo.currentBlockHeight}
                </Text>

                {nodeInfo.block_hash && (
                    <View>
                        <Text
                            style={
                                theme === 'dark'
                                    ? styles.labelDark
                                    : styles.label
                            }
                        >
                            Block Hash
                        </Text>
                        <Text
                            style={
                                theme === 'dark'
                                    ? styles.valueDark
                                    : styles.value
                            }
                        >
                            {nodeInfo.block_hash}
                        </Text>
                    </View>
                )}

                <Text
                    style={theme === 'dark' ? styles.labelDark : styles.label}
                >
                    URIs:
                </Text>
                {nodeInfo.getURIs && nodeInfo.getURIs.length > 0 ? (
                    <URIs uris={nodeInfo.getURIs} />
                ) : (
                    <Text style={{ ...styles.value, color: 'red' }}>
                        No URIs available
                    </Text>
                )}
            </React.Fragment>
        );

        return (
            <ScrollView
                style={
                    theme === 'dark'
                        ? styles.darkThemeStyle
                        : styles.lightThemeStyle
                }
            >
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: 'Node Info',
                        style: { color: '#fff' }
                    }}
                    backgroundColor="black"
                />

                <ButtonGroup
                    onPress={this.updateIndex}
                    selectedIndex={selectedIndex}
                    buttons={buttons}
                    selectedButtonStyle={{
                        backgroundColor: 'white'
                    }}
                    containerStyle={{
                        backgroundColor: '#f2f2f2'
                    }}
                />

                <View style={styles.content}>
                    {selectedIndex === 0 && <NodeInfoView />}
                    {selectedIndex === 1 && <FeeReportView />}
                </View>
            </ScrollView>
        );
    }
}

const styles = StyleSheet.create({
    lightThemeStyle: {
        flex: 1
    },
    darkThemeStyle: {
        flex: 1,
        backgroundColor: 'black',
        color: 'white'
    },
    content: {
        paddingLeft: 20,
        paddingRight: 20
    },
    label: {
        paddingTop: 5
    },
    qrPadding: {
        width: 250,
        height: 250,
        backgroundColor: 'white',
        alignItems: 'center',
        paddingTop: 25,
        marginBottom: 10
    },
    value: {
        paddingBottom: 5
    },
    labelDark: {
        paddingTop: 5,
        color: 'white'
    },
    valueDark: {
        paddingBottom: 5,
        color: 'white'
    }
});
