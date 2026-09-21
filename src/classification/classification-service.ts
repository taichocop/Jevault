import type { NoteService } from "../note-service";
import type { SecretService } from "../secret-service";
import type { JevaultSettings } from "../settings";
import type { VaultService } from "../vault-service";
import type { CandidateBuilder } from "./candidate-builder";
import type { ClassificationResult } from "./classification-result";
import type { Classifier } from "./classifier";
import { classifyAndSort } from "./classify-and-sort";

export type ClassifierFactory = (apiKey: string) => Classifier;

export type ClassificationServiceResult =
  | { status: "no-active-file" }
  | { status: "unsupported-file" }
  | { status: "no-candidates" }
  | { status: "missing-secret" }
  | { status: "success"; result: ClassificationResult };

type NoteStateProvider = Pick<NoteService, "getActiveNoteState">;
type FolderPathProvider = Pick<VaultService, "getAvailableFolderPaths">;
type ApiKeyProvider = Pick<SecretService, "getApiKey">;

/** Active noteから上位候補を返すまでを調停する、provider非依存のapplication boundary。 */
export class ClassificationService {
  constructor(
    private readonly noteService: NoteStateProvider,
    private readonly vaultService: FolderPathProvider,
    private readonly candidateBuilder: CandidateBuilder,
    private readonly secretService: ApiKeyProvider,
    private readonly classifierFactory: ClassifierFactory,
    private readonly getSettings: () => JevaultSettings,
  ) {}

  async classifyActiveNote(): Promise<ClassificationServiceResult> {
    const noteState = await this.noteService.getActiveNoteState();
    if (noteState.status !== "ready") {
      // NoteServiceの失敗理由を保ち、本文がない状態で後続処理や外部通信へ進まない。
      return noteState;
    }

    const settings = this.getSettings();
    const folderPaths = this.vaultService.getAvailableFolderPaths(settings);
    const candidates = this.candidateBuilder.build(folderPaths);
    if (candidates.length === 0) {
      // Choiceを構築できないため、Secret解決やClassifier生成より前に終了する。
      return { status: "no-candidates" };
    }

    const apiKey = this.secretService.getApiKey(settings.apiKeySecretName);
    if (apiKey === null || apiKey.trim().length === 0) {
      // blank値でも認証不能な通信へ進まないよう、credential自体は加工せず利用可否だけを判定する。
      return { status: "missing-secret" };
    }

    // factory境界によりapplication層はTypeSafe SDKを知らず、解決済みSecretもadapterへだけ渡す。
    const classifier = this.classifierFactory(apiKey);
    const result = await classifyAndSort(
      classifier,
      noteState.note,
      candidates,
    );

    return {
      status: "success",
      result: {
        ...result,
        // providerConfidenceは順位に使わず保持し、probability sort後に表示件数だけを制限する。
        candidates: result.candidates.slice(0, settings.suggestionCount),
      },
    };
  }
}
