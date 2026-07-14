import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function CalculatorInputSection({
  children,
  defaultOpen = true,
  description,
  icon,
  summary,
  title,
}: {
  children: ReactNode;
  defaultOpen?: boolean;
  description?: string;
  icon: ReactNode;
  summary?: ReactNode;
  title: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();

  return (
    <section className={`calculator-input-section${open ? " open" : " collapsed"}`}>
      <header>
        <button
          aria-controls={bodyId}
          aria-expanded={open}
          className="calculator-input-header"
          type="button"
          onClick={() => setOpen((current) => !current)}
        >
          <span className="calculator-input-icon">{icon}</span>
          <span className="calculator-input-heading">
            <strong>{title}</strong>
            <small className="calculator-input-subline">
              {open ? description : summary}
            </small>
          </span>
          <ChevronDown className="calculator-input-chevron" aria-hidden="true" />
        </button>
      </header>
      <div className="calculator-input-body" id={bodyId} hidden={!open}>{children}</div>
    </section>
  );
}
