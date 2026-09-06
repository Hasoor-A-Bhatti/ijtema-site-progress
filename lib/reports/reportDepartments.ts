export const REPORT_LOGIN_OPTIONS = [
  { id: "admin", name: "Admin", role: "admin" },
  { id: "flag-hoisting", name: "Flag Hoisting", role: "department" },
  { id: "flooring-carpet", name: "Flooring & Carpet", role: "department" },
  { id: "fuel-supply", name: "Fuel Supply", role: "department" },
  { id: "operations", name: "Operations", role: "department" },
  { id: "power-supply-heating", name: "Power Supply & Heating", role: "department" },
  { id: "reporting", name: "Reporting", role: "department" },
  { id: "site-accounts", name: "Site Accounts", role: "department" },
  { id: "site-admin", name: "Site Admin", role: "department" },
  { id: "site-architecture", name: "Site Architecture", role: "department" },
  { id: "site-beautification", name: "Site Beautification", role: "department" },
  { id: "site-clearance", name: "Site Clearance", role: "department" },
  { id: "site-office", name: "Site Office", role: "department" },
  { id: "site-procurement", name: "Site Procurement", role: "department" },
  { id: "site-setup-transition", name: "Site Setup & Transition", role: "department" },
  { id: "site-transport", name: "Site Transport", role: "department" },
  { id: "site-transition-wind-up", name: "Site Transition & Wind Up", role: "department" },
  { id: "stage", name: "Stage", role: "department" },
  { id: "stock-distribution", name: "Stock and Distribution", role: "department" },
  { id: "water-maintenance", name: "Water Maintenance", role: "department" },
] as const;

export type ReportLoginOption = (typeof REPORT_LOGIN_OPTIONS)[number];

export function getReportLoginOption(id: string) {
  return REPORT_LOGIN_OPTIONS.find((option) => option.id === id) ?? null;
}
