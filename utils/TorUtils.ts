import TorMobile from '../tormobile';

declare enum RequestMethod {
    'GET' = 'GET',
    'POST' = 'POST',
    'DELETE' = 'DELETE'
}

const doTorRequest = async (
    url: string,
    method: RequestMethod,
    body?: string,
    headers?: any
) => {
    await TorMobile.start();
    const result = await TorMobile.sendRequest(
        method.toUpperCase(),
        url,
        JSON.stringify(headers ?? {}),
        body ?? ''
    );

    return JSON.parse(result).json;
};

export { doTorRequest, RequestMethod };
