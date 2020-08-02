class JsonUtils {
    parseWebsocketJson = (input: string) => {
        let openCount = 0;
        let closeCount = 0;
        const sanitizedInput = input.replace(/(\r\n|\n|\r)/gm, "");
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
