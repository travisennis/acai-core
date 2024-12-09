import {
  Experimental_LanguageModelV1Middleware as LanguageModelV1Middleware,
  LanguageModelV1StreamPart,
} from "ai";

export const usage: LanguageModelV1Middleware = {
  wrapGenerate: async ({ doGenerate }) => {
    console.log("usage middleware");
    const result = await doGenerate();

    console.log(`usage: ${JSON.stringify(result.usage, null, 2)}`);

    return result;
  },

  wrapStream: async ({ doStream, params }) => {
    console.log("doStream called");
    console.log(`params: ${JSON.stringify(params, null, 2)}`);

    const { stream, ...rest } = await doStream();

    const transformStream = new TransformStream<
      LanguageModelV1StreamPart,
      LanguageModelV1StreamPart
    >({
      transform(chunk, controller) {
        controller.enqueue(chunk);
      },

      flush() {
        console.log("usage");
      },
    });

    return {
      stream: stream.pipeThrough(transformStream),
      ...rest,
    };
  },
};
