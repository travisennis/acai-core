import { type LanguageModel, generateText } from "ai";

class AdvancedSelfConsistency {
  selfConsistencyCompletionTokens = 0;

  constructor(
    private model: LanguageModel,
    private numSamples = 5,
    private similarityThreshold = 0.8,
  ) {}

  private async generateResponses(
    systemPrompt: string | undefined,
    userPrompt: string,
  ): Promise<string[]> {
    const responses: string[] = [];
    for (let i = 0; i < this.numSamples; i++) {
      const { text, usage } = await generateText({
        model: this.model,
        maxTokens: 4096,
        temperature: 1.0,
        system: systemPrompt,
        prompt: userPrompt,
      });
      this.selfConsistencyCompletionTokens += usage?.completionTokens ?? 0;
      responses.push(text);
    }
    return responses;
  }

  private calculateSimilarity(a: string, b: string): number {
    // Note: This is a simplified version as SequenceMatcher isn't available in TS
    // You might want to use a proper string similarity library
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    if (longer.length === 0) return 1.0;
    return (longer.length - this.editDistance(longer, shorter)) / longer.length;
  }

  private editDistance(s1: string, s2: string): number {
    const costs: number[] = [];
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
  }

  private clusterSimilarResponses(responses: string[]): string[][] {
    const clusters: string[][] = [];
    for (const response of responses) {
      let addedToCluster = false;
      for (const cluster of clusters) {
        if (
          this.calculateSimilarity(response, cluster[0]) >=
          this.similarityThreshold
        ) {
          cluster.push(response);
          addedToCluster = true;
          break;
        }
      }
      if (!addedToCluster) {
        clusters.push([response]);
      }
    }
    return clusters;
  }

  private aggregateResults(responses: string[]): {
    clusters: Array<{
      answer: string;
      frequency: number;
      variants: string[];
    }>;
    totalResponses: number;
    numUniqueClusters: number;
  } {
    const finalAnswers = responses;
    const clusters = this.clusterSimilarResponses(finalAnswers);
    const clusterInfo = clusters.map((cluster) => ({
      answer: cluster[0],
      frequency: cluster.length,
      variants: cluster,
    }));
    clusterInfo.sort((a, b) => b.frequency - a.frequency);

    return {
      clusters: clusterInfo,
      totalResponses: responses.length,
      numUniqueClusters: clusters.length,
    };
  }

  async evaluate(
    systemPrompt: string | undefined,
    userPrompt: string,
  ): Promise<{
    individualResponses: string[];
    aggregatedResult: {
      clusters: Array<{
        answer: string;
        frequency: number;
        variants: string[];
      }>;
      totalResponses: number;
      numUniqueClusters: number;
    };
  }> {
    const responses = await this.generateResponses(systemPrompt, userPrompt);
    const aggregatedResult = this.aggregateResults(responses);
    return {
      individualResponses: responses,
      aggregatedResult,
    };
  }
}

export async function selfConsistency({
  model,
  system,
  prompt,
}: {
  model: LanguageModel;
  system?: string;
  prompt: string;
}): Promise<[string, number]> {
  const selfConsistency = new AdvancedSelfConsistency(model);
  const result = await selfConsistency.evaluate(system, prompt);

  console.log("Advanced Self-Consistency Results:");
  console.log(`Total responses: ${result.aggregatedResult.totalResponses}`);
  console.log(
    `Number of unique clusters: ${result.aggregatedResult.numUniqueClusters}`,
  );

  result.aggregatedResult.clusters.forEach((cluster, i) => {
    console.log(`\nCluster ${i + 1}:`);
    console.log(`  Representative answer: ${cluster.answer}`);
    console.log(`  Frequency: ${cluster.frequency}`);
    console.log(`  Variants: ${cluster.variants}`);
  });

  if (result.aggregatedResult.clusters.length > 0) {
    return [
      result.aggregatedResult.clusters[0].answer,
      selfConsistency.selfConsistencyCompletionTokens,
    ];
  }

  return [
    "No consistent answer found.",
    selfConsistency.selfConsistencyCompletionTokens,
  ];
}
