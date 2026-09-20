import { describe, expect, it, vi } from "vitest";

import { SecretService, type SecretStore } from "../src/secret-service";

describe("SecretService", () => {
  it("resolves the configured secret without caching it", () => {
    const getSecret = vi.fn<(id: string) => string | null>()
      .mockReturnValueOnce("test-value-1")
      .mockReturnValueOnce("test-value-2");
    const service = new SecretService({ getSecret });

    expect(service.getApiKey("typesafe-api-key")).toBe("test-value-1");
    expect(service.getApiKey("typesafe-api-key")).toBe("test-value-2");
    expect(getSecret).toHaveBeenCalledTimes(2);
  });

  it("treats an empty secret name as not configured", () => {
    const secretStore: SecretStore = {
      getSecret: vi.fn(),
    };
    const service = new SecretService(secretStore);

    expect(service.getApiKey("")).toBeNull();
    expect(secretStore.getSecret).not.toHaveBeenCalled();
  });

  it("returns null when the referenced secret no longer exists", () => {
    const service = new SecretService({ getSecret: () => null });

    expect(service.getApiKey("missing-secret")).toBeNull();
  });
});
