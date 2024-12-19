import { type LanguageModel, generateText } from "ai";

export async function mixtureOfAgents({
  model,
  system,
  prompt,
}: {
  model: LanguageModel;
  system?: string;
  prompt: string;
}): Promise<[string, number]> {
  console.info(`Starting mixtureOfAgents function with model: ${model}`);
  let moaCompletionTokens = 0;

  console.debug(`Generating initial completions for query: ${prompt}`);
  const initialResponse = await Promise.all(
    new Array(3).fill(0).map((_) => {
      return generateText({
        model: model,
        maxTokens: 4096,
        temperature: 1.0,
        system: system,
        prompt: prompt,
      });
    }),
  );

  const completions = initialResponse.map((resp) => resp.text);
  moaCompletionTokens += initialResponse.reduce((prev, curr) => {
    return prev + curr.usage.completionTokens;
  }, 0);

  console.info(
    `Generated ${completions.length} initial completions. Tokens used: ${moaCompletionTokens}`,
  );
  console.debug("Preparing critique prompt");

  const critiquePrompt = `
    Original query: ${prompt}

    I will present you with three candidate responses to the original query. Please analyze and critique each response, discussing their strengths and weaknesses. Provide your analysis for each candidate separately.

    Candidate 1:
    ${completions[0]}

    Candidate 2:
    ${completions[1]}

    Candidate 3:
    ${completions[2]}

    Please provide your critique for each candidate:
    `;

  console.debug("Generating critiques");
  const critiqueResponse = await generateText({
    model: model,
    maxTokens: 512,
    temperature: 0.1,
    system: system,
    prompt: critiquePrompt,
  });

  const critiques = critiqueResponse.text;
  moaCompletionTokens += critiqueResponse.usage.completionTokens;
  console.info(
    `Generated critiques. Tokens used: ${critiqueResponse.usage.completionTokens}`,
  );
  console.debug("Preparing final prompt");

  const finalPrompt = `
    Original query: ${prompt}

    Based on the following candidate responses and their critiques, generate a final response to the original query.

    Candidate 1:
    ${completions[0]}

    Candidate 2:
    ${completions[1]}

    Candidate 3:
    ${completions[2]}

    Critiques of all candidates:
    ${critiques}

    Please provide a final, optimized response to the original query:
    `;

  console.debug("Generating final response");
  const finalResponse = await generateText({
    model: model,
    maxTokens: 8192,
    temperature: 0.1,
    system: system,
    prompt: finalPrompt,
  });

  moaCompletionTokens += finalResponse.usage.completionTokens;
  console.info(
    `Generated final response. Tokens used: ${finalResponse.usage.completionTokens}`,
  );
  console.info(`Total completion tokens used: ${moaCompletionTokens}`);

  return [finalResponse.text, moaCompletionTokens];
}
