"use client";

/**
 * Shared UI primitives (web/admin) — Warm Institutional Fintech, light theme.
 * All styling comes from CSS classes in @rentbrown/ui/styles.css driven by
 * the design-token CSS variables. Components render semantics only; they
 * never decide authorization — the server does.
 */

import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";

// ── Button ────────────────────────────────────────────────────
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  loading?: boolean;
}
export function Button({
  variant = "primary",
  loading = false,
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`rb-btn rb-btn--${variant}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner label="Working" /> : null}
      {children}
    </button>
  );
}

// ── Field wrapper (label + hint + error tied to the control) ──
export interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}
export function Field({ id, label, hint, error, required, children }: FieldProps) {
  return (
    <div className="rb-field">
      <label className="rb-label" htmlFor={id}>
        {label}
        {required ? (
          <span className="rb-required" aria-hidden="true">
            {" "}
            *
          </span>
        ) : null}
      </label>
      {children}
      {hint && !error ? (
        <span className="rb-hint" id={`${id}-hint`}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span className="rb-error" role="alert" id={`${id}-error`}>
          {error}
        </span>
      ) : null}
    </div>
  );
}

// ── Input ─────────────────────────────────────────────────────
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { error, ...rest },
  ref,
) {
  return <input ref={ref} className="rb-input" aria-invalid={error || undefined} {...rest} />;
});

// ── Select ────────────────────────────────────────────────────
export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { error, children, ...rest },
  ref,
) {
  return (
    <select ref={ref} className="rb-select" aria-invalid={error || undefined} {...rest}>
      {children}
    </select>
  );
});

// ── Checkbox ──────────────────────────────────────────────────
export interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode;
}
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, id, ...rest },
  ref,
) {
  return (
    <label className="rb-checkbox" htmlFor={id}>
      <input ref={ref} type="checkbox" id={id} {...rest} />
      <span>{label}</span>
    </label>
  );
});

// ── Card ──────────────────────────────────────────────────────
export function Card({ children }: { children: ReactNode }) {
  return <div className="rb-card">{children}</div>;
}

// ── Badge — locked status vocabulary ──────────────────────────
export type BadgeVariant = "success" | "warning" | "error" | "info" | "pending" | "neutral";

/** maps domain statuses (account/KYC) to badge variants — display only */
export function badgeVariantFor(status: string): BadgeVariant {
  switch (status) {
    case "APPROVED":
    case "ACTIVE":
    case "COMPLETED":
    case "VERIFIED":
      return "success";
    case "IN_REVIEW":
    case "SUBMITTED":
    case "PENDING":
    case "MORE_INFO_REQUIRED":
      return "pending";
    case "RESTRICTED":
    case "SUSPENDED":
      return "warning";
    case "REJECTED":
    case "FAILED":
    case "CLOSED":
      return "error";
    case "DRAFT":
    case "NONE":
      return "neutral";
    default:
      return "info";
  }
}

export function Badge({ status, children }: { status: string; children?: ReactNode }) {
  return (
    <span className={`rb-badge rb-badge--${badgeVariantFor(status)}`}>
      {children ?? status.replaceAll("_", " ")}
    </span>
  );
}

// ── Alert ─────────────────────────────────────────────────────
export function Alert({
  variant = "info",
  children,
}: {
  variant?: "info" | "success" | "warning" | "error";
  children: ReactNode;
}) {
  return (
    <div
      className={`rb-alert rb-alert--${variant}`}
      role={variant === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}

// ── PageHeader ────────────────────────────────────────────────
export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="rb-page-header">
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
    </header>
  );
}

// ── Skeleton ──────────────────────────────────────────────────
export function Skeleton({ height = 16, width = "100%" }: { height?: number; width?: string }) {
  return <div className="rb-skeleton" style={{ height, width }} aria-hidden="true" />;
}

// ── Table (simple, responsive via horizontal scroll) ──────────
export interface TableColumn {
  key: string;
  header: ReactNode;
}
export function Table({
  columns,
  rows,
}: {
  columns: TableColumn[];
  rows: Array<Record<string, ReactNode>>;
}) {
  return (
    <div className="rb-table-wrap">
      <table className="rb-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c.key}>{row[c.key] ?? null}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── EmptyState ────────────────────────────────────────────────
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rb-empty">
      <h3>{title}</h3>
      {body ? <p>{body}</p> : null}
      {action ? <div style={{ marginTop: "var(--space-4)" }}>{action}</div> : null}
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────────
export function Spinner({ label = "Loading" }: { label?: string }) {
  return <span className="rb-spinner" role="status" aria-label={label} />;
}
