const sleep = (milliseconds: number) => {
    const date = Date.now();
    let currentDate: any = null;
    do {
        currentDate = Date.now();
    } while (currentDate - date < milliseconds);
};

export { sleep };
