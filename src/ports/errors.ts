export type UpstreamCode = "upstream_unavailable" | "upstream_invalid";

export class AppError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
  }
}

export class UpstreamError extends AppError {
  readonly system: string;

  constructor(code: UpstreamCode, system: string) {
    const message = code === "upstream_invalid" ? `${system} is invalid.` : `${system} is unavailable.`;
    super(502, code, message);
    this.system = system;
  }
}

export class SiteNotFoundError extends AppError {
  constructor() {
    super(404, "site_not_found", "Site not found.");
  }
}

/** A material no site plans to use. Pages only; there is no materials API route. */
export class MaterialNotFoundError extends AppError {
  constructor() {
    super(404, "material_not_found", "Material not found.");
  }
}

export class ShortageNotFoundError extends AppError {
  constructor() {
    super(404, "shortage_not_found", "Shortage not found.");
  }
}

export class PenetrationNotFoundError extends AppError {
  constructor() {
    super(404, "penetration_not_found", "Penetration not found.");
  }
}

export class WaitNotAllowedError extends AppError {
  constructor() {
    super(422, "wait_not_allowed_for_blocker", "Wait is not allowed for a blocker.");
  }
}

export class StaleNominationError extends AppError {
  constructor() {
    super(409, "stale_nomination", "The nomination has changed.");
  }
}

export class NotACandidateError extends AppError {
  constructor() {
    super(422, "not_a_candidate", "That solution is not a current candidate.");
  }
}

export class ValidationFailedError extends AppError {
  constructor(fields: readonly string[]) {
    const safe = fields.filter((field) => /^[A-Za-z0-9._]{1,80}$/.test(field));
    super(422, "validation_failed", safe.length > 0 ? `Invalid fields: ${safe.join(", ")}` : "Invalid fields.");
  }
}

export class IdempotencyKeyRequiredError extends AppError {
  constructor() {
    super(400, "idempotency_key_required", "Idempotency-Key is required.");
  }
}

export class PayloadTooLargeError extends AppError {
  constructor() {
    super(413, "payload_too_large", "Payload is too large.");
  }
}

export class InvalidJsonError extends AppError {
  constructor() {
    super(400, "invalid_json", "Invalid JSON.");
  }
}

export class IdempotencyKeyReusedError extends AppError {
  constructor() {
    super(409, "idempotency_key_reused", "The Idempotency-Key was used for a different request.");
  }
}

export type InternalReason = "config_invalid" | "store_forbidden" | "db_unconfigured" | "db_tls_insecure";

export class InternalError extends AppError {
  readonly reason: InternalReason | undefined;

  constructor(reason?: InternalReason) {
    super(500, "internal_error", "Something went wrong.");
    this.reason = reason;
  }
}
