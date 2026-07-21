export function assertKnownDataIds(
  source: string,
  allowedResourceIds: ReadonlySet<string>,
  allowedFieldIds: ReadonlySet<string>,
): void {
  const resourceIds = source.match(/\bresource_[A-Za-z0-9_-]+\b/g) ?? [];
  const fieldIds = source.match(/\bfield_[A-Za-z0-9_-]+\b/g) ?? [];
  if (resourceIds.some((id) => !allowedResourceIds.has(id)) || fieldIds.some((id) => !allowedFieldIds.has(id))) {
    throw new Error("Generated code refers to data that is not available.");
  }
}
