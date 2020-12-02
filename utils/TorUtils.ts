import Tor from 'react-native-tor';
const tor = Tor();
const doTorRequest = async (
    url: string,
    method: string,
    data?: any,
    headers?: any,
    trustSSL: boolean = true
) => {
    await tor.startIfNotStarted();
    console.log('will call', url, method, data, headers);
    switch (method.toLowerCase()) {
        case 'get':
            const getResult = await tor.get(url, headers, trustSSL);
            if (getResult.json) {
                return getResult.json;
            }
        case 'post':
            const postResult = await tor.post(url, data, headers, trustSSL);
            if (postResult.json) {
                return postResult.json;
            }
        case 'delete':
            const deleteResult = await tor.delete(url, data, headers, trustSSL);
            if (deleteResult.json) {
                return deleteResult.json;
            }
            break;
    }
};
export { doTorRequest };
