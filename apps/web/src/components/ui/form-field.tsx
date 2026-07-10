import type { ComponentProps } from "react";

interface FormFieldProps extends ComponentProps<"input"> {
  label: string;
}

export function FormField({ label, id, className = "", ...props }: FormFieldProps) {
  const fieldId = id ?? label.toLowerCase().replace(/\s+/g, "-");
  return (
    <label className={`field ${className}`.trim()} htmlFor={fieldId}>
      <span className="field__label">{label}</span>
      <input id={fieldId} className="field__input" {...props} />
    </label>
  );
}

interface SelectFieldProps extends ComponentProps<"select"> {
  label: string;
  options: Array<{ value: string; label: string }>;
}

export function SelectField({ label, id, options, className = "", ...props }: SelectFieldProps) {
  const fieldId = id ?? label.toLowerCase().replace(/\s+/g, "-");
  return (
    <label className={`field ${className}`.trim()} htmlFor={fieldId}>
      <span className="field__label">{label}</span>
      <select id={fieldId} className="field__select" {...props}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

interface TextAreaFieldProps extends ComponentProps<"textarea"> {
  label: string;
}

export function TextAreaField({
  label,
  id,
  className = "",
  ...props
}: TextAreaFieldProps) {
  const fieldId = id ?? label.toLowerCase().replace(/\s+/g, "-");
  return (
    <label className={`field ${className}`.trim()} htmlFor={fieldId}>
      <span className="field__label">{label}</span>
      <textarea id={fieldId} className="field__input field__textarea" {...props} />
    </label>
  );
}

export function FormError({ message }: { message: string }) {
  return <p className="form-error">{message}</p>;
}
