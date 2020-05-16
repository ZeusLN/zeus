import * as React from 'react';
import { Text, ScrollView, Image } from 'react-native';

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

        const text: string = JSON.parse(metadata)
            .filter(([typ, _]: any) => typ === 'text/plain')
            .map(([_, content]: any) => content)[0];

        const image: string = JSON.parse(metadata)
            .filter(([typ, _]: any) => typ.slice(0, 6) === 'image/')
            .map(([typ, content]: any) => `data:${typ},${content}`)[0];

        return (
            <ScrollView
                style={{
                    maxHeight: 220,
                    paddingTop: 20,
                    paddingBottom: 20,
                    flexDirection: 'column'
                }}
                contentContainerStyle={{
                    justifyContent: 'center',
                    alignItems: 'center'
                }}
            >
                {image ? (
                    <Image
                        style={{
                            width: 90,
                            height: 90,
                            marginBottom: 10
                        }}
                        source={{ uri: image }}
                    />
                ) : null}
                <Text
                    style={{
                        color: theme === 'dark' ? 'white' : 'black'
                    }}
                >
                    {text}
                </Text>
            </ScrollView>
        );
    }
}
