const BOOKING_TYPE_COPY = Object.freeze({
  studio: "Samen creëren, opnemen of muziek uitwerken.",
  dj: "Een muzikale lijn voor je feest, event of eigen concept.",
  other: "Iets anders in gedachten? Leg je idee kort aan Marc voor."
});

const moneyFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR"
});

export function formatMoneyFromCents(cents) {
  const safeCents = Number.isFinite(Number(cents)) ? Number(cents) : 0;
  return moneyFormatter.format(safeCents / 100);
}

export function normalizeTravelHours(value) {
  const hours = Number(String(value ?? "0").replace(",", "."));
  if (!Number.isFinite(hours) || hours <= 0) return 0;
  return Math.min(hours, 24);
}

export function calculateBookingTotals(type, slotCount = 1, travelHours = 0, travelRateCents = 7500) {
  const count = Math.max(1, Number.parseInt(String(slotCount), 10) || 1);
  const durationMinutes = type ? Number(type.durationMinutes) * count : 0;
  const performanceCents = type ? Number(type.priceCents) * count : 0;
  const travelCents = Math.ceil(normalizeTravelHours(travelHours)) * Number(travelRateCents || 0);

  return {
    count,
    durationMinutes,
    performanceCents,
    travelCents,
    totalCents: performanceCents + travelCents
  };
}

export function toInputDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function stripTime(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function sameDate(first, second) {
  return Boolean(first && second) &&
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate();
}

function formatDate(date) {
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(date);
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

function formatDuration(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return "—";
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} uur`;
  }
  return `${minutes} min`;
}

function setupBooking() {
  const bookingForm = document.querySelector("[data-booking-form]");
  if (!bookingForm) return;

  const bookingTypeOptions = document.querySelector("[data-booking-type-options]");
  const bookingDate = document.querySelector("[data-booking-date]");
  const calendarMonth = document.querySelector("[data-calendar-month]");
  const calendarGrid = document.querySelector("[data-calendar-grid]");
  const selectedDateText = document.querySelector("[data-selected-date]");
  const slotGrid = document.querySelector("[data-slot-grid]");
  const slotEmpty = document.querySelector("[data-slot-empty]");
  const slotCountField = document.querySelector("[data-slot-count-field]");
  const slotCount = document.querySelector("[data-slot-count]");
  const travelHours = document.querySelector("[data-travel-hours]");
  const travelRate = document.querySelector("[data-travel-rate]");
  const bookingSubmit = document.querySelector("[data-booking-submit]");
  const bookingStatus = document.querySelector("[data-booking-status]");
  const bookingServiceState = document.querySelector("[data-booking-service-state]");
  const bookingFallback = document.querySelector("[data-booking-fallback]");
  const prevMonth = document.querySelector("[data-prev-month]");
  const nextMonth = document.querySelector("[data-next-month]");
  const summaryType = document.querySelector("[data-summary-type]");
  const summaryDate = document.querySelector("[data-summary-date]");
  const summaryTime = document.querySelector("[data-summary-time]");
  const summaryDuration = document.querySelector("[data-summary-duration]");
  const performanceCost = document.querySelector("[data-performance-cost]");
  const travelCost = document.querySelector("[data-travel-cost]");
  const invoiceTotal = document.querySelector("[data-invoice-total]");

  let bookingConfig = null;
  let selectedDate = null;
  let selectedSlot = null;
  let availableSlots = [];
  let availabilityController = null;
  let isSubmitting = false;
  let integrationReady = false;
  const today = stripTime(new Date());
  let minDate = addDays(today, 1);
  let monthCursor = new Date(minDate.getFullYear(), minDate.getMonth(), 1);

  function getSelectedType() {
    const selectedInput = bookingForm.querySelector('input[name="bookingType"]:checked');
    return bookingConfig?.bookingTypes.find((type) => type.id === selectedInput?.value) || null;
  }

  function getSelectedSlotCount() {
    return Math.max(1, Number.parseInt(slotCount.value || "1", 10) || 1);
  }

  function formatClock(date) {
    return new Intl.DateTimeFormat("nl-NL", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: bookingConfig?.timeZone || "Europe/Amsterdam"
    }).format(date);
  }

  function setBookingStatus(message, isError = false) {
    bookingStatus.textContent = message;
    bookingStatus.classList.toggle("is-error", isError);
    bookingStatus.setAttribute("role", isError ? "alert" : "status");
  }

  function setFieldError(fieldName, show) {
    const error = bookingForm.querySelector(`[data-error-for="${fieldName}"]`);
    if (error) error.hidden = !show;
  }

  function updateSubmitState() {
    bookingSubmit.disabled = !selectedSlot || !integrationReady || isSubmitting;
    if (isSubmitting) {
      bookingSubmit.textContent = "Veilige betaling openen…";
    } else if (!integrationReady && bookingConfig) {
      bookingSubmit.textContent = "Online boeken tijdelijk niet beschikbaar";
    } else {
      bookingSubmit.textContent = "Boek en betaal veilig";
    }
  }

  function updateSummary() {
    const type = getSelectedType();
    const count = getSelectedSlotCount();
    const totals = calculateBookingTotals(
      type,
      count,
      travelHours.value,
      bookingConfig?.travelRateCentsPerHour || 7500
    );

    summaryType.textContent = type?.label || "Nog kiezen";
    summaryDate.textContent = selectedDate ? formatShortDate(selectedDate) : "Nog kiezen";
    summaryTime.textContent = selectedSlot?.label || "Nog kiezen";
    summaryDuration.textContent = formatDuration(totals.durationMinutes);
    performanceCost.textContent = type ? formatMoneyFromCents(totals.performanceCents) : "—";
    travelCost.textContent = type ? formatMoneyFromCents(totals.travelCents) : "—";
    invoiceTotal.textContent = type ? formatMoneyFromCents(totals.totalCents) : "—";

    if (travelRate) {
      travelRate.textContent = `Reiskosten: ${formatMoneyFromCents(bookingConfig?.travelRateCentsPerHour || 7500)} ex. btw per reisuur, afgerond naar boven.`;
    }
    updateSubmitState();
  }

  function renderBookingTypes() {
    const fragment = document.createDocumentFragment();

    bookingConfig.bookingTypes.forEach((type, index) => {
      const label = document.createElement("label");
      label.className = "booking-type-option";

      const input = document.createElement("input");
      input.type = "radio";
      input.name = "bookingType";
      input.value = type.id;
      input.required = true;
      input.checked = index === 0;

      const heading = document.createElement("strong");
      heading.textContent = type.label;

      const description = document.createElement("small");
      description.textContent = BOOKING_TYPE_COPY[type.id] || "Vertel Marc kort wat je wilt organiseren.";

      const meta = document.createElement("span");
      meta.className = "booking-type-meta";

      const duration = document.createElement("span");
      duration.textContent = formatDuration(type.durationMinutes);

      const price = document.createElement("span");
      price.textContent = `${formatMoneyFromCents(type.priceCents)} ex. btw`;

      meta.append(duration, price);
      label.append(input, heading, description, meta);
      fragment.append(label);
    });

    bookingTypeOptions.replaceChildren(fragment);
    updateSelectedTypeStyles();
  }

  function updateSelectedTypeStyles() {
    bookingTypeOptions.querySelectorAll(".booking-type-option").forEach((option) => {
      option.classList.toggle("is-selected", Boolean(option.querySelector("input:checked")));
    });
  }

  function renderCalendar() {
    calendarMonth.textContent = new Intl.DateTimeFormat("nl-NL", {
      month: "long",
      year: "numeric"
    }).format(monthCursor);
    calendarGrid.replaceChildren();

    const firstDay = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
    const lastDay = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0);
    const leadingSpaces = (firstDay.getDay() + 6) % 7;

    for (let index = 0; index < leadingSpaces; index += 1) {
      const spacer = document.createElement("div");
      spacer.className = "calendar-spacer";
      spacer.setAttribute("aria-hidden", "true");
      calendarGrid.append(spacer);
    }

    for (let day = 1; day <= lastDay.getDate(); day += 1) {
      const date = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), day);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "calendar-day";
      button.textContent = String(day);
      button.setAttribute("role", "gridcell");
      button.setAttribute("aria-label", formatDate(date));
      button.disabled = date < minDate;

      if (sameDate(date, today)) button.classList.add("is-today");
      if (sameDate(date, selectedDate)) {
        button.classList.add("is-selected");
        button.setAttribute("aria-current", "date");
      }

      button.addEventListener("click", () => {
        selectedDate = date;
        bookingDate.value = toInputDate(date);
        selectedDateText.textContent = formatDate(date);
        setFieldError("date", false);
        renderCalendar();
        updateSummary();
        loadAvailability();
      });
      calendarGrid.append(button);
    }

    const previous = new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1);
    const firstAllowedMonth = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    prevMonth.disabled = previous < firstAllowedMonth;
  }

  function getMaxConsecutiveSlotCount(slot) {
    const type = getSelectedType();
    if (!type || !slot) return 1;

    const maximum = bookingConfig?.maxConsecutiveSlots || 1;
    const availableStarts = new Set(availableSlots.map((item) => new Date(item.startUtc).getTime()));
    const firstStart = new Date(slot.startUtc).getTime();
    let count = 1;

    for (let nextCount = 2; nextCount <= maximum; nextCount += 1) {
      const expectedStart = firstStart + type.durationMinutes * 60 * 1000 * (nextCount - 1);
      if (!availableStarts.has(expectedStart)) break;
      count = nextCount;
    }
    return count;
  }

  function renderSlotCountOptions() {
    slotCount.replaceChildren();
    if (!selectedSlot || !getSelectedType()) {
      slotCountField.hidden = true;
      return;
    }

    const type = getSelectedType();
    const maximum = getMaxConsecutiveSlotCount(selectedSlot);
    const start = new Date(selectedSlot.startUtc).getTime();

    for (let count = 1; count <= maximum; count += 1) {
      const durationMinutes = type.durationMinutes * count;
      const end = new Date(start + durationMinutes * 60 * 1000);
      const option = document.createElement("option");
      option.value = String(count);
      option.textContent = `${count} ${count === 1 ? "blok" : "blokken"} · ${formatDuration(durationMinutes)} · tot ${formatClock(end)}`;
      slotCount.append(option);
    }

    slotCount.value = "1";
    slotCountField.hidden = false;
  }

  function renderSlots(slots) {
    selectedSlot = null;
    availableSlots = slots;
    slotGrid.replaceChildren();
    renderSlotCountOptions();
    setFieldError("slot", false);

    if (!slots.length) {
      slotEmpty.textContent = selectedDate
        ? "Op deze datum zijn geen tijden beschikbaar. Kies een andere datum."
        : "Kies eerst een boekingstype en datum.";
      slotEmpty.hidden = false;
      updateSummary();
      return;
    }

    slotEmpty.hidden = true;
    slots.forEach((slot) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "slot-button";
      button.textContent = slot.label;
      button.setAttribute("aria-pressed", "false");
      button.addEventListener("click", () => {
        selectedSlot = slot;
        slotGrid.querySelectorAll(".slot-button").forEach((item) => item.setAttribute("aria-pressed", "false"));
        button.setAttribute("aria-pressed", "true");
        setFieldError("slot", false);
        renderSlotCountOptions();
        updateSummary();
      });
      slotGrid.append(button);
    });
    updateSummary();
  }

  async function loadAvailability() {
    const type = getSelectedType();
    if (!bookingDate.value || !type) {
      renderSlots([]);
      return;
    }

    availabilityController?.abort();
    availabilityController = new AbortController();
    renderSlots([]);
    slotEmpty.hidden = false;
    slotEmpty.textContent = "Beschikbare tijden laden…";
    setBookingStatus("");

    try {
      const parameters = new URLSearchParams({
        date: bookingDate.value,
        bookingType: type.id
      });
      const response = await fetch(`/api/booking/availability?${parameters.toString()}`, {
        headers: { accept: "application/json" },
        cache: "no-store",
        signal: availabilityController.signal
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Beschikbaarheid kon niet worden opgehaald.");
      renderSlots(Array.isArray(payload.slots) ? payload.slots : []);

      if (payload.calendar?.status === "error") {
        setBookingStatus(payload.calendar.message || "De agenda kon niet volledig live worden gecontroleerd.");
      } else if (payload.slots?.length) {
        setBookingStatus("Kies de tijd die voor jou past.");
      }
    } catch (error) {
      if (error.name === "AbortError") return;
      renderSlots([]);
      setBookingStatus(error.message, true);
    }
  }

  function updateIntegrationState() {
    const integrations = bookingConfig?.integrations || {};
    integrationReady = Boolean(
      integrations.calendarConfigured &&
      integrations.crmConfigured &&
      integrations.mollieConfigured
    );
    bookingServiceState.classList.toggle("is-ready", integrationReady);
    bookingFallback.hidden = integrationReady;

    if (integrationReady) {
      bookingServiceState.textContent = "Live beschikbaarheid en veilige betaling zijn actief.";
    } else {
      bookingServiceState.textContent = "Je kunt de beschikbaarheid bekijken. Online betalen is op dit moment nog niet actief.";
    }
    updateSubmitState();
  }

  function validateField(field) {
    const trimmedValue = typeof field.value === "string" ? field.value.trim() : field.value;
    const emptyRequiredField = field.required && !trimmedValue;
    const isValid = !emptyRequiredField && field.validity.valid;
    field.setAttribute("aria-invalid", String(!isValid));
    setFieldError(field.name, !isValid);
    return isValid;
  }

  function validateForm() {
    const dateIsValid = Boolean(selectedDate);
    const slotIsValid = Boolean(selectedSlot);
    setFieldError("date", !dateIsValid);
    setFieldError("slot", !slotIsValid);

    const fields = [...bookingForm.querySelectorAll("input[name='name'], input[name='email'], input[name='phone'], input[name='location'], input[name='travelHours']")];
    const invalidFields = fields.filter((field) => !validateField(field));

    if (!dateIsValid) {
      document.querySelector(".calendar-picker")?.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (!slotIsValid) {
      document.querySelector(".slot-fieldset")?.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (invalidFields.length) {
      invalidFields[0].focus();
    }

    return dateIsValid && slotIsValid && invalidFields.length === 0;
  }

  async function submitBooking() {
    if (!integrationReady) {
      setBookingStatus("Online boeken is tijdelijk niet beschikbaar. Stuur Marc gerust een bericht via Instagram.", true);
      return;
    }
    if (!validateForm()) {
      setBookingStatus("Controleer de gemarkeerde gegevens.", true);
      return;
    }

    const type = getSelectedType();
    const payload = {
      bookingType: type.id,
      date: bookingDate.value,
      startUtc: selectedSlot.startUtc,
      slotCount: getSelectedSlotCount(),
      name: bookingForm.elements.name.value.trim(),
      email: bookingForm.elements.email.value.trim(),
      phone: bookingForm.elements.phone.value.trim(),
      location: bookingForm.elements.location.value.trim(),
      travelHours: normalizeTravelHours(travelHours.value),
      message: bookingForm.elements.message.value.trim()
    };

    isSubmitting = true;
    updateSubmitState();
    setBookingStatus("Betaling voorbereiden…");

    try {
      const response = await fetch("/api/booking/create", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "De boeking kon niet worden aangemaakt.");

      const checkoutUrl = new URL(result.checkoutUrl);
      if (checkoutUrl.protocol !== "https:") throw new Error("De veilige betaalpagina kon niet worden geopend.");
      window.location.assign(checkoutUrl.href);
    } catch (error) {
      isSubmitting = false;
      updateSubmitState();
      setBookingStatus(error.message, true);
    }
  }

  bookingTypeOptions.addEventListener("change", () => {
    updateSelectedTypeStyles();
    renderSlots([]);
    updateSummary();
    if (selectedDate) loadAvailability();
  });

  slotCount.addEventListener("change", updateSummary);
  travelHours.addEventListener("input", () => {
    if (travelHours.getAttribute("aria-invalid") === "true") validateField(travelHours);
    updateSummary();
  });

  bookingForm.querySelectorAll("input[name], textarea[name]").forEach((field) => {
    if (["date", "bookingType"].includes(field.name)) return;
    field.addEventListener("blur", () => {
      if (field.required || field.value) validateField(field);
    });
    field.addEventListener("input", () => {
      if (field.getAttribute("aria-invalid") === "true") validateField(field);
    });
  });

  prevMonth.addEventListener("click", () => {
    const previous = new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1);
    const firstAllowedMonth = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    if (previous >= firstAllowedMonth) {
      monthCursor = previous;
      renderCalendar();
    }
  });

  nextMonth.addEventListener("click", () => {
    monthCursor = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1);
    renderCalendar();
  });

  bookingForm.addEventListener("submit", (event) => {
    event.preventDefault();
    submitBooking();
  });

  async function initBooking() {
    renderCalendar();
    updateSummary();

    try {
      const response = await fetch("/api/booking/config", {
        headers: { accept: "application/json" },
        cache: "no-store"
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "De boekingsmodule kon niet worden geladen.");
      bookingConfig = payload;

      const leadDays = Math.max(1, Math.ceil((bookingConfig.minLeadHours || 24) / 24));
      minDate = addDays(today, leadDays);
      monthCursor = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
      renderBookingTypes();
      renderCalendar();
      updateIntegrationState();
      updateSummary();
    } catch (error) {
      bookingTypeOptions.textContent = "De boekingsmogelijkheden kunnen nu niet worden geladen.";
      bookingServiceState.textContent = "De verbinding met de boekingsmodule is tijdelijk niet beschikbaar.";
      bookingFallback.hidden = false;
      setBookingStatus(error.message, true);
    } finally {
      document.documentElement.classList.add("booking-ready");
    }
  }

  initBooking();
}

if (typeof document !== "undefined") {
  setupBooking();
}
