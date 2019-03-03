class MacaroonUtils {
    asciiToHex = (input: string) => {
        const arr1: Array<string> = [];
      	for (let n = 0, l = input.length; n < l; n++) {
        		const hex: string = Number(input.charCodeAt(n)).toString(16);
        		arr1.push(hex);
      	}
      	return arr1.join('');
    };
};

const macaroonUtils = new MacaroonUtils();
export default macaroonUtils;