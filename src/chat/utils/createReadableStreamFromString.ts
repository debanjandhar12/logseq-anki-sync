export const createReadableStreamFromString = (str: string): ReadableStream<string> =>
    new ReadableStream({
        start(controller) {
            controller.enqueue(str);
            controller.close();
        }
    });
