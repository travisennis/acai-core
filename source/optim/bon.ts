import { generateObject, generateText, LanguageModel } from "ai";
import { z } from "zod";

export async function bon(opts: {
	model: LanguageModel;
	system?: string;
	initialQuery: string;
	n?: number;
}): Promise<string> {
	const n = opts.n ?? 3;

	const completions = await Promise.all(
		Array(n).map(async (_) => {
			const { text } = await generateText({
				model: opts.model,
				maxTokens: 4096,
				temperature: 1.0,
				system: opts.system,
				prompt: opts.initialQuery,
			});
			return text;
		}),
	);

	const ratingObjs = await Promise.all(
		completions.map(async (completion) => {
			const { object } = await generateObject({
				model: opts.model,
				schema: z.object({ rating: z.number() }),
				maxTokens: 256,
				temperature: 0.1,
				system:
					"You are to be given a query and response to that query. Rate the response on a scale from 0 to 10, where 0 is poor and 10 is excellent. Consider factors such as relevance, coherence, and helpfulness to the query. Respond only with a number.",
				prompt: `Query: ${opts.initialQuery}\n\nResponse: ${completion}`,
			});
			return object;
		}),
	);

	const ratings = ratingObjs.map((obj) => obj.rating);

	const bestIndex = ratings.indexOf(Math.max(...ratings));
	return completions[bestIndex];
}
