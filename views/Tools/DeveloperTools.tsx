import * as React from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    ActivityIndicator
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import Header from '../../components/Header';
import Screen from '../../components/Screen';
import CopyButton from '../../components/CopyButton';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import BackendUtils from '../../utils/BackendUtils';

import SettingsStore, { Implementations } from '../../stores/SettingsStore';

interface DeveloperToolsProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
}

interface DeveloperToolsState {
    expandedCategory: string | null;
    selectedCommand: string | null;
    loading: boolean;
    response: string | null;
    error: string | null;
}

interface CategoryProps {
    title: string;
    commands: DeveloperCommand[];
    selectedCommand: string | null;
    onCommand: (command: string) => Promise<void>;
    expanded: boolean;
    onToggle: () => void;
    implementation: Implementations;
}

interface CommandProps {
    command: string;
    onTap: (command: string, param?: string) => Promise<void>;
    selected: boolean;
    onToggle?: () => void;
    visible?: boolean;
}

interface CommandState {
    subItems?: Array<{ commandParameters: any; label: string }>;
    selectedSubItemIndex?: number;
    loading: boolean;
    expanded: boolean;
}

interface ResponseContainerProps {
    title: string;
    content: string;
    type: 'response' | 'error';
}

interface DeveloperCommand {
    name: string;
    compatibleImplementations: Implementations[];
}

const categories: Array<{
    title: string;
    commands: DeveloperCommand[];
}> = [
    {
        title: 'General',
        commands: [
            {
                name: 'getMyNodeInfo',
                compatibleImplementations: [
                    'lnd',
                    'embedded-lnd',
                    'cln-rest',
                    'lightning-node-connect'
                ]
            },
            {
                name: 'getNetworkInfo',
                compatibleImplementations: [
                    'lnd',
                    'embedded-lnd',
                    'lightning-node-connect'
                ]
            }
        ]
    },
    {
        title: 'Lightning',
        commands: [
            {
                name: 'getLightningBalance',
                compatibleImplementations: [
                    'lnd',
                    'embedded-lnd',
                    'cln-rest',
                    'lndhub',
                    'lightning-node-connect'
                ]
            },
            {
                name: 'getInvoices',
                compatibleImplementations: [
                    'lnd',
                    'embedded-lnd',
                    'cln-rest',
                    'lndhub',
                    'lightning-node-connect'
                ]
            },
            {
                name: 'getPayments',
                compatibleImplementations: [
                    'lnd',
                    'embedded-lnd',
                    'cln-rest',
                    'lndhub',
                    'lightning-node-connect'
                ]
            }
        ]
    },
    {
        title: 'On-chain',
        commands: [
            {
                name: 'getBlockchainBalance',
                compatibleImplementations: [
                    'lnd',
                    'cln-rest',
                    'lightning-node-connect'
                ]
            },
            {
                name: 'getTransactions',
                compatibleImplementations: [
                    'lnd',
                    'embedded-lnd',
                    'cln-rest',
                    'lightning-node-connect'
                ]
            },
            {
                name: 'getUTXOs',
                compatibleImplementations: [
                    'lnd',
                    'cln-rest',
                    'lightning-node-connect'
                ]
            },
            {
                name: 'getNewAddress',
                compatibleImplementations: ['lnd', 'cln-rest']
            },
            {
                name: 'listAccounts',
                compatibleImplementations: [
                    'lnd',
                    'embedded-lnd',
                    'lightning-node-connect'
                ]
            },
            {
                name: 'listAddresses',
                compatibleImplementations: [
                    'lnd',
                    'embedded-lnd',
                    'lightning-node-connect'
                ]
            }
        ]
    },
    {
        title: 'Channels',
        commands: [
            {
                name: 'getChannels',
                compatibleImplementations: [
                    'lnd',
                    'embedded-lnd',
                    'cln-rest',
                    'lightning-node-connect'
                ]
            },
            {
                name: 'getPendingChannels',
                compatibleImplementations: [
                    'lnd',
                    'embedded-lnd',
                    'lightning-node-connect'
                ]
            },
            {
                name: 'getClosedChannels',
                compatibleImplementations: [
                    'lnd',
                    'embedded-lnd',
                    'lightning-node-connect'
                ]
            },
            {
                name: 'getChannelInfo',
                compatibleImplementations: [
                    'lnd',
                    'embedded-lnd',
                    'lightning-node-connect'
                ]
            },
            {
                name: 'getFees',
                compatibleImplementations: [
                    'lnd',
                    'cln-rest',
                    'lightning-node-connect'
                ]
            },
            {
                name: 'getForwardingHistory',
                compatibleImplementations: ['lnd', 'lightning-node-connect']
            }
        ]
    }
];

const ResponseContainer = ({
    title,
    content,
    type
}: ResponseContainerProps) => (
    <View
        style={[
            styles.responseContainer,
            { backgroundColor: themeColor('secondary') }
        ]}
    >
        <View style={styles.responseContainerHeaderRow}>
            <Text
                style={[
                    styles.responseTitle,
                    {
                        color:
                            type === 'error'
                                ? themeColor('error')
                                : themeColor('secondaryText')
                    }
                ]}
            >
                {localeString(title)}:
            </Text>
            <CopyButton copyValue={content} iconOnly={true} iconSize={20} />
        </View>
        <Text style={[styles.responseText, { color: themeColor('text') }]}>
            {content}
        </Text>
    </View>
);

class Command extends React.Component<CommandProps, CommandState> {
    private commandsWithSubItems = ['getChannelInfo'];

    state: CommandState = {
        loading: false,
        expanded: false
    };

    private loadSubItems = async () => {
        if (this.commandsWithSubItems.includes(this.props.command)) {
            this.setState({ loading: true });
            try {
                const response = await BackendUtils.call('getChannels');
                const channels = response.channels || [];
                const subItems = channels.map((channel: any) => ({
                    label: `Channel ${channel.chan_id} (${channel.remote_pubkey})`,
                    commandParameters: [channel.chan_id]
                }));
                this.setState({ subItems, loading: false });
            } catch (error) {
                console.error('Error loading channels:', error);
                this.setState({ loading: false, expanded: false });
            }
        }
    };

    private onCommandTap(command: string): void {
        if (this.commandsWithSubItems.includes(command)) {
            if (!this.state.expanded) {
                this.loadSubItems();
            }
            this.setState({ expanded: !this.state.expanded });
        } else {
            this.props.onTap(command);
        }
    }

    private onSubItemTap(
        command: string,
        commandParameters: any,
        selectedSubItemIndex: number
    ): void {
        this.setState({ selectedSubItemIndex });
        this.props.onTap(command, commandParameters);
    }

    render() {
        const { command, selected: isSelected, visible } = this.props;
        const { subItems, loading, selectedSubItemIndex, expanded } =
            this.state;
        const needsSubItems = this.commandsWithSubItems.includes(command);

        return (
            <View style={{ display: visible ? undefined : 'none' }}>
                <TouchableOpacity
                    onPress={() => this.onCommandTap(command)}
                    style={styles.commandContainer}
                >
                    <Text
                        style={{
                            ...styles.commandText,
                            color: isSelected
                                ? themeColor('highlight')
                                : themeColor('text')
                        }}
                    >
                        {command}
                    </Text>
                </TouchableOpacity>

                {expanded && needsSubItems && (subItems != null || loading) && (
                    <View
                        style={[{ backgroundColor: themeColor('secondary') }]}
                    >
                        {loading ? (
                            <ActivityIndicator color={themeColor('text')} />
                        ) : subItems!.length === 0 ? (
                            <Text
                                style={[
                                    styles.subItemText,
                                    { color: themeColor('text') }
                                ]}
                            >
                                {localeString(
                                    'views.Tools.developerTools.noItemsExist'
                                )}
                            </Text>
                        ) : (
                            subItems!.map((item, index) => (
                                <TouchableOpacity
                                    key={index}
                                    onPress={() =>
                                        this.onSubItemTap(
                                            command,
                                            item.commandParameters,
                                            index
                                        )
                                    }
                                >
                                    <Text
                                        style={[
                                            styles.subItemText,
                                            {
                                                color:
                                                    selectedSubItemIndex ===
                                                        index && isSelected
                                                        ? themeColor(
                                                              'highlight'
                                                          )
                                                        : themeColor('text')
                                            }
                                        ]}
                                    >
                                        {item.label}
                                    </Text>
                                </TouchableOpacity>
                            ))
                        )}
                    </View>
                )}
            </View>
        );
    }
}

class Category extends React.Component<CategoryProps> {
    render() {
        const {
            title,
            commands,
            onCommand,
            expanded,
            onToggle,
            implementation
        } = this.props;

        return (
            <View
                style={[
                    styles.categoryContainer,
                    {
                        backgroundColor: themeColor('secondary'),
                        paddingBottom: expanded ? 16 : undefined
                    }
                ]}
            >
                <TouchableOpacity onPress={onToggle}>
                    <Text
                        style={[
                            styles.categoryTitle,
                            { color: themeColor('text') }
                        ]}
                    >
                        {title}
                    </Text>
                </TouchableOpacity>
                {commands
                    .filter((c) =>
                        c.compatibleImplementations.includes(implementation)
                    )
                    .map((command) => (
                        <Command
                            key={command.name}
                            command={command.name}
                            onTap={onCommand}
                            selected={
                                this.props.selectedCommand === command.name
                            }
                            visible={expanded}
                        />
                    ))}
            </View>
        );
    }
}

@inject('SettingsStore')
@observer
export default class DeveloperTools extends React.Component<
    DeveloperToolsProps,
    DeveloperToolsState
> {
    state = {
        selectedCommand: null,
        expandedCategory: null,
        loading: false,
        response: null,
        error: null
    };

    handleCommand = async (command: string, param?: string) => {
        this.setState({
            selectedCommand: command,
            loading: true,
            response: null,
            error: null
        });
        try {
            const response = await BackendUtils.call(command, param);
            this.setState({
                loading: false,
                response: JSON.stringify(response, null, 2)
            });
        } catch (error: any) {
            this.setState({
                loading: false,
                error: error.message || 'Unknown error'
            });
        }
    };

    toggleCategory = (title: string) => {
        this.setState((prevState) => ({
            expandedCategory:
                prevState.expandedCategory === title ? null : title
        }));
    };

    render() {
        const { navigation, SettingsStore } = this.props;
        const { expandedCategory, loading, response, error } = this.state;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Tools.developerTools.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />
                <ScrollView contentContainerStyle={styles.container}>
                    {categories
                        .filter((c) =>
                            c.commands.some((c) =>
                                c.compatibleImplementations.includes(
                                    SettingsStore.implementation
                                )
                            )
                        )
                        .map((category) => (
                            <Category
                                key={category.title}
                                title={category.title}
                                commands={category.commands}
                                onCommand={this.handleCommand}
                                expanded={expandedCategory === category.title}
                                onToggle={() =>
                                    this.toggleCategory(category.title)
                                }
                                selectedCommand={this.state.selectedCommand}
                                implementation={SettingsStore.implementation}
                            />
                        ))}

                    {loading && (
                        <View
                            style={[
                                styles.responseContainer,
                                { backgroundColor: themeColor('secondary') }
                            ]}
                        >
                            <ActivityIndicator color={themeColor('text')} />
                        </View>
                    )}

                    {response && (
                        <ResponseContainer
                            title="general.response"
                            content={response}
                            type="response"
                        />
                    )}

                    {error && (
                        <ResponseContainer
                            title="general.error"
                            content={error}
                            type="error"
                        />
                    )}
                </ScrollView>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        gap: 10,
        marginTop: 15,
        width: '90%',
        alignSelf: 'center',
        paddingBottom: 20
    },
    categoryContainer: {
        borderRadius: 10,
        overflow: 'hidden',
        paddingVertical: 13,
        paddingHorizontal: 16
    },
    categoryTitle: {
        fontSize: 16,
        fontFamily: 'Zocial'
    },
    commandContainer: {
        paddingTop: 12,
        paddingLeft: 16
    },
    commandText: {
        fontSize: 14,
        fontFamily: 'PPNeueMontreal-Book'
    },
    subItemText: {
        fontSize: 12,
        fontFamily: 'PPNeueMontreal-Book',
        paddingTop: 8,
        paddingLeft: 32
    },
    responseContainer: {
        marginTop: 16,
        padding: 16,
        borderRadius: 10
    },
    responseContainerHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start'
    },
    responseTitle: {
        fontSize: 14,
        fontFamily: 'PPNeueMontreal-Book',
        fontWeight: 'bold',
        marginBottom: 8
    },
    responseText: {
        fontSize: 12,
        fontFamily: 'DroidSansMono'
    }
});
