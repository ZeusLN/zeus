// @ts-nocheck
export default class BaseModel {
    constructor(data?: any) {
        Object.keys(data).forEach((field: any) => {
            // Handle Longs
            if (
                data[field] &&
                data[field].high !== undefined &&
                data[field].low !== undefined
            ) {
                this[field] = data[field].toString();
            } else {
                this[field] = data[field];
            }
        });
    }
}
