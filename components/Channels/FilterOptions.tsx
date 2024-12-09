import * as React from 'react';
import { FlatList, TouchableHighlight, View } from 'react-native';
import { inject, observer } from 'mobx-react';

import { themeColor } from '../../utils/ThemeUtils';
import ChannelsStore from '../../stores/ChannelsStore';
import { Body } from '../text/Body';
import { Row } from '../layout/Row';
import { Spacer } from '../layout/Spacer';
import { localeString } from '../../utils/LocaleUtils';

interface FilterOptionsProps {
    ChannelsStore?: ChannelsStore;
}

interface FilterOption {
    name: string;
    value: boolean;
}

@inject('ChannelsStore')
@observer
export class FilterOptions extends React.PureComponent<FilterOptionsProps> {
    getFilterOptions = (): FilterOption[] => {
        const { ChannelsStore } = this.props;
        const options: { [key: string]: any } = {
            online: false,
            offline: false,
            announced: false,
            unannounced: false
        };
        for (const option of ChannelsStore!.filterOptions) {
            options[option] = true;
        }
        return Object.entries(options).map(([name, value]) => ({
            name,
            value
        }));
    };

    updateFilter = (option: FilterOption) => {
        const { ChannelsStore } = this.props;
        const { filterOptions: currentOptions } = ChannelsStore!;

        if (!option.value) {
            // enable option
            ChannelsStore!.setFilterOptions([...currentOptions, option.name]);
        } else {
            // disable option
            const selectedOptions = currentOptions.filter(
                (item) => item !== option.name
            );
            ChannelsStore!.setFilterOptions(selectedOptions);
        }
    };

    renderItem = ({ item }: { item: FilterOption }) => (
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
            onPress={() => this.updateFilter(item)}
        >
            <View>
                <Body small bold color={item.value ? 'highlight' : 'text'}>
                    {localeString(`views.Wallet.Channels.${item.name}`)}
                </Body>
            </View>
        </TouchableHighlight>
    );

    render() {
        return (
            <View style={{ marginLeft: 10, marginBottom: 10 }}>
                <Row>
                    <Body color={'secondaryText'}>
                        {`${localeString('views.Wallet.Channels.filters')}:`}
                    </Body>
                    <FlatList
                        style={{ marginLeft: 5 }}
                        horizontal={true}
                        data={this.getFilterOptions()}
                        renderItem={this.renderItem}
                        ListFooterComponent={<Spacer height={5} />}
                        keyExtractor={(item) => `${item.name}`}
                    />
                </Row>
            </View>
        );
    }
}
