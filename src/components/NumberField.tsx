type NumberFieldProps = {
  label: string;
  unit: string;
  value: number;
  step?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
};

export function NumberField({
  label,
  unit,
  value,
  step = 1,
  disabled = false,
  onChange,
}: NumberFieldProps) {
  return (
    <div className="field">
      <div className="field-label">
        {label} <span>{unit}</span>
      </div>
      <div className="input-wrap">
        <input
          type="number"
          disabled={disabled}
          step={step}
          value={value}
          onFocus={(event) => event.currentTarget.select()}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          onChange={(event) => {
            const parsedValue = Number.parseFloat(event.target.value);
            if (Number.isFinite(parsedValue)) onChange(parsedValue);
          }}
        />
        <span className="unit">{unit}</span>
      </div>
    </div>
  );
}
