/** Classification flowでUIが安全に判別できる、provider非依存の既知エラー。 */
class ClassificationError extends Error {
  constructor(name: string) {
    super(name);
    this.name = name;
  }
}

export class MissingApiKeyError extends ClassificationError {
  constructor() {
    super("MissingApiKeyError");
  }
}

export class NoActiveNoteError extends ClassificationError {
  constructor() {
    super("NoActiveNoteError");
  }
}

export class UnsupportedFileError extends ClassificationError {
  constructor() {
    super("UnsupportedFileError");
  }
}

export class NoCandidatesError extends ClassificationError {
  constructor() {
    super("NoCandidatesError");
  }
}

export class NetworkError extends ClassificationError {
  constructor() {
    super("NetworkError");
  }
}

export class TypeSafeApiError extends ClassificationError {
  constructor() {
    super("TypeSafeApiError");
  }
}

export class InvalidTypeSafeResponseError extends ClassificationError {
  constructor() {
    super("InvalidTypeSafeResponseError");
  }
}
