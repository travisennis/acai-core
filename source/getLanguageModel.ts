import { languageModel, type ModelName } from "./providers.ts";
import { auditMessage } from "./middleware/index.ts";
import { wrapLanguageModel } from "./wrapLanguageModel.ts";

export function getLanguageModel({
  model,
  app,
  stateDir,
}: {
  model: ModelName;
  app: string;
  stateDir: string;
}) {
  const langModel = wrapLanguageModel(
    languageModel(model),
    auditMessage({ filePath: stateDir, app }),
  );

  return langModel;
}
