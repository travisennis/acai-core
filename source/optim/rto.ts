import { type LanguageModel, generateText } from "ai";

const MD_CODE_BLOCK = /```(?:[\w-]+)?\n(.*?)```/s;

export const extractCodeFromPrompt = (text: string): string => {
  const pattern = MD_CODE_BLOCK;
  const match = text.match(pattern);
  if (match) {
    return match[1].trim();
  }
  return text;
};

export const roundTripOptimization = async ({
  model,
  system,
  prompt,
}: {
  model: LanguageModel;
  system?: string;
  prompt: string;
}): Promise<[string, number]> => {
  let rtoCompletionTokens = 0;

  // Generate initial code (C1)
  const { text: c1Response } = await generateText({
    model,
    maxTokens: 4096,
    temperature: 0.1,
    system: system,
    prompt: prompt,
  });
  rtoCompletionTokens += c1Response.length; // Note: This is a simplified token count

  // Generate description of the code (Q2)
  const { text: q2Response } = await generateText({
    model,
    maxTokens: 1024,
    temperature: 0.1,
    system: system,
    prompt:
      "Summarize or describe the code you just created. The summary should be in form of an instruction such that, given the instruction you can create the code yourself.",
  });
  rtoCompletionTokens += q2Response.length;

  // Generate second code based on the description (C2)
  const { text: c2Response } = await generateText({
    model,
    maxTokens: 4096,
    temperature: 0.1,
    system: system,
    prompt: q2Response,
  });
  rtoCompletionTokens += c2Response.length;

  const c1 = extractCodeFromPrompt(c1Response);
  const c2 = extractCodeFromPrompt(c2Response);

  if (c1.trim() === c2.trim()) {
    return [c1, rtoCompletionTokens];
  }

  // Generate optimized version (C3)
  const finalPrompt = `Initial query: ${prompt}\n\nFirst generated code (C1):\n${c1}\n\nSecond generated code (C2):\n${c2}\n\nBased on the initial query and these two different code implementations, generate a final, optimized version of the code. Only respond with the final code, do not return anything else.`;
  const { text: c3Response } = await generateText({
    model,
    maxTokens: 4096,
    temperature: 0.1,
    system: prompt,
    prompt: finalPrompt,
  });
  rtoCompletionTokens += c3Response.length;

  return [c3Response, rtoCompletionTokens];
};
