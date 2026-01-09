import React from 'react';
import { Dimensions, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { SearchBar } from '@rneui/themed';

import { Row } from '../../components/layout/Row';
import { FilterOptions } from '../../components/Channels/FilterOptions';
import SortButton from '../../components/Channels/SortButton';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import ChannelsStore, {
    ChannelsType,
    ChannelsView
} from '../../stores/ChannelsStore';

const getChannelsSortKeys = (closed?: boolean, view?: ChannelsView) => {
    const sortKeys: any = [];

    if (view === ChannelsView.Peers) {
        sortKeys.push(
            {
                key: `${localeString('views.NodeInfo.alias')} (${localeString(
                    'views.Channel.SortButton.ascending'
                )})`,
                value: { param: 'alias', dir: 'ASC', type: 'alphanumeric' }
            },
            {
                key: `${localeString('views.NodeInfo.alias')} (${localeString(
                    'views.Channel.SortButton.descending'
                )})`,
                value: { param: 'alias', dir: 'DESC', type: 'alphanumeric' }
            },
            {
                key: `${localeString('views.NodeInfo.pubkey')} (${localeString(
                    'views.Channel.SortButton.ascending'
                )})`,
                value: { param: 'pubkey', dir: 'ASC', type: 'alphanumeric' }
            },
            {
                key: `${localeString('views.NodeInfo.pubkey')} (${localeString(
                    'views.Channel.SortButton.descending'
                )})`,
                value: { param: 'pubkey', dir: 'DESC', type: 'alphanumeric' }
            }
        );
        return sortKeys;
    }

    if (closed) {
        sortKeys.push(
            {
                key: `${localeString(
                    'views.Channel.closeHeight'
                )} (${localeString('views.Channel.SortButton.ascending')})`,
                value: { param: 'closeHeight', dir: 'ASC', type: 'numeric' }
            },
            {
                key: `${localeString(
                    'views.Channel.closeHeight'
                )} (${localeString('views.Channel.SortButton.descending')})`,
                value: {
                    param: 'closeHeight',
                    dir: 'DESC',
                    type: 'numeric'
                }
            }
        );
    }

    sortKeys.push(
        {
            key: `${localeString('views.Channel.capacity')} (${localeString(
                'views.Channel.SortButton.largestFirst'
            )})`,
            value: {
                param: 'channelCapacity',
                dir: 'DESC',
                type: 'numeric'
            }
        },
        {
            key: `${localeString('views.Channel.capacity')} (${localeString(
                'views.Channel.SortButton.smallestFirst'
            )})`,
            value: { param: 'channelCapacity', dir: 'ASC', type: 'numeric' }
        },
        {
            key: `${localeString(
                'views.Channel.inboundCapacity'
            )} (${localeString('views.Channel.SortButton.largestFirst')})`,
            value: { param: 'remoteBalance', dir: 'DESC', type: 'numeric' }
        },
        {
            key: `${localeString(
                'views.Channel.inboundCapacity'
            )} (${localeString('views.Channel.SortButton.smallestFirst')})`,
            value: { param: 'remoteBalance', dir: 'ASC', type: 'numeric' }
        },
        {
            key: `${localeString(
                'views.Channel.outboundCapacity'
            )} (${localeString('views.Channel.SortButton.largestFirst')})`,
            value: { param: 'localBalance', dir: 'DESC', type: 'numeric' }
        },
        {
            key: `${localeString(
                'views.Channel.outboundCapacity'
            )} (${localeString('views.Channel.SortButton.smallestFirst')})`,
            value: { param: 'localBalance', dir: 'ASC', type: 'numeric' }
        },
        {
            key: `${localeString('views.Channel.displayName')} (${localeString(
                'views.Channel.SortButton.ascending'
            )})`,
            value: {
                param: 'displayName',
                dir: 'ASC',
                type: 'alphanumeric'
            }
        },
        {
            key: `${localeString('views.Channel.displayName')} (${localeString(
                'views.Channel.SortButton.descending'
            )})`,
            value: {
                param: 'displayName',
                dir: 'DESC',
                type: 'alphanumeric'
            }
        }
    );

    return sortKeys;
};

interface ChannelsFilterProps {
    width?: number;
    ChannelsStore?: ChannelsStore;
}

@inject('ChannelsStore')
@observer
class ChannelsFilter extends React.PureComponent<ChannelsFilterProps> {
    render() {
        const { ChannelsStore } = this.props;
        const { search, setSort, channelsType, channelsView } = ChannelsStore!;
        const windowWidth = Dimensions.get('window').width;

        return (
            <View>
                <Row>
                    <SearchBar
                        placeholder={localeString('general.search')}
                        onChangeText={(value?: string) =>
                            ChannelsStore!.setSearch(value ?? '')
                        }
                        value={search}
                        inputStyle={{
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }}
                        placeholderTextColor={themeColor('secondaryText')}
                        containerStyle={{
                            backgroundColor: 'transparent',
                            borderTopWidth: 0,
                            borderBottomWidth: 0,
                            width: this.props.width || windowWidth - 55
                        }}
                        inputContainerStyle={{
                            borderRadius: 15,
                            backgroundColor: themeColor('secondary')
                        }}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="visible-password"
                        onClear={() => ChannelsStore!.setSearch('')}
                        searchIcon={{ name: 'search', type: 'font-awesome' }}
                        clearIcon={{ name: 'close', type: 'font-awesome' }}
                    />
                    {channelsView === ChannelsView.Channels && (
                        <SortButton
                            onValueChange={setSort}
                            values={getChannelsSortKeys(
                                channelsType === ChannelsType.Closed,
                                ChannelsView.Channels
                            )}
                        />
                    )}
                    {channelsView === ChannelsView.Peers && (
                        <SortButton
                            onValueChange={setSort}
                            values={getChannelsSortKeys(
                                false,
                                ChannelsView.Peers
                            )}
                        />
                    )}
                </Row>
                {ChannelsStore?.channelsView === ChannelsView.Channels && (
                    <FilterOptions />
                )}
            </View>
        );
    }
}

export default ChannelsFilter;
