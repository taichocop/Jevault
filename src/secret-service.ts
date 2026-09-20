export interface SecretStore {
  getSecret(id: string): string | null;
}

/** SecretStorage から必要な時だけ API Key を解決する境界。 */
export class SecretService {
  constructor(private readonly secretStore: SecretStore) {}

  getApiKey(secretName: string): string | null {
    // 未設定時は SecretStorage を参照せず、呼び出し元が外部通信前に判定できるよう null を返す。
    if (secretName.length === 0) {
      return null;
    }

    // 値はキャッシュせず、その場で返すことで機密情報を保持する時間を最小限にする。
    return this.secretStore.getSecret(secretName);
  }
}
