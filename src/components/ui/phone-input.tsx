import * as React from "react";
import PhoneInputWithCountry, { Country, isValidPhoneNumber } from "react-phone-number-input";
import flags from "react-phone-number-input/flags";
import "./phone-input.css";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Check, AlertCircle } from "lucide-react";

export interface PhoneInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  defaultCountry?: Country;
  disabled?: boolean;
  error?: string;
  helperText?: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
}

// Criar o inputComponent fora do render para evitar recriação
const CustomPhoneInput = React.forwardRef<HTMLInputElement, any>(
  (props, ref) => (
    <Input
      {...props}
      ref={ref}
      className={cn(
        "pl-14 text-base min-h-[44px]",
        props.className
      )}
      style={{ fontSize: "16px" }}
    />
  )
);
CustomPhoneInput.displayName = "CustomPhoneInput";

export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  (
    {
      id,
      value,
      onChange,
      defaultCountry = "BR",
      disabled = false,
      error,
      helperText,
      label,
      placeholder = "Digite seu número",
      required = false,
    },
    ref
  ) => {
    const [touched, setTouched] = React.useState(false);
    const isValid = value && isValidPhoneNumber(value);
    const showError = touched && error;
    const showSuccess = touched && isValid && !error;

    return (
      <div className="space-y-2">
        {label && (
          <Label htmlFor={id} className="text-base font-medium">
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
        )}

        <div className={cn("relative", showError && "phone-input-error", showSuccess && "phone-input-success")}>
          <PhoneInputWithCountry
            flags={flags}
            defaultCountry={defaultCountry}
            value={value}
            onChange={(val) => {
              onChange(val || "");
              if (!touched) setTouched(true);
            }}
            onBlur={() => setTouched(true)}
            disabled={disabled}
            inputComponent={CustomPhoneInput}
            id={id}
            placeholder={placeholder}
            aria-invalid={!!showError}
            aria-describedby={showError ? `${id}-error` : helperText ? `${id}-helper` : undefined}
            countrySelectProps={{
              "aria-label": "Selecione o país",
              className: cn(
                "absolute left-3 top-1/2 -translate-y-1/2 z-10",
                "min-w-[44px] min-h-[44px]",
                "border-0 bg-transparent",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              ),
            }}
            className="relative"
          />

          {/* Ícone de feedback visual */}
          {showSuccess && (
            <Check
              className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-600"
              aria-hidden="true"
            />
          )}
          {showError && (
            <AlertCircle
              className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-destructive"
              aria-hidden="true"
            />
          )}
        </div>

        {/* Mensagens de ajuda e erro */}
        {helperText && !showError && (
          <p
            id={`${id}-helper`}
            className="text-sm text-muted-foreground"
            role="note"
          >
            {helperText}
          </p>
        )}

        {showError && (
          <p
            id={`${id}-error`}
            className="text-sm font-medium text-destructive flex items-start gap-1.5"
            role="alert"
            aria-live="polite"
          >
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </p>
        )}
      </div>
    );
  }
);

PhoneInput.displayName = "PhoneInput";
