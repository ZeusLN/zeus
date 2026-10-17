// @ts-nocheck
export default class BaseModel {
    constructor(data?: any) {
        Object.keys(data).forEach((field: any) => {
            // Handle Longs. Parsed JSON can have `high` and `low` members too,
            // but only a Long has its own toString; a plain object would
            // become "[object Object]".
            if (
                data[field] &&
                data[field].high !== undefined &&
                data[field].low !== undefined &&
                typeof data[field].toString === 'function' &&
                data[field].toString !== Object.prototype.toString
            ) {
                this[field] = data[field].toString();
            } else {
                this[field] = data[field];
            }
        });
    }
}
