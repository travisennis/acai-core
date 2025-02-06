import type { LanguageModelV1Middleware, LanguageModelV1StreamPart } from "ai";

export const usage: LanguageModelV1Middleware = {
  wrapGenerate: async ({ doGenerate }) => {
    console.info("usage middleware");
    const result = await doGenerate();

    console.info(`usage: ${JSON.stringify(result.usage, null, 2)}`);

    return result;
  },

  wrapStream: async ({ doStream, params }) => {
    console.info("doStream called");
    console.info(`params: ${JSON.stringify(params, null, 2)}`);

    const { stream, ...rest } = await doStream();

    const transformStream = new TransformStream<
      LanguageModelV1StreamPart,
      LanguageModelV1StreamPart
    >({
      transform(chunk, controller) {
        controller.enqueue(chunk);
      },

      flush() {
        console.info("usage");
      },
    });

    return {
      stream: stream.pipeThrough(transformStream),
      ...rest,
    };
  },
};
