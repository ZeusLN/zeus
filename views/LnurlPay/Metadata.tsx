import * as React from 'react';
import { Text, ScrollView } from 'react-native';

import SettingsStore from './../../stores/SettingsStore';

interface LnurlPayMetadataProps {
    metadata: string;
    SettingsStore: SettingsStore;
}

export default class LnurlPayMetadata extends React.Component<
    LnurlPayMetadataProps
> {
    render() {
        const { metadata, SettingsStore } = this.props;
        const { settings } = SettingsStore;
        const { theme } = settings;

        const parsedMetadata = JSON.parse(metadata)
            .filter(([typ, _]: any) => typ === 'text/plain')
            .map(([_, content]: any) => content)[0];

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
