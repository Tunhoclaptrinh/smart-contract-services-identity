import type { Role } from "./roles";
export type { Role };
export interface Actor {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  organizationId: string;
  roleChipOrganization: string;
  /** Sample-data party the user acts as: approver, buyer or supplier; null for internal staff. */
  partyId: string | null;
  title: string;
  permissions: string[];
  active?: boolean;
}
export interface RecordEntity {
  id: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  organizationId?: string;
  [key: string]: unknown;
}
export interface Field {
  key: string;
  type: string;
  required?: boolean;
  options?: string[];
  /** Name of the resource this field points to (by id). */
  ref?: string;
  min?: number;
  max?: number;
  integer?: boolean;
  maxLength?: number;
  pattern?: string;
  /** Column title shown by the web, in exports (`header=label`) and in import templates. */
  label?: string;
  /** Short help for the import template and forms (expected format, example). */
  description?: string;
  /** No two records may share a non-empty value (checked on create, update and import). */
  unique?: boolean;
  /** Set false to keep a field out of filters / sorting (large text, secrets). */
  filterable?: boolean;
  sortable?: boolean;
}
export interface Resource {
  name: string;
  fields: Field[];
  readOnly?: boolean;
  /** Records with these origins belong to the sample data or the workflow: CRUD may read, not change them. */
  managedOrigins?: string[];
}
export interface SessionRequest {
  user: Actor;
  requestId: string;
}
