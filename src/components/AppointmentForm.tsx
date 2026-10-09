"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

const SERVICES = [
  { value: "sequencing", label: "Genome Sequencing" },
  { value: "cell-therapy", label: "Cell Therapy (referral)" },
  { value: "diagnostics", label: "Precision Diagnostics" },
  { value: "longevity", label: "Longevity Programme" },
  { value: "unsure", label: "Not sure yet — help me choose" },
];

const SLOTS = [
  { value: "morning", label: "Morning", hint: "08–11" },
  { value: "midday", label: "Midday", hint: "11–14" },
  { value: "afternoon", label: "Afternoon", hint: "14–18" },
];

type Field = "name" | "email" | "phone" | "service" | "date" | "slot" | "consent";
type Errors = Partial<Record<Field, string>>;

const ORDER: Field[] = ["name", "email", "phone", "service", "date", "slot", "consent"];

function todayISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function validate(data: FormData): Errors {
  const errors: Errors = {};
  const name = String(data.get("name") || "").trim();
  const email = String(data.get("email") || "").trim();
  const phone = String(data.get("phone") || "").trim();
  const service = String(data.get("service") || "");
  const date = String(data.get("date") || "");
  const slot = String(data.get("slot") || "");

  if (name.length < 2) errors.name = "Please tell us your name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = "Enter an email address like name@example.com.";
  if (phone && !/^[+()\d\s.-]{7,20}$/.test(phone)) errors.phone = "Use digits, spaces and an optional + only.";
  if (!service) errors.service = "Choose a service, or “Not sure yet”.";
  if (!date) errors.date = "Pick a preferred date.";
  else if (date < todayISO()) errors.date = "That date has passed — choose today or later.";
  else if (new Date(`${date}T12:00:00`).getDay() === 0) errors.date = "We're closed on Sundays — please pick another day.";
  if (!slot) errors.slot = "Choose a time of day.";
  if (!data.get("consent")) errors.consent = "We need your permission to contact you about this request.";
  return errors;
}

export default function AppointmentForm() {
  const [errors, setErrors] = useState<Errors>({});
  const [done, setDone] = useState<{ ref: string; name: string } | null>(null);
  const [announce, setAnnounce] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (dateRef.current) dateRef.current.min = todayISO();
  }, [done]);

  useEffect(() => {
    if (done) doneRef.current?.focus();
  }, [done]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const found = validate(new FormData(form));
    setErrors(found);
    const first = ORDER.find((f) => found[f]);
    if (first) {
      const count = Object.keys(found).length;
      setAnnounce(`${count} ${count === 1 ? "field needs" : "fields need"} attention.`);
      const el = form.querySelector<HTMLElement>(`[name="${first}"]`);
      el?.focus();
      return;
    }
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let ref = "HX-";
    for (let i = 0; i < 4; i++) ref += chars[Math.floor(Math.random() * chars.length)];
    const name = String(new FormData(form).get("name") || "").trim().split(/\s+/)[0];
    setAnnounce("");
    setDone({ ref, name });
  }

  function clearError(field: Field) {
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  }

  if (done) {
    return (
      <div className="booking__done" role="status">
        <p className="tag tag--on-ink">Request logged · {done.ref}</p>
        <h3 ref={doneRef} tabIndex={-1} className="booking__done-title">
          Request received{done.name ? `, ${done.name}` : ""}.
        </h3>
        <p>
          A coordinator would now reply within one working day to confirm your time. This is a concept site, so nothing was
          sent — but that&rsquo;s exactly how it would feel.
        </p>
        <button
          type="button"
          className="btn btn--ghost-ink"
          onClick={() => {
            setDone(null);
            setErrors({});
          }}
        >
          Make another request
        </button>
      </div>
    );
  }

  const describe = (f: Field, hint?: string) =>
    [hint, errors[f] ? `${f}-error` : null].filter(Boolean).join(" ") || undefined;

  return (
    <form ref={formRef} className="booking__form" noValidate onSubmit={onSubmit} aria-describedby="booking-note">
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      <div className="field">
        <label htmlFor="name">Full name</label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          required
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={describe("name")}
          onInput={() => clearError("name")}
        />
        {errors.name ? <p className="field__error" id="name-error">{errors.name}</p> : null}
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={describe("email")}
            onInput={() => clearError("email")}
          />
          {errors.email ? <p className="field__error" id="email-error">{errors.email}</p> : null}
        </div>
        <div className="field">
          <label htmlFor="phone">
            Phone <span className="field__opt">(optional)</span>
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            aria-invalid={errors.phone ? true : undefined}
            aria-describedby={describe("phone")}
            onInput={() => clearError("phone")}
          />
          {errors.phone ? <p className="field__error" id="phone-error">{errors.phone}</p> : null}
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="service">Service</label>
          <div className="select">
            <select
              id="service"
              name="service"
              required
              defaultValue=""
              aria-invalid={errors.service ? true : undefined}
              aria-describedby={describe("service")}
              onChange={() => clearError("service")}
            >
              <option value="" disabled>
                Choose a service
              </option>
              {SERVICES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          {errors.service ? <p className="field__error" id="service-error">{errors.service}</p> : null}
        </div>
        <div className="field">
          <label htmlFor="date">Preferred date</label>
          <input
            ref={dateRef}
            id="date"
            name="date"
            type="date"
            required
            aria-invalid={errors.date ? true : undefined}
            aria-describedby={describe("date", "date-hint")}
            onChange={() => clearError("date")}
          />
          <p className="field__hint" id="date-hint">
            Mon–Sat. We confirm the exact time with you.
          </p>
          {errors.date ? <p className="field__error" id="date-error">{errors.date}</p> : null}
        </div>
      </div>

      <fieldset className="field slots" aria-describedby={errors.slot ? "slot-error" : undefined}>
        <legend>Time of day</legend>
        <div className="slots__row">
          {SLOTS.map((s, i) => (
            <label key={s.value} className="slot">
              <input
                type="radio"
                name="slot"
                value={s.value}
                aria-invalid={errors.slot && i === 0 ? true : undefined}
                onChange={() => clearError("slot")}
              />
              <span className="slot__face">
                <span className="slot__label">{s.label}</span>
                <span className="slot__hint">{s.hint}</span>
              </span>
            </label>
          ))}
        </div>
        {errors.slot ? <p className="field__error" id="slot-error">{errors.slot}</p> : null}
      </fieldset>

      <div className="field">
        <label htmlFor="notes">
          Anything we should know? <span className="field__opt">(optional)</span>
        </label>
        <textarea id="notes" name="notes" rows={3} maxLength={600} />
      </div>

      <div className="field">
        <label className="check">
          <input
            type="checkbox"
            name="consent"
            aria-invalid={errors.consent ? true : undefined}
            aria-describedby={describe("consent")}
            onChange={() => clearError("consent")}
          />
          <span>I agree to Helix Labs contacting me about this request.</span>
        </label>
        {errors.consent ? <p className="field__error" id="consent-error">{errors.consent}</p> : null}
      </div>

      <div className="booking__actions">
        <button type="submit" className="btn btn--mint">
          Request appointment
        </button>
        <p className="booking__note" id="booking-note">
          Concept demo: nothing you type leaves this page.
        </p>
      </div>
    </form>
  );
}
