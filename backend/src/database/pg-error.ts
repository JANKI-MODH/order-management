export function postgresConstraint(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "code" in error && error.code === "23505" && "constraint" in error) {
    return String(error.constraint);
  }
  return null;
}

export function isForeignKeyViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23503";
}

export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}
