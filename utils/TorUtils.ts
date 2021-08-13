import Tor, { RequestMethod } from 'react-native-tor';
const tor = Tor({ bootstrapTimeoutMs: 35000 });
const doTorRequest = async <T extends RequestMethod>(
    url: string,
    method: T,
    data?: string,
    headers?: any,
    trustSSL: boolean = true
) => {
    await tor.startIfNotStarted();
    switch (method.toLowerCase()) {
        case RequestMethod.GET:
            const getResult = await tor.get(url, headers, trustSSL);
            if (getResult.json) {
                return getResult.json;
            }
        case RequestMethod.POST:
            const postResult = await tor.post(
                url,
                data || '',
                headers,
                trustSSL
            );
            if (postResult.json) {
                return postResult.json;
            }
        case RequestMethod.DELETE:
            const deleteResult = await tor.delete(url, data, headers, trustSSL);
            if (deleteResult.json) {
                return deleteResult.json;
            }
            break;
    }
};

const restartTor = async () => {
    await tor.stopIfRunning();
    await tor.startIfNotStarted();
};

export { doTorRequest, restartTor, RequestMethod };
