import type {
  Experimental_LanguageModelV1Middleware as LanguageModelV1Middleware,
  LanguageModelV1StreamPart,
} from "ai";

export const log: LanguageModelV1Middleware = {
  wrapGenerate: async ({ doGenerate, params }) => {
    console.info("log middleware");
    console.info("doGenerate called");
    console.info(`params: ${JSON.stringify(params, null, 2)}`);

    const result = await doGenerate();

    console.info("doGenerate finished");
    console.info(`generated text: ${result.text}`);

    return result;
  },

  wrapStream: async ({ doStream, params }) => {
    console.info("doStream called");
    console.info(`params: ${JSON.stringify(params, null, 2)}`);

    const { stream, ...rest } = await doStream();

    let generatedText = "";

    const transformStream = new TransformStream<
      LanguageModelV1StreamPart,
      LanguageModelV1StreamPart
    >({
      transform(chunk, controller) {
        if (chunk.type === "text-delta") {
          generatedText += chunk.textDelta;
        }

        controller.enqueue(chunk);
      },

      flush() {
        console.info("doStream finished");
        console.info(`generated text: ${generatedText}`);
      },
    });

    return {
      stream: stream.pipeThrough(transformStream),
      ...rest,
    };
  },
};
