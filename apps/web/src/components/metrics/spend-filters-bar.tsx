"use client";

import type { OrgTree } from "@/lib/api";
import {
  ENVIRONMENT_OPTIONS,
  MESSAGE_TYPE_OPTIONS,
  type SpendFilters,
} from "@/lib/metrics";
import { MenuSelect } from "@/components/ui/menu-select";

type Props = {
  org: OrgTree;
  filters: SpendFilters;
  onChange: (filters: SpendFilters) => void;
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

function filterClass(active: boolean) {
  return active ? "spend-filter spend-filter--active" : "spend-filter";
}

export function SpendFiltersBar({ org, filters, onChange, disabled = false }: Props) {
  const projects = collectProjects(org);
  const projectOptions = [
    { value: "", label: "All projects" },
    ...projects.map((project) => ({
      value: project.slug,
      label: project.name,
    })),
  ];
  const vendorOptions = [
    { value: "", label: "All vendors" },
    ...org.vendors.map((vendor) => ({ value: vendor.slug, label: vendor.name })),
  ];

  const hasActiveFilters = Boolean(
    filters.project || filters.environment || filters.vendor || filters.type,
  );

  return (
    <div className="spend-filters spend-filters--inline" aria-label="Spend filters">
      <div className="spend-filters__row">
        <MenuSelect
          compact
          ariaLabel="Type"
          value={filters.type ?? ""}
          disabled={disabled}
          className={filterClass(Boolean(filters.type))}
          onChange={(value) => onChange({ ...filters, type: value || undefined })}
          options={[...MESSAGE_TYPE_OPTIONS]}
          placeholder="All types"
        />
        <MenuSelect
          compact
          ariaLabel="Project"
          value={filters.project ?? ""}
          disabled={disabled}
          className={filterClass(Boolean(filters.project))}
          onChange={(value) => onChange({ ...filters, project: value || undefined })}
          options={projectOptions}
          placeholder="All projects"
        />
        <MenuSelect
          compact
          ariaLabel="Environment"
          value={filters.environment ?? ""}
          disabled={disabled}
          className={filterClass(Boolean(filters.environment))}
          onChange={(value) => onChange({ ...filters, environment: value || undefined })}
          options={[...ENVIRONMENT_OPTIONS]}
          placeholder="All environments"
        />
        <MenuSelect
          compact
          ariaLabel="Vendor"
          value={filters.vendor ?? ""}
          disabled={disabled}
          className={filterClass(Boolean(filters.vendor))}
          onChange={(value) => onChange({ ...filters, vendor: value || undefined })}
          options={vendorOptions}
          placeholder="All vendors"
        />
        {hasActiveFilters ? (
          <button
            type="button"
            className="spend-filters__clear"
            disabled={disabled}
            onClick={() => onChange({})}
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}
