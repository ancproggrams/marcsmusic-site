export function requireLiveCalendar(calendarResult) {
  if (calendarResult?.status !== "connected" || !Array.isArray(calendarResult.busy)) {
    throw Object.assign(
      new Error("Boeken is tijdelijk niet beschikbaar omdat de agenda niet live kan worden gecontroleerd."),
      {
        statusCode: 503,
        code: "BOOKING_CALENDAR_UNAVAILABLE"
      }
    );
  }

  return calendarResult.busy;
}
