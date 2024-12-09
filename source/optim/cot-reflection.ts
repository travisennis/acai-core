import { generateText, LanguageModel } from "ai";

type Section = "thinking" | "reflection" | "adjustments" | "output";

interface CoTReflectionResult {
  output: string;
  thinking: string;
  reflection: string;
  adjustments: string;
  completionTokens: number;
}

export class CoTReflection {
  private systemPrompt: string | undefined;
  private model: LanguageModel;

  constructor(model: LanguageModel, systemPrompt?: string) {
    this.systemPrompt = systemPrompt;
    this.model = model;
  }

  async send(initialQuery: string): Promise<CoTReflectionResult> {
    const cotPrompt = `
          ${this.systemPrompt}

          You are an AI assistant that uses a Chain of Thought (CoT) approach with reflection to answer queries. Follow these steps:

          1. Think through the problem step by step within the <thinking> tags.
          2. Reflect on your thinking to check for any errors or improvements within the <reflection> tags.
          3. Make any necessary adjustments based on your reflection.
          4. Provide your final, concise answer within the <output> tags.

          Important: The <thinking> and <reflection> sections are for your internal reasoning process only.
          Do not include any part of the final answer in these sections.
          The actual response to the query must be entirely contained within the <output> tags.

          Use the following format for your response:
          <thinking>
          [Your step-by-step reasoning goes here. This is your internal thought process, not the final answer.]
          </thinking>
          <reflection>
          [Your reflection on your reasoning, checking for errors or improvements]
          </reflection>
          <adjustments>
          [Any adjustments to your thinking based on your reflection]
          </adjustments>
          <output>
          [Your final, concise answer to the query. This is the only part that will be shown to the user.]
          </output>
        `;

    // Make the API call
    const { text, usage } = await generateText({
      model: this.model,
      maxTokens: 4096,
      system: cotPrompt.trim(),
      prompt: initialQuery,
    });

    console.log(text);

    const thinking = this.extractSection(text, "thinking");
    const reflection = this.extractSection(text, "reflection");
    const adjustments = this.extractSection(text, "adjustments");
    const output = this.extractSection(text, "output");

    return {
      output,
      thinking,
      reflection,
      adjustments,
      completionTokens: usage.completionTokens,
    };
  }

  extractSection(text: string, tag: Section): string {
    const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\/${tag}>`, "i");
    const match = text.match(regex);

    if (match?.[1]) {
      return match[1].trim();
    }

    return `No ${tag} process provided.`;
  }
}
