export type SpendQueryFilters = {
  project?: string;
  type?: string;
  environment?: string;
  vendor?: string;
};

export function parseSpendQueryFilters(url: URL): SpendQueryFilters {
  const project = url.searchParams.get("project");
  const type = url.searchParams.get("type");
  const environment = url.searchParams.get("environment");
  const vendor = url.searchParams.get("vendor");

  return {
    project: project || undefined,
    type: type || undefined,
    environment: environment || undefined,
    vendor: vendor || undefined,
  };
}

export function toDbSpendFilters(filters: SpendQueryFilters) {
  return {
    projectSlug: filters.project ?? null,
    messageType: filters.type ?? null,
    environment: filters.environment ?? null,
    vendorSlug: filters.vendor ?? null,
  };
}
