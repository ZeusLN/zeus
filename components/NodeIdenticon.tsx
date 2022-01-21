import * as React from 'react';
import { Avatar } from 'react-native-elements';
import Identicon from 'identicon.js';
import PrivacyUtils from './../utils/PrivacyUtils';

const hash = require('object-hash');

export const NodeTitle = (selectedNode: any) => {
    const displayName =
        selectedNode && selectedNode.nickname
            ? selectedNode.nickname
            : selectedNode && selectedNode.implementation === 'lndhub'
            ? selectedNode.lndhubUrl
                  .replace('https://', '')
                  .replace('http://', '')
            : selectedNode && selectedNode.url
            ? selectedNode.url.replace('https://', '').replace('http://', '')
            : selectedNode && selectedNode.port
            ? `${selectedNode.host}:${selectedNode.port}`
            : (selectedNode && selectedNode.host) || 'Unknown';

    const title = PrivacyUtils.sensitiveValue(displayName, 8);
    return title.length > 21 ? title.substring(0, 18) + '...' : title;
};

export default function NodeIdenticon({
    selectedNode,
    width
}: {
    selectedNode: any;
    width?: number;
}) {
    const title = NodeTitle(selectedNode);
    const implementation = PrivacyUtils.sensitiveValue(
        (selectedNode && selectedNode.implementation) || 'lnd',
        8
    );

    const data = new Identicon(
        hash.sha1(
            selectedNode && selectedNode.implementation === 'lndhub'
                ? `${title}-${selectedNode.username}`
                : title
        ),
        255
    ).toString();

    const identicon = width ? (
        <Avatar
            source={{
                uri: `data:image/png;base64,${data}`
            }}
            size="medium"
            rounded
            width={width}
            height={width}
        />
    ) : (
        <Avatar
            source={{
                uri: `data:image/png;base64,${data}`
            }}
            size="medium"
            rounded
        />
    );

    return identicon;
}
