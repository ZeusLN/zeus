const nodeUri = /^([a-h0-9]{66})@([^:]+:[0-9]{0,5})/;

class NodeUriUtils {
    isValidNodeUri = (input: string) => nodeUri.test(input);
    processNodeUri = (input: string) => {
        const split = input.split('@');
        const pubkey = split[0];
        const host = split[1];

        return { pubkey, host };
    };
}

const nodeUriUtils = new NodeUriUtils();
export default nodeUriUtils;
