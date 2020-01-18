import * as React from 'react';
import { Text, ScrollView } from 'react-native';
import { inject, observer } from 'mobx-react';

import SettingsStore from './../../stores/SettingsStore';

interface LnurlPayMetadataProps {
    metadata: string;
    SettingsStore: SettingsStore;
}

@inject('SettingsStore')
@observer
export default class LnurlPayMetadata extends React.Component<
    LnurlPayMetadataProps
> {
    render() {
        const { metadata, SettingsStore } = this.props;
        const { settings } = SettingsStore;
        const { theme } = settings;

        const parsedMetadata = JSON.parse(metadata)
            .filter(([typ, _]) => typ === 'text/plain')
            .map(([_, content]) => content)[0];

        return (
            <ScrollView
                style={{
                    maxHeight: 220,
                    paddingTop: 20,
                    paddingBottom: 20
                }}
            >
                <Text
                    style={{
                        fontFamily: 'monospace',
                        color: theme === 'dark' ? 'white' : 'black'
                    }}
                >
                    {parsedMetadata}
                </Text>
            </ScrollView>
        );
    }
}
