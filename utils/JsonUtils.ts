class JsonUtils {
    // this is a crass JSON parser to parse responses from lnd's new v2 routes
    // that are based on websockets. Since we cannot pass in headers for
    // macaroon auth per the lnd REST API's design (not supported in web/React,
    // only node.js) we must do this with traditional XHR calls. The problem is
    // that the result retuns all of the outputs from the stream. Together this
    // makes a invalid JSON objects. This parser takes the final response and
    // returns it to the user.
    parseWebsocketJson = (input: string) => {
        let openCount = 0;
        let closeCount = 0;
        // remove line breaks
        const sanitizedInput = input.replace(/(\r\n|\n|\r)/gm, '');
        const length = sanitizedInput.length;
        for (let i = 0; i <= length; i++) {
            if (sanitizedInput[i] === '{') {
                openCount++;
            } else if (sanitizedInput[i] === '}') {
                closeCount++;
            }

            if (openCount > 0 && closeCount > 0 && openCount === closeCount) {
                const newString = sanitizedInput.substring(i + 1, length);
                if (newString === '') {
                    return JSON.parse(sanitizedInput);
                }
                return this.parseWebsocketJson(newString);
            }
        }
        return JSON.parse(sanitizedInput);
    };
}

const jsonUtils = new JsonUtils();
export default jsonUtils;
