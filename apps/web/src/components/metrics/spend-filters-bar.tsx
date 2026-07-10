"use client";

import type { OrgTree } from "@/lib/api";
import { ENVIRONMENT_OPTIONS, type SpendFilters } from "@/lib/metrics";
import { SelectField } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";

type Props = {
  org: OrgTree;
  filters: SpendFilters;
  onChange: (filters: SpendFilters) => void;
  onExport?: () => void;
  exporting?: boolean;
  disabled?: boolean;
};

function collectProjects(org: OrgTree) {
  const projects: Array<{ slug: string; name: string }> = [];
  for (const collection of org.collections) {
    for (const project of collection.projects) {
      projects.push({ slug: project.slug, name: project.name });
    }
  }
  for (const project of org.ungrouped_projects) {
    projects.push({ slug: project.slug, name: project.name });
  }
  return projects.sort((a, b) => a.name.localeCompare(b.name));
}

export function SpendFiltersBar({
  org,
  filters,
  onChange,
  onExport,
  exporting = false,
  disabled = false,
}: Props) {
  const projects = collectProjects(org);
  const vendorOptions = [
    { value: "", label: "All vendors" },
    ...org.vendors.map((vendor) => ({ value: vendor.slug, label: vendor.name })),
  ];

  const hasActiveFilters = Boolean(filters.project || filters.environment || filters.vendor);

  return (
    <div className="spend-filters" aria-label="Spend filters">
      <div className="spend-filters__fields">
        <SelectField
          label="Project"
          value={filters.project ?? ""}
          disabled={disabled}
          onChange={(e) => onChange({ ...filters, project: e.target.value || undefined })}
          options={[
            { value: "", label: "All projects" },
            ...projects.map((project) => ({
              value: project.slug,
              label: project.name,
            })),
          ]}
        />
        <SelectField
          label="Environment"
          value={filters.environment ?? ""}
          disabled={disabled}
          onChange={(e) => onChange({ ...filters, environment: e.target.value || undefined })}
          options={[...ENVIRONMENT_OPTIONS]}
        />
        <SelectField
          label="Vendor"
          value={filters.vendor ?? ""}
          disabled={disabled}
          onChange={(e) => onChange({ ...filters, vendor: e.target.value || undefined })}
          options={vendorOptions}
        />
      </div>
      <div className="spend-filters__actions">
        {hasActiveFilters ? (
          <Button
            type="button"
            variant="ghost"
            disabled={disabled}
            onClick={() => onChange({})}
          >
            Clear filters
          </Button>
        ) : null}
        {onExport ? (
          <Button
            type="button"
            variant="default"
            disabled={disabled || exporting}
            onClick={onExport}
          >
            {exporting ? "Exporting…" : "Export CSV"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
