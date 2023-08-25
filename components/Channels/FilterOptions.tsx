import * as React from 'react';
import { FlatList, TouchableHighlight, View } from 'react-native';
import { themeColor } from '../../utils/ThemeUtils';
import ChannelsStore from '../../stores/ChannelsStore';
import { Body } from '../text/Body';
import { Row } from '../layout/Row';
import { Spacer } from '../layout/Spacer';
import { localeString } from '../../utils/LocaleUtils';

interface FilterOption {
    name: string;
    value: boolean;
}

export function FilterOptions(props: { ChannelsStore: ChannelsStore }) {
    const getFilterOptions = (): FilterOption[] => {
        const { ChannelsStore } = props;
        const options: { [key: string]: any } = {
            announced: false,
            unannounced: false
        };
        for (const option of ChannelsStore.filterOptions) {
            options[option] = true;
        }
        return Object.entries(options).map(([name, value]) => ({
            name,
            value
        }));
    };

    const updateFilter = (option: FilterOption) => {
        const { ChannelsStore } = props;
        const { filterOptions: currentOptions } = ChannelsStore;

        if (!option.value) {
            // enable option
            ChannelsStore.setFilterOptions([...currentOptions, option.name]);
        } else {
            // disable option
            const selectedOptions = currentOptions.filter(
                (item) => item !== option.name
            );
            ChannelsStore.setFilterOptions(selectedOptions);
        }
    };
    const renderItem = ({ item }: { item: FilterOption }) => (
        <TouchableHighlight
            activeOpacity={0.7}
            style={{
                paddingLeft: 15,
                paddingRight: 15,
                paddingTop: 6,
                paddingBottom: 6,
                marginLeft: 3,
                marginRight: 3,
                backgroundColor: themeColor('secondary'),
                borderRadius: 20
            }}
            underlayColor={themeColor('disabled')}
            onPress={() => updateFilter(item)}
        >
            <View>
                <Body small bold color={item.value ? 'highlight' : 'text'}>
                    {localeString(`views.Wallet.Channels.${item.name}`)}
                </Body>
            </View>
        </TouchableHighlight>
    );

    return (
        <View style={{ marginLeft: 10, marginBottom: 10 }}>
            <Row>
                <Body color={'secondaryText'}>
                    {`${localeString('views.Wallet.Channels.filters')}:`}
                </Body>
                <FlatList
                    style={{ marginLeft: 5 }}
                    horizontal={true}
                    data={getFilterOptions()}
                    renderItem={renderItem}
                    ListFooterComponent={<Spacer height={5} />}
                    keyExtractor={(item) => `${item.name}`}
                />
            </Row>
        </View>
    );
}
