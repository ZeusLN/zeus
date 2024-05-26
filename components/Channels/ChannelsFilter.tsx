import { Dimensions, View } from 'react-native';
import { SearchBar } from 'react-native-elements';

import { Row } from '../../components/layout/Row';
import { FilterOptions } from '../../components/Channels/FilterOptions';
import SortButton from '../../components/Channels/SortButton';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import stores from '../../stores/Stores';
import { ChannelsType } from '../../stores/ChannelsStore';

const getChannelsSortKeys = (closed?: boolean) => {
    const sortKeys: any = [];

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
    width?: string | number;
}

const ChannelsFilter = (props: ChannelsFilterProps) => {
    const { channelsStore } = stores;
    const { search, setSort, channelsType } = channelsStore;
    const windowWidth = Dimensions.get('window').width;
    return (
        <View>
            <Row>
                <SearchBar
                    placeholder={localeString('general.search')}
                    onChangeText={(value: string) =>
                        channelsStore!.setSearch(value)
                    }
                    value={search}
                    inputStyle={{
                        color: themeColor('text'),
                        fontFamily: 'PPNeueMontreal-Book'
                    }}
                    placeholderTextColor={themeColor('secondaryText')}
                    containerStyle={{
                        backgroundColor: null,
                        borderTopWidth: 0,
                        borderBottomWidth: 0,
                        width: props.width || windowWidth - 55
                    }}
                    inputContainerStyle={{
                        borderRadius: 15,
                        backgroundColor: themeColor('secondary')
                    }}
                    autoCapitalize="none"
                />
                <SortButton
                    onValueChange={(value: any) => {
                        setSort(value);
                    }}
                    values={getChannelsSortKeys(
                        channelsType === ChannelsType.Closed
                    )}
                />
            </Row>
            <FilterOptions ChannelsStore={channelsStore!} />
        </View>
    );
};

export default ChannelsFilter;
