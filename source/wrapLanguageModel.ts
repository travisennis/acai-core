import {
  LanguageModel,
  Experimental_LanguageModelV1Middleware as LanguageModelV1Middleware,
  experimental_wrapLanguageModel as orginalWrapLanguageModel,
} from "ai";

export function wrapLanguageModel(
  model: LanguageModel,
  ...middleware: LanguageModelV1Middleware[]
) {
  const init = orginalWrapLanguageModel({
    model,
    middleware: middleware[0],
  });

  return middleware
    .slice(1)
    .reverse()
    .reduce((wrappedModel, currentMiddleware) => {
      return orginalWrapLanguageModel({
        model: wrappedModel,
        middleware: currentMiddleware,
      });
    }, init);
}
