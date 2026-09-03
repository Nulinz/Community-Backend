/**
 * Determines whether an event, conference, seminar, or competition has ended.
 * Evaluates against eventEndDate (or eventDate) and eventEndTime with the current timestamp.
 *
 * @param {Date|string} eventDate - Scheduled date of the event
 * @param {Date|string} [eventEndDate] - Optional multi-day event end date
 * @param {string} [eventEndTime] - Optional end time string (e.g. "05:00 PM", "17:00")
 * @returns {boolean} True if the event has concluded, false otherwise.
 */
export const checkIsEnded = (eventDate, eventEndDate = null, eventEndTime = null) => {
  try {
    const rawDate = eventEndDate || eventDate;
    if (!rawDate) return false;

    const baseDate = new Date(rawDate);
    if (isNaN(baseDate.getTime())) return false;

    const now = new Date();

    if (eventEndTime && typeof eventEndTime === "string" && eventEndTime.trim()) {
      const timeStr = eventEndTime.trim();
      // Match formats: "05:00 PM", "5:00 PM", "17:00", "17:30:00", "5:00pm", etc.
      const match = timeStr.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([aApP][mM])?$/i);
      if (match) {
        let hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const period = match[3]?.toUpperCase();

        if (period === "PM" && hours < 12) hours += 12;
        if (period === "AM" && hours === 12) hours = 0;

        const endDateTime = new Date(baseDate);
        endDateTime.setHours(hours, minutes, 0, 0);

        return now.getTime() > endDateTime.getTime();
      }
    }

    // Default fallback: if no eventEndTime specified, conclude at the end of the day (23:59:59.999)
    const endOfDay = new Date(baseDate);
    endOfDay.setHours(23, 59, 59, 999);
    return now.getTime() > endOfDay.getTime();
  } catch (err) {
    return false;
  }
};
