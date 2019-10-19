const nodeUri = /^([a-h0-9]{66})@([^\:]+:[0-9]{0,5})/;

class NodeUriUtils {
    isValidNodeUri = (input: string) => nodeUri.test(input);
}

const nodeUriUtils = new NodeUriUtils();
export default nodeUriUtils;
