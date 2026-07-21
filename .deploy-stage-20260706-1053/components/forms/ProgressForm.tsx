"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface FormData {
  physicalAchievement: string;
  financialAchievement: string;
  completedDate: string;
  directDays: string;
  directPersons: string;
  indirectDays: string;
  indirectPersons: string;
  physicalDescription: string;
}

interface FormErrors {
  physicalAchievement?: string;
  financialAchievement?: string;
  completedDate?: string;
  directDays?: string;
  directPersons?: string;
  indirectDays?: string;
  indirectPersons?: string;
  physicalDescription?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const KERALA_GREEN = "#2E7D32";
const KERALA_GREEN_DARK = "#1B5E20";
const KERALA_GREEN_LIGHT = "#4CAF50";
const KERALA_GREEN_TINT = "#F1F8E9";
const KERALA_GREEN_BORDER = "#A5D6A7";
const GOLD = "#C8A951";
const GOLD_LIGHT = "#E8D28A";
const GOLD_DARK = "#9A7B2E";

// ─── Kerala Lotus SVG ─────────────────────────────────────────────────────────
const KeralaPalmIcon = () => (
  <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="18" cy="18" r="17" fill="none" stroke={GOLD} strokeWidth="1.5" />
    {/* Lotus petals */}
    {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
      <ellipse
        key={i}
        cx="18"
        cy="10"
        rx="2.5"
        ry="5"
        fill={i % 2 === 0 ? GOLD : GOLD_LIGHT}
        fillOpacity="0.85"
        transform={`rotate(${angle} 18 18)`}
      />
    ))}
    <circle cx="18" cy="18" r="4" fill={GOLD} />
    <circle cx="18" cy="18" r="2" fill={KERALA_GREEN_DARK} />
  </svg>
);

// ─── Field Label Component ─────────────────────────────────────────────────────
const FieldLabel = ({
  label,
  required,
  id,
  hint,
}: {
  label: string;
  required?: boolean;
  id: string;
  hint?: string;
}) => (
  <label
    htmlFor={id}
    style={{
      display: "block",
      fontSize: "0.7rem",
      fontWeight: 700,
      letterSpacing: "0.08em",
      textTransform: "uppercase" as const,
      color: KERALA_GREEN_DARK,
      marginBottom: "0.35rem",
    }}
  >
    {label}
    {required && (
      <span style={{ color: "#C62828", marginLeft: "3px" }} aria-hidden="true">
        *
      </span>
    )}
    {hint && (
      <span
        style={{
          display: "block",
          fontSize: "0.65rem",
          fontWeight: 400,
          letterSpacing: "0",
          textTransform: "none" as const,
          color: "#5D4037",
          marginTop: "2px",
          fontStyle: "italic",
        }}
      >
        {hint}
      </span>
    )}
  </label>
);

// ─── Input Component ──────────────────────────────────────────────────────────
const FormInput = ({
  id,
  type = "text",
  value,
  onChange,
  disabled = false,
  readOnly = false,
  placeholder,
  error,
  min,
  max,
  step,
  suffix,
}: {
  id: string;
  type?: string;
  value: string;
  onChange?: (v: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  error?: string;
  min?: string;
  max?: string;
  step?: string;
  suffix?: string;
}) => {
  const baseStyle: React.CSSProperties = {
    width: "100%",
    padding: suffix ? "0.55rem 2.5rem 0.55rem 0.75rem" : "0.55rem 0.75rem",
    fontSize: "0.9rem",
    fontFamily: "inherit",
    fontVariantNumeric: "tabular-nums",
    border: `1.5px solid ${error ? "#C62828" : disabled || readOnly ? "#C8E6C9" : KERALA_GREEN_BORDER}`,
    borderRadius: "6px",
    background: disabled || readOnly ? "#E8F5E9" : "#FFFFFF",
    color: disabled ? "#6A8F6D" : readOnly ? KERALA_GREEN_DARK : "#1A1A1A",
    outline: "none",
    transition: "border-color 0.15s, box-shadow 0.15s",
    boxSizing: "border-box" as const,
    cursor: disabled ? "not-allowed" : readOnly ? "default" : "text",
  };

  return (
    <div style={{ position: "relative" }}>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        disabled={disabled}
        readOnly={readOnly}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        style={baseStyle}
        onFocus={(e) => {
          if (!disabled && !readOnly) {
            e.currentTarget.style.borderColor = KERALA_GREEN;
            e.currentTarget.style.boxShadow = `0 0 0 3px ${KERALA_GREEN}22`;
          }
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = error
            ? "#C62828"
            : disabled || readOnly
            ? "#C8E6C9"
            : KERALA_GREEN_BORDER;
          e.currentTarget.style.boxShadow = "none";
        }}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {suffix && (
        <span
          style={{
            position: "absolute",
            right: "0.65rem",
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: "0.75rem",
            color: "#7B8C7D",
            pointerEvents: "none",
          }}
        >
          {suffix}
        </span>
      )}
      {error && (
        <span
          id={`${id}-error`}
          role="alert"
          style={{
            display: "block",
            fontSize: "0.7rem",
            color: "#C62828",
            marginTop: "3px",
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
};

// ─── Section Header ───────────────────────────────────────────────────────────
const SectionHeader = ({ title, icon }: { title: string; icon: string }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
      marginBottom: "1rem",
      paddingBottom: "0.5rem",
      borderBottom: `2px solid ${GOLD}`,
    }}
  >
    <span style={{ fontSize: "1rem" }}>{icon}</span>
    <h3
      style={{
        margin: 0,
        fontSize: "0.8rem",
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase" as const,
        color: KERALA_GREEN_DARK,
      }}
    >
      {title}
    </h3>
  </div>
);

// ─── Main Form Component ───────────────────────────────────────────────────────
export default function NodalOfficerForm() {
  const [form, setForm] = useState<FormData>({
    physicalAchievement: "",
    financialAchievement: "",
    completedDate: "",
    directDays: "",
    directPersons: "",
    indirectDays: "",
    indirectPersons: "",
    physicalDescription: "",
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [percentage, setPercentage] = useState<string>("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-calc percentage (capped at 100)
  useEffect(() => {
    const val = parseFloat(form.physicalAchievement);
    if (!isNaN(val) && val >= 0) {
      const pct = Math.min(100, Math.round(val * 10) / 10);
      setPercentage(`${pct}%`);
    } else {
      setPercentage("");
    }
  }, [form.physicalAchievement]);

  const isHundredPercent = parseFloat(form.physicalAchievement) >= 100;

  const setField = useCallback(
    (field: keyof FormData) => (value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    },
    [errors]
  );

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    const physVal = parseFloat(form.physicalAchievement);
    const finVal = parseFloat(form.financialAchievement);

    if (!form.physicalAchievement) {
      newErrors.physicalAchievement = "Physical achievement value is required.";
    } else if (isNaN(physVal) || physVal < 0 || physVal > 100) {
      newErrors.physicalAchievement = "Enter a value between 0 and 100.";
    }

    if (!form.financialAchievement) {
      newErrors.financialAchievement = "Financial achievement is required.";
    } else if (isNaN(finVal) || finVal < 0) {
      newErrors.financialAchievement = "Enter a valid non-negative amount.";
    }

    if (isHundredPercent && !form.completedDate) {
      newErrors.completedDate = "Completion date is required at 100%.";
    }

    if (form.directDays && (isNaN(Number(form.directDays)) || Number(form.directDays) < 0)) {
      newErrors.directDays = "Enter a valid number.";
    }
    if (form.directPersons && (isNaN(Number(form.directPersons)) || Number(form.directPersons) < 0)) {
      newErrors.directPersons = "Enter a valid number.";
    }
    if (form.indirectDays && (isNaN(Number(form.indirectDays)) || Number(form.indirectDays) < 0)) {
      newErrors.indirectDays = "Enter a valid number.";
    }
    if (form.indirectPersons && (isNaN(Number(form.indirectPersons)) || Number(form.indirectPersons) < 0)) {
      newErrors.indirectPersons = "Enter a valid number.";
    }

    if (!form.physicalDescription.trim()) {
      newErrors.physicalDescription = "Please provide a description of physical achievement.";
    } else if (form.physicalDescription.trim().length < 20) {
      newErrors.physicalDescription = "Description must be at least 20 characters.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 900));
    setIsSubmitting(false);
    setSubmitted(true);
  };

  const handleReset = () => {
    setForm({
      physicalAchievement: "",
      financialAchievement: "",
      completedDate: "",
      directDays: "",
      directPersons: "",
      indirectDays: "",
      indirectPersons: "",
      physicalDescription: "",
    });
    setErrors({});
    setPercentage("");
    setSubmitted(false);
  };

  // ── Success State ────────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: `linear-gradient(160deg, ${KERALA_GREEN_TINT} 0%, #FFFDE7 100%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: "12px",
            padding: "3rem 2.5rem",
            textAlign: "center",
            maxWidth: "480px",
            width: "100%",
            boxShadow: "0 8px 32px rgba(46,125,50,0.15)",
            border: `2px solid ${KERALA_GREEN_BORDER}`,
          }}
        >
          <div style={{ fontSize: "3.5rem", marginBottom: "1rem" }}>✅</div>
          <h2
            style={{
              margin: "0 0 0.5rem",
              color: KERALA_GREEN_DARK,
              fontSize: "1.4rem",
              fontWeight: 700,
            }}
          >
            Progress Update Submitted
          </h2>
          <p style={{ color: "#5D4037", margin: "0 0 0.5rem", fontSize: "0.95rem" }}>
            Appendix C.3 — Nodal Officer Indicator Report
          </p>
          <div
            style={{
              background: KERALA_GREEN_TINT,
              border: `1px solid ${KERALA_GREEN_BORDER}`,
              borderRadius: "8px",
              padding: "1rem",
              margin: "1.5rem 0",
              textAlign: "left",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0.5rem 1rem",
                fontSize: "0.82rem",
              }}
            >
              <span style={{ color: "#6A8F6D", fontWeight: 600 }}>Physical Achievement</span>
              <span style={{ color: KERALA_GREEN_DARK, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                {form.physicalAchievement} ({percentage})
              </span>
              <span style={{ color: "#6A8F6D", fontWeight: 600 }}>Financial Achievement</span>
              <span style={{ color: KERALA_GREEN_DARK, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                ₹ {parseFloat(form.financialAchievement).toLocaleString("en-IN")}
              </span>
              {form.completedDate && (
                <>
                  <span style={{ color: "#6A8F6D", fontWeight: 600 }}>Completed On</span>
                  <span style={{ color: KERALA_GREEN_DARK, fontWeight: 700 }}>
                    {new Date(form.completedDate).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </>
              )}
            </div>
          </div>
          <button
            onClick={handleReset}
            style={{
              width: "100%",
              padding: "0.8rem",
              background: KERALA_GREEN,
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontSize: "0.9rem",
              fontWeight: 700,
              letterSpacing: "0.05em",
              cursor: "pointer",
            }}
          >
            Submit Another Update
          </button>
        </div>
      </div>
    );
  }

  // ── Form ─────────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        minHeight: "100vh",
        background: `linear-gradient(160deg, ${KERALA_GREEN_TINT} 0%, #FFFDE7 60%, #F9F9F9 100%)`,
        fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
        padding: "1.5rem 1rem 3rem",
      }}
    >
      <div style={{ maxWidth: "780px", margin: "0 auto" }}>
        {/* ── Header ── */}
        <div
          style={{
            background: `linear-gradient(135deg, ${KERALA_GREEN_DARK} 0%, ${KERALA_GREEN} 100%)`,
            borderRadius: "12px 12px 0 0",
            padding: "0",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* Gold top rule */}
          <div style={{ height: "4px", background: `linear-gradient(90deg, ${GOLD_DARK}, ${GOLD}, ${GOLD_DARK})` }} />

          <div
            style={{
              padding: "1.4rem 1.8rem 1.5rem",
              display: "flex",
              alignItems: "flex-start",
              gap: "1rem",
            }}
          >
            <KeralaPalmIcon />
            <div style={{ flex: 1 }}>
              <p
                style={{
                  margin: "0 0 2px",
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase" as const,
                  color: GOLD_LIGHT,
                }}
              >
                Government of Kerala · HDP Blueprint
              </p>
              <h1
                style={{
                  margin: "0 0 3px",
                  fontSize: "1.2rem",
                  fontWeight: 800,
                  color: "#FFFFFF",
                  lineHeight: 1.25,
                }}
              >
                Nodal Officer Progress Update
              </h1>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.75rem",
                  color: "#A5D6A7",
                  fontWeight: 400,
                }}
              >
                Appendix C.3 — Indicator-Level Achievement Report
              </p>
            </div>
            <div
              style={{
                background: `${GOLD}22`,
                border: `1px solid ${GOLD}55`,
                borderRadius: "6px",
                padding: "0.4rem 0.75rem",
                textAlign: "center",
                flexShrink: 0,
              }}
            >
              <div style={{ fontSize: "0.6rem", color: GOLD_LIGHT, letterSpacing: "0.1em", fontWeight: 600 }}>
                FORM REF
              </div>
              <div style={{ fontSize: "0.85rem", color: GOLD, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                C.3
              </div>
            </div>
          </div>

          {/* Gold bottom rule */}
          <div style={{ height: "2px", background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }} />
        </div>

        {/* ── Form Body ── */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "0 0 12px 12px",
            boxShadow: "0 8px 32px rgba(46,125,50,0.12), 0 2px 8px rgba(0,0,0,0.06)",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "1.8rem 1.8rem 0" }}>
            {/* ── Section 1: Physical Achievement ── */}
            <div style={{ marginBottom: "1.8rem" }}>
              <SectionHeader title="Physical Achievement" icon="📊" />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "1rem",
                }}
              >
                <div>
                  <FieldLabel
                    label="Physical Achievement"
                    required
                    id="physicalAchievement"
                    hint="Enter value between 0–100"
                  />
                  <FormInput
                    id="physicalAchievement"
                    type="number"
                    value={form.physicalAchievement}
                    onChange={setField("physicalAchievement")}
                    min="0"
                    max="100"
                    step="0.1"
                    placeholder="e.g. 75.5"
                    error={errors.physicalAchievement}
                  />
                </div>
                <div>
                  <FieldLabel
                    label="Percentage Complete"
                    id="percentageComplete"
                    hint="Auto-calculated · read-only"
                  />
                  <div style={{ position: "relative" }}>
                    <FormInput
                      id="percentageComplete"
                      type="text"
                      value={percentage}
                      readOnly
                      placeholder="—"
                    />
                    {percentage && (
                      <div
                        style={{
                          position: "absolute",
                          bottom: 0,
                          left: 0,
                          height: "3px",
                          width: percentage,
                          background: `linear-gradient(90deg, ${KERALA_GREEN_LIGHT}, ${KERALA_GREEN})`,
                          borderRadius: "0 0 6px 6px",
                          transition: "width 0.4s ease",
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Section 2: Financial Achievement ── */}
            <div style={{ marginBottom: "1.8rem" }}>
              <SectionHeader title="Financial Achievement" icon="₹" />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "1rem",
                }}
              >
                <div>
                  <FieldLabel
                    label="Financial Achievement (₹)"
                    required
                    id="financialAchievement"
                    hint="Amount in Indian Rupees"
                  />
                  <FormInput
                    id="financialAchievement"
                    type="number"
                    value={form.financialAchievement}
                    onChange={setField("financialAchievement")}
                    min="0"
                    step="0.01"
                    placeholder="e.g. 250000"
                    error={errors.financialAchievement}
                    suffix="INR"
                  />
                </div>
                <div>
                  <FieldLabel
                    label="Completed Date"
                    required={isHundredPercent}
                    id="completedDate"
                    hint={
                      isHundredPercent
                        ? "Required — achievement is at 100%"
                        : "Enabled only when achievement = 100%"
                    }
                  />
                  <FormInput
                    id="completedDate"
                    type="date"
                    value={form.completedDate}
                    onChange={setField("completedDate")}
                    disabled={!isHundredPercent}
                    error={errors.completedDate}
                  />
                </div>
              </div>
            </div>

            {/* ── Section 3: Employment Generation ── */}
            <div style={{ marginBottom: "1.8rem" }}>
              <SectionHeader title="Employment Generation" icon="👥" />

              {/* 4-column grid with category headers */}
              <div
                style={{
                  border: `1.5px solid ${KERALA_GREEN_BORDER}`,
                  borderRadius: "8px",
                  overflow: "hidden",
                }}
              >
                {/* Column Headers */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "120px 1fr 1fr 1fr 1fr",
                    background: KERALA_GREEN_DARK,
                    padding: "0.5rem 0.75rem",
                    gap: "0.75rem",
                    alignItems: "center",
                  }}
                >
                  <div />
                  {["Days — Direct", "Persons — Direct", "Days — Indirect", "Persons — Indirect"].map((h) => (
                    <div
                      key={h}
                      style={{
                        fontSize: "0.62rem",
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase" as const,
                        color: GOLD_LIGHT,
                        textAlign: "center",
                      }}
                    >
                      {h}
                    </div>
                  ))}
                </div>

                {/* Data Row */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "120px 1fr 1fr 1fr 1fr",
                    padding: "0.85rem 0.75rem",
                    gap: "0.75rem",
                    alignItems: "start",
                    background: KERALA_GREEN_TINT,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      color: KERALA_GREEN_DARK,
                      letterSpacing: "0.05em",
                      paddingTop: "0.55rem",
                    }}
                  >
                    Employment
                  </div>
                  <div>
                    <FormInput
                      id="directDays"
                      type="number"
                      value={form.directDays}
                      onChange={setField("directDays")}
                      min="0"
                      step="1"
                      placeholder="0"
                      error={errors.directDays}
                    />
                  </div>
                  <div>
                    <FormInput
                      id="directPersons"
                      type="number"
                      value={form.directPersons}
                      onChange={setField("directPersons")}
                      min="0"
                      step="1"
                      placeholder="0"
                      error={errors.directPersons}
                    />
                  </div>
                  <div>
                    <FormInput
                      id="indirectDays"
                      type="number"
                      value={form.indirectDays}
                      onChange={setField("indirectDays")}
                      min="0"
                      step="1"
                      placeholder="0"
                      error={errors.indirectDays}
                    />
                  </div>
                  <div>
                    <FormInput
                      id="indirectPersons"
                      type="number"
                      value={form.indirectPersons}
                      onChange={setField("indirectPersons")}
                      min="0"
                      step="1"
                      placeholder="0"
                      error={errors.indirectPersons}
                    />
                  </div>
                </div>

                {/* Summary Row */}
                {(form.directDays ||
                  form.directPersons ||
                  form.indirectDays ||
                  form.indirectPersons) && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "120px 1fr 1fr 1fr 1fr",
                      padding: "0.5rem 0.75rem",
                      gap: "0.75rem",
                      background: `${KERALA_GREEN}11`,
                      borderTop: `1px dashed ${KERALA_GREEN_BORDER}`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.65rem",
                        fontWeight: 700,
                        color: "#6A8F6D",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase" as const,
                      }}
                    >
                      Totals
                    </div>
                    {[
                      (Number(form.directDays) || 0) + (Number(form.indirectDays) || 0),
                      (Number(form.directPersons) || 0) + (Number(form.indirectPersons) || 0),
                    ].flatMap((v, i) => [
                      <div key={`blank-${i}`} />,
                      <div
                        key={`total-${i}`}
                        style={{
                          textAlign: "center",
                          fontSize: "0.8rem",
                          fontWeight: 700,
                          color: KERALA_GREEN_DARK,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {v > 0 ? v : "—"}
                      </div>,
                    ])}
                  </div>
                )}
              </div>
            </div>

            {/* ── Section 4: Description ── */}
            <div style={{ marginBottom: "1.8rem" }}>
              <SectionHeader title="Achievement Description" icon="📝" />
              <FieldLabel
                label="Physical Achievement Description"
                required
                id="physicalDescription"
                hint="Describe activities completed, milestones reached, and current status"
              />
              <textarea
                id="physicalDescription"
                name="physicalDescription"
                value={form.physicalDescription}
                onChange={(e) => {
                  setField("physicalDescription")(e.target.value);
                }}
                rows={5}
                placeholder="Describe the physical achievement in detail — works completed, infrastructure created, services delivered, and current field status..."
                style={{
                  width: "100%",
                  padding: "0.65rem 0.75rem",
                  fontSize: "0.88rem",
                  fontFamily: "inherit",
                  border: `1.5px solid ${
                    errors.physicalDescription ? "#C62828" : KERALA_GREEN_BORDER
                  }`,
                  borderRadius: "6px",
                  background: "#FFFFFF",
                  color: "#1A1A1A",
                  outline: "none",
                  resize: "vertical",
                  lineHeight: 1.6,
                  boxSizing: "border-box" as const,
                  transition: "border-color 0.15s, box-shadow 0.15s",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = KERALA_GREEN;
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${KERALA_GREEN}22`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = errors.physicalDescription
                    ? "#C62828"
                    : KERALA_GREEN_BORDER;
                  e.currentTarget.style.boxShadow = "none";
                }}
                aria-invalid={!!errors.physicalDescription}
                aria-describedby={errors.physicalDescription ? "physicalDescription-error" : undefined}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: "4px",
                }}
              >
                {errors.physicalDescription ? (
                  <span
                    id="physicalDescription-error"
                    role="alert"
                    style={{ fontSize: "0.7rem", color: "#C62828" }}
                  >
                    {errors.physicalDescription}
                  </span>
                ) : (
                  <span />
                )}
                <span
                  style={{
                    fontSize: "0.68rem",
                    color:
                      form.physicalDescription.length < 20
                        ? "#9E9E9E"
                        : KERALA_GREEN,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {form.physicalDescription.length} chars
                </span>
              </div>
            </div>
          </div>

          {/* ── Footer / Submit ── */}
          <div
            style={{
              padding: "1.2rem 1.8rem 1.8rem",
              background: KERALA_GREEN_TINT,
              borderTop: `1px solid ${KERALA_GREEN_BORDER}`,
            }}
          >
            {/* Completion notice */}
            {isHundredPercent && (
              <div
                style={{
                  background: `${GOLD}18`,
                  border: `1px solid ${GOLD}88`,
                  borderRadius: "6px",
                  padding: "0.65rem 0.9rem",
                  marginBottom: "1rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  fontSize: "0.78rem",
                  color: GOLD_DARK,
                  fontWeight: 600,
                }}
              >
                <span>🏆</span>
                Achievement at 100% — Completed Date is now required to finalize the indicator.
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              style={{
                width: "100%",
                padding: "0.9rem 1.5rem",
                background: isSubmitting
                  ? "#81C784"
                  : `linear-gradient(135deg, ${KERALA_GREEN} 0%, ${KERALA_GREEN_DARK} 100%)`,
                color: "#FFFFFF",
                border: "none",
                borderRadius: "8px",
                fontSize: "0.95rem",
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase" as const,
                cursor: isSubmitting ? "wait" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.6rem",
                transition: "all 0.2s",
                boxShadow: isSubmitting
                  ? "none"
                  : `0 4px 14px ${KERALA_GREEN}55`,
                position: "relative",
                overflow: "hidden",
              }}
              onMouseEnter={(e) => {
                if (!isSubmitting) {
                  e.currentTarget.style.background = `linear-gradient(135deg, ${KERALA_GREEN_LIGHT} 0%, ${KERALA_GREEN} 100%)`;
                  e.currentTarget.style.boxShadow = `0 6px 20px ${KERALA_GREEN}66`;
                  e.currentTarget.style.transform = "translateY(-1px)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isSubmitting) {
                  e.currentTarget.style.background = `linear-gradient(135deg, ${KERALA_GREEN} 0%, ${KERALA_GREEN_DARK} 100%)`;
                  e.currentTarget.style.boxShadow = `0 4px 14px ${KERALA_GREEN}55`;
                  e.currentTarget.style.transform = "translateY(0)";
                }
              }}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span
                    style={{
                      display: "inline-block",
                      width: "16px",
                      height: "16px",
                      border: "2px solid #fff8",
                      borderTopColor: "#fff",
                      borderRadius: "50%",
                      animation: "spin 0.7s linear infinite",
                    }}
                  />
                  Submitting Update…
                </>
              ) : (
                <>
                  <span>📤</span>
                  Submit Progress Update
                </>
              )}
            </button>

            <p
              style={{
                textAlign: "center",
                margin: "0.75rem 0 0",
                fontSize: "0.68rem",
                color: "#7B8C7D",
              }}
            >
              Fields marked{" "}
              <span style={{ color: "#C62828", fontWeight: 700 }}>*</span> are mandatory.
              This report will be recorded under HDP Appendix C.3.
            </p>
          </div>
        </div>

        {/* Ref footer */}
        <div
          style={{
            textAlign: "center",
            marginTop: "1rem",
            fontSize: "0.65rem",
            color: "#9E9E9E",
            letterSpacing: "0.05em",
          }}
        >
          Centre for Digital Innovation &amp; Product Development · Digital University Kerala
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button { opacity: 0.4; }
        input[type="date"]:disabled { opacity: 0.5; }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}
