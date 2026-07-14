import type { PropsWithChildren, ReactNode } from "react";

type CalculatorCardProps = PropsWithChildren<{
  title: string;
  className?: string;
}>;

export function CalculatorCard({
  title,
  className = "",
  children,
}: CalculatorCardProps) {
  return (
    <section className={`card${className ? ` ${className}` : ""}`}>
      <div className="card-title">{title}</div>
      {children}
    </section>
  );
}

type MetricItemProps = {
  label: ReactNode;
  value: string;
  unit: string;
  subtext?: string;
  speedType?: "IAS" | "TAS";
  warn?: boolean;
  danger?: boolean;
};

export function MetricItem({
  label,
  value,
  unit,
  subtext,
  speedType,
  warn = false,
  danger = false,
}: MetricItemProps) {
  return (
    <div className={`result-item${danger ? " danger" : warn ? " warn" : ""}`}>
      <div className="result-item-label">{label}</div>
      <div className="result-item-value">
        {value} <span>{unit}</span>
        {speedType ? (
          <span className={`speed-type-badge speed-type-${speedType.toLowerCase()}`}>
            {speedType}
          </span>
        ) : null}
      </div>
      {subtext ? <div className="result-item-sub">{subtext}</div> : null}
    </div>
  );
}

export function SpeedSymbol({ index }: { index: string }) {
  return (
    <span className="speed-symbol">
      V<sub>{index}</sub>
    </span>
  );
}
