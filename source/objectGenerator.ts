import {
  type LanguageModel,
  type LanguageModelUsage,
  NoObjectGeneratedError,
  generateObject,
} from "ai";
import type { z } from "zod";
import { TokenTracker } from "./tokenTracker.ts";

interface GenerateObjectResult<T> {
  object: T;
  usage: LanguageModelUsage | undefined;
}

interface GenerateOptions<T> {
  model: {
    primary: LanguageModel;
    fallback: LanguageModel | undefined;
  };
  schema: z.ZodType<T>;
  prompt: string;
}

export class ObjectGenerator {
  private tokenTracker: TokenTracker;

  constructor(tokenTracker?: TokenTracker) {
    this.tokenTracker = tokenTracker || new TokenTracker();
  }

  async generateObject<T>(
    options: GenerateOptions<T>,
  ): Promise<GenerateObjectResult<T>> {
    const { model, schema, prompt } = options;

    try {
      // Primary attempt with main model
      const result = await generateObject({
        model: options.model.primary,
        schema,
        prompt,
        maxTokens: 4096,
        temperature: 0.7,
      });

      this.tokenTracker.trackUsage(options.model.primary.modelId, result.usage);
      return result;
    } catch (error) {
      // First fallback: Try manual JSON parsing of the error response
      try {
        const errorResult = this.handleGenerateObjectError<T>(error);
        this.tokenTracker.trackUsage(
          options.model.primary.modelId,
          errorResult.usage,
        );
        return errorResult;
      } catch (parseError) {
        // Second fallback: Try with fallback model if provided
        const fallbackModel = options.model.fallback ?? options.model.primary;
        if (NoObjectGeneratedError.isInstance(parseError)) {
          const failedOutput = parseError.text;
          console.error(
            `${model} failed on object generation ${failedOutput} -> manual parsing failed again -> trying fallback model`,
            fallbackModel,
          );
          try {
            const fallbackResult = await generateObject({
              model: fallbackModel,
              schema,
              prompt: `Extract the desired information from this text: \n ${failedOutput}`,
              maxTokens: 4096,
              temperature: 0.7,
            });

            this.tokenTracker.trackUsage(
              fallbackModel.modelId,
              fallbackResult.usage,
            );
            return fallbackResult;
          } catch (fallbackError) {
            // If fallback model also fails, try parsing its error response
            return this.handleGenerateObjectError<T>(fallbackError);
          }
        }

        // If no fallback model or all attempts failed, throw the original error
        throw error;
      }
    }
  }

  private handleGenerateObjectError<T>(
    error: unknown,
  ): GenerateObjectResult<T> {
    if (NoObjectGeneratedError.isInstance(error)) {
      console.error(
        "Object not generated according to schema, fallback to manual JSON parsing",
      );
      try {
        if (error.text) {
          const partialResponse = JSON.parse(error.text);
          return {
            object: partialResponse as T,
            usage: error.usage,
          };
        }
      } catch (_parseError) {
        throw error;
      }
    }
    throw error;
  }
}
