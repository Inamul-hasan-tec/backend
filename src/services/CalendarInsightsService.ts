import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../config/db';

export type MoonPhaseKey =
  | 'new_moon'
  | 'waxing_crescent'
  | 'first_quarter'
  | 'waxing_gibbous'
  | 'full_moon'
  | 'waning_gibbous'
  | 'last_quarter'
  | 'waning_crescent';

interface CalendarInsightsParams {
  tenantId: number;
  year: number;
  month: number;
  hallId?: number;
  city?: string;
  region?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
}

interface ImportResult {
  recordsImported: number;
  eventsImported: number;
}

interface CalendarPreferenceParams {
  tenantId: number;
  hallId?: number;
  city?: string;
  region?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  defaultCalendarMode?: string;
  enabledLayers?: string[];
  hijriAdjustmentDays?: number;
}

const SYNODIC_MONTH = 29.530588853;
const KNOWN_NEW_MOON_JULIAN_DAY = 2451550.1;

const PHASES: Array<{ key: MoonPhaseKey; name: string }> = [
  { key: 'new_moon', name: 'New Moon' },
  { key: 'waxing_crescent', name: 'Waxing Crescent' },
  { key: 'first_quarter', name: 'First Quarter' },
  { key: 'waxing_gibbous', name: 'Waxing Gibbous' },
  { key: 'full_moon', name: 'Full Moon' },
  { key: 'waning_gibbous', name: 'Waning Gibbous' },
  { key: 'last_quarter', name: 'Last Quarter' },
  { key: 'waning_crescent', name: 'Waning Crescent' },
];

const HIJRI_MONTHS = [
  'Muharram',
  'Safar',
  'Rabi al-Awwal',
  'Rabi al-Thani',
  'Jumada al-Awwal',
  'Jumada al-Thani',
  'Rajab',
  'Shaaban',
  'Ramadan',
  'Shawwal',
  'Dhu al-Qadah',
  'Dhu al-Hijjah',
];

const formatIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const julianDayFromDate = (date: Date) => date.getTime() / 86400000 + 2440587.5;

const getHijriParts = (date: Date, adjustmentDays = 0) => {
  const adjustedDate = new Date(date);
  adjustedDate.setDate(adjustedDate.getDate() + adjustmentDays);

  try {
    const parts = new Intl.DateTimeFormat('en-US-u-ca-islamic', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).formatToParts(adjustedDate);

    const day = Number(parts.find((part) => part.type === 'day')?.value || 0);
    const monthName = parts.find((part) => part.type === 'month')?.value || '';
    const year = Number(parts.find((part) => part.type === 'year')?.value || 0);
    const month = HIJRI_MONTHS.findIndex(
      (name) => name.toLowerCase() === monthName.toLowerCase()
    ) + 1;

    if (day && monthName && year) {
      return { day, month: month || 0, monthName, year };
    }
  } catch (error) {
    console.warn('Unable to calculate Hijri date', error);
  }

  return { day: 0, month: 0, monthName: 'Hijri', year: 0 };
};

const getDemandLabel = (phaseKey: MoonPhaseKey, badges: string[]) => {
  if (badges.some((badge) => /eid|ramadan|christmas|good friday/i.test(badge))) {
    return { label: 'High planning signal', score: 3 };
  }

  if (phaseKey === 'full_moon' || badges.length > 0) {
    return { label: 'Useful planning signal', score: 2 };
  }

  return { label: 'Normal', score: 1 };
};

const buildDayInsight = (date: Date, hijriAdjustmentDays = 0) => {
  const isoDate = formatIsoDate(date);
  const rawCycle =
    (julianDayFromDate(date) - KNOWN_NEW_MOON_JULIAN_DAY) / SYNODIC_MONTH;
  const phaseFraction = rawCycle - Math.floor(rawCycle);
  const age = phaseFraction * SYNODIC_MONTH;
  const phaseIndex = Math.round(phaseFraction * 8) % 8;
  const phase = PHASES[phaseIndex];
  const illumination = Math.round(
    ((1 - Math.cos(2 * Math.PI * phaseFraction)) / 2) * 100
  );
  const hijri = getHijriParts(date, hijriAdjustmentDays);
  const events = [];

  if (phase.key === 'full_moon') {
    events.push({
      calendarType: 'moon',
      community: 'General',
      title: 'Full Moon',
      eventType: 'moon_phase',
      importance: 2,
      confidence: 'calculated',
    });
  }

  if (phase.key === 'new_moon') {
    events.push({
      calendarType: 'moon',
      community: 'General',
      title: 'New Moon',
      eventType: 'moon_phase',
      importance: 2,
      confidence: 'calculated',
    });
  }

  if (hijri.monthName === 'Ramadan' && hijri.day === 1) {
    events.push({
      calendarType: 'hijri',
      community: 'Muslim',
      title: 'Expected Ramadan begins',
      eventType: 'religious',
      importance: 4,
      confidence: 'calculated',
    });
  }

  if (hijri.monthName === 'Shawwal' && hijri.day === 1) {
    events.push({
      calendarType: 'hijri',
      community: 'Muslim',
      title: 'Expected Eid al-Fitr',
      eventType: 'religious',
      importance: 4,
      confidence: 'calculated',
    });
  }

  if (hijri.monthName === 'Muharram' && hijri.day === 10) {
    events.push({
      calendarType: 'hijri',
      community: 'Muslim',
      title: 'Ashura',
      eventType: 'observance',
      importance: 3,
      confidence: 'calculated',
    });
  }

  if (isoDate.endsWith('-12-25')) {
    events.push({
      calendarType: 'christian',
      community: 'Christian',
      title: 'Christmas',
      eventType: 'religious',
      importance: 4,
      confidence: 'imported',
    });
  }

  const badges = events
    .filter((event) => event.importance >= 2)
    .slice(0, 2)
    .map((event) => event.title);
  const demand = getDemandLabel(phase.key, badges);

  return {
    date: isoDate,
    moon: {
      phaseKey: phase.key,
      phaseName: phase.name,
      illumination,
      age: Number(age.toFixed(1)),
      isFullMoon: phase.key === 'full_moon',
      isNewMoon: phase.key === 'new_moon',
    },
    hijri: {
      ...hijri,
      adjustmentDays: hijriAdjustmentDays,
      confidence: 'calculated',
    },
    events,
    display: {
      primaryLabel: badges[0] || phase.name,
      secondaryLabel: hijri.day ? `${hijri.day} ${hijri.monthName}` : phase.name,
      badges,
      demandLabel: demand.label,
      demandScore: demand.score,
    },
  };
};

const parseCsv = (content: string) => {
  const rows: string[][] = [];
  let current = '';
  let row: string[] = [];
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === ',' && !quoted) {
      row.push(current.trim());
      current = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') {
        index += 1;
      }
      row.push(current.trim());
      current = '';
      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    current += char;
  }

  row.push(current.trim());
  if (row.some((value) => value.length > 0)) {
    rows.push(row);
  }

  const [headers = [], ...dataRows] = rows;
  return dataRows.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] || '']))
  );
};

const numberOrDefault = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const booleanFromCsv = (value: string | undefined) =>
  ['true', '1', 'yes', 'y'].includes((value || '').toLowerCase());

const toDateRange = (year: number, month: number) => {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(year, month, 0);
  return {
    startDate,
    endDate: `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(
      2,
      '0'
    )}-${String(endDate.getDate()).padStart(2, '0')}`,
  };
};

export class CalendarInsightsService {
  static async getMonthlyInsights({
    tenantId,
    year,
    month,
    hallId,
    city = 'Mangalore',
    region = 'Karnataka',
    countryCode = 'IN',
    latitude = 12.9141,
    longitude = 74.856,
    timezone = 'Asia/Kolkata',
  }: CalendarInsightsParams) {
    const hijriAdjustmentDays = await this.getHijriAdjustmentDays(
      tenantId,
      hallId,
      city,
      timezone
    );
    const daysInMonth = new Date(year, month, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, index) =>
      buildDayInsight(new Date(year, month - 1, index + 1), hijriAdjustmentDays)
    );
    const data: Record<string, any> = Object.fromEntries(
      days.map((day) => [day.date, day])
    );
    const { startDate, endDate } = toDateRange(year, month);
    const [storedDays, storedEvents] = await Promise.all([
      this.getStoredDays(tenantId, startDate, endDate, city, timezone),
      this.getStoredEvents(tenantId, startDate, endDate, city),
    ]);

    storedDays.forEach((storedDay) => {
      const target = data[storedDay.date];
      if (!target) return;

      if (storedDay.hindu_tithi || storedDay.hindu_paksha || storedDay.hindu_nakshatra) {
        target.hindu = {
          tithi: storedDay.hindu_tithi || '',
          paksha: storedDay.hindu_paksha || '',
          nakshatra: storedDay.hindu_nakshatra || '',
          confidence: storedDay.panchang_confidence || 'imported',
        };
      }

      if (storedDay.hijri_adjustment_days !== null) {
        target.hijri.adjustmentDays = Number(storedDay.hijri_adjustment_days || 0);
      }

      if (storedDay.demand_label) {
        target.display.demandLabel = storedDay.demand_label;
        target.display.demandScore = Number(storedDay.demand_score || target.display.demandScore);
      }
    });

    storedEvents.forEach((event) => {
      const target = data[event.date];
      if (!target) return;

      target.events.push({
        calendarType: event.calendar_type,
        community: event.community || 'General',
        title: event.title,
        eventType: event.event_type || 'observance',
        importance: Number(event.importance || 1),
        confidence: event.confidence || 'imported',
      });

      target.display.badges = Array.from(
        new Set(
          target.events
            .filter((item) => item.importance >= 2)
            .slice(0, 3)
            .map((item) => item.title)
        )
      );
      target.display.primaryLabel = target.display.badges[0] || target.display.primaryLabel;
      const demand = getDemandLabel(target.moon.phaseKey, target.display.badges);
      target.display.demandLabel =
        target.display.demandScore > demand.score
          ? target.display.demandLabel
          : demand.label;
      target.display.demandScore = Math.max(target.display.demandScore, demand.score);
    });

    return {
      success: true,
      year,
      month,
      location: {
        city,
        region,
        countryCode,
        latitude,
        longitude,
        timezone,
      },
      data,
      sources: [
        {
          name: 'Local Moon Calculation',
          type: 'moon',
          status: 'generated',
        },
        {
          name: 'Server Islamic Calendar Calculation',
          type: 'hijri',
          status: 'generated',
        },
        ...(storedDays.length > 0
          ? [
              {
                name: 'Stored Panchang Calendar Cache',
                type: 'hindu',
                status: 'cached',
              },
            ]
          : []),
        ...(storedEvents.length > 0
          ? [
              {
                name: 'Stored Cultural Events Cache',
                type: 'events',
                status: 'cached',
              },
            ]
          : []),
      ],
    };
  }

  static async importPanchangCsv(
    tenantId: number,
    content: string
  ): Promise<ImportResult> {
    const rows = parseCsv(content);
    let recordsImported = 0;
    let eventsImported = 0;

    for (const row of rows) {
      if (!row.date || !row.city) continue;

      await pool.execute<ResultSetHeader>(
        `INSERT INTO calendar_days (
          tenant_id, date, city, region, timezone, hindu_tithi, hindu_paksha,
          hindu_nakshatra, hindu_yoga, hindu_karana, hindu_month,
          panchang_source, panchang_confidence, demand_score, demand_label, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          region = VALUES(region),
          hindu_tithi = VALUES(hindu_tithi),
          hindu_paksha = VALUES(hindu_paksha),
          hindu_nakshatra = VALUES(hindu_nakshatra),
          hindu_yoga = VALUES(hindu_yoga),
          hindu_karana = VALUES(hindu_karana),
          hindu_month = VALUES(hindu_month),
          panchang_source = VALUES(panchang_source),
          panchang_confidence = VALUES(panchang_confidence),
          demand_score = GREATEST(demand_score, VALUES(demand_score)),
          demand_label = COALESCE(VALUES(demand_label), demand_label),
          notes = VALUES(notes)`,
        [
          tenantId,
          row.date,
          row.city,
          row.region || null,
          row.timezone || 'Asia/Kolkata',
          row.tithi || null,
          row.paksha || null,
          row.nakshatra || null,
          row.yoga || null,
          row.karana || null,
          row.hindu_month || null,
          row.source_name || null,
          row.confidence || 'imported',
          numberOrDefault(row.importance, 1),
          row.event_title || null,
          row.notes || null,
        ]
      );
      recordsImported += 1;

      if (row.event_title) {
        await this.upsertEvent(tenantId, {
          date: row.date,
          city: row.city,
          region: row.region,
          countryCode: 'IN',
          calendarType: 'hindu',
          community: 'Hindu',
          title: row.event_title,
          eventType: row.event_type || 'observance',
          importance: numberOrDefault(row.importance, 1),
          confidence: row.confidence || 'imported',
          sourceName: row.source_name,
          sourceUrl: row.source_url,
          notes: row.notes,
        });
        eventsImported += 1;
      }
    }

    await this.recordSourceRun(tenantId, 'csv_import', 'hindu_panchang', recordsImported);
    return { recordsImported, eventsImported };
  }

  static async importHolidayCsv(
    tenantId: number,
    content: string
  ): Promise<ImportResult> {
    const rows = parseCsv(content);
    let recordsImported = 0;

    for (const row of rows) {
      if (!row.date || !row.title) continue;

      await this.upsertEvent(tenantId, {
        date: row.date,
        city: row.region === 'All' ? null : row.region,
        region: row.region,
        countryCode: row.country_code || 'IN',
        calendarType: row.calendar_type || 'indian_public_holiday',
        community: row.community || 'General',
        title: row.title,
        localTitle: row.local_title,
        eventType: row.event_type || 'holiday',
        importance: numberOrDefault(row.importance, 1),
        confidence: 'imported',
        isPublicHoliday: booleanFromCsv(row.is_public_holiday),
        isOptionalHoliday: booleanFromCsv(row.is_optional_holiday),
        sourceName: row.source_name,
        sourceUrl: row.source_url,
        notes: row.notes,
      });
      recordsImported += 1;
    }

    await this.recordSourceRun(tenantId, 'csv_import', 'india_holidays', recordsImported);
    return { recordsImported, eventsImported: recordsImported };
  }

  static async getPreferences({
    tenantId,
    hallId,
    city = 'Mangalore',
    timezone = 'Asia/Kolkata',
  }: CalendarPreferenceParams) {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT tenant_id, hall_id, city, region, latitude, longitude, timezone,
              default_calendar_mode, enabled_layers, hijri_adjustment_days
       FROM hall_calendar_preferences
       WHERE tenant_id = ?
         AND hall_id = ?
         AND city = ?
         AND timezone = ?
       LIMIT 1`,
      [tenantId, hallId || 0, city, timezone]
    );

    return (
      rows[0] || {
        tenant_id: tenantId,
        hall_id: hallId || 0,
        city,
        region: 'Karnataka',
        latitude: 12.9141,
        longitude: 74.856,
        timezone,
        default_calendar_mode: 'bookings',
        enabled_layers: [
          'moon',
          'hijri',
          'hindu',
          'christian',
          'indian_public_holiday',
        ],
        hijri_adjustment_days: 0,
      }
    );
  }

  static async upsertPreferences({
    tenantId,
    hallId,
    city = 'Mangalore',
    region = 'Karnataka',
    latitude = 12.9141,
    longitude = 74.856,
    timezone = 'Asia/Kolkata',
    defaultCalendarMode = 'bookings',
    enabledLayers = [
      'moon',
      'hijri',
      'hindu',
      'christian',
      'indian_public_holiday',
    ],
    hijriAdjustmentDays = 0,
  }: CalendarPreferenceParams) {
    const safeAdjustment = Math.max(-1, Math.min(1, Math.trunc(hijriAdjustmentDays)));

    await pool.execute<ResultSetHeader>(
      `INSERT INTO hall_calendar_preferences (
        tenant_id, hall_id, city, region, latitude, longitude, timezone,
        default_calendar_mode, enabled_layers, hijri_adjustment_days
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        region = VALUES(region),
        latitude = VALUES(latitude),
        longitude = VALUES(longitude),
        default_calendar_mode = VALUES(default_calendar_mode),
        enabled_layers = VALUES(enabled_layers),
        hijri_adjustment_days = VALUES(hijri_adjustment_days)`,
      [
        tenantId,
        hallId || 0,
        city,
        region,
        latitude,
        longitude,
        timezone,
        defaultCalendarMode,
        JSON.stringify(enabledLayers),
        safeAdjustment,
      ]
    );

    return this.getPreferences({ tenantId, hallId, city, timezone });
  }

  private static async getHijriAdjustmentDays(
    tenantId: number,
    hallId: number | undefined,
    city: string,
    timezone: string
  ) {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT hijri_adjustment_days
       FROM hall_calendar_preferences
       WHERE tenant_id = ?
         AND hall_id IN (?, 0)
         AND city = ?
         AND timezone = ?
       ORDER BY hall_id DESC
       LIMIT 1`,
      [tenantId, hallId || 0, city, timezone]
    );

    return Number(rows[0]?.hijri_adjustment_days || 0);
  }

  private static async getStoredDays(
    tenantId: number,
    startDate: string,
    endDate: string,
    city: string,
    timezone: string
  ) {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT DATE_FORMAT(date, '%Y-%m-%d') AS date, hindu_tithi, hindu_paksha,
              hindu_nakshatra, panchang_confidence, hijri_adjustment_days,
              demand_score, demand_label
       FROM calendar_days
       WHERE tenant_id = ?
         AND date BETWEEN ? AND ?
         AND city = ?
         AND timezone = ?`,
      [tenantId, startDate, endDate, city, timezone]
    );

    return rows;
  }

  private static async getStoredEvents(
    tenantId: number,
    startDate: string,
    endDate: string,
    city: string
  ) {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT DATE_FORMAT(date, '%Y-%m-%d') AS date, calendar_type, community,
              title, event_type, importance, confidence
       FROM calendar_events
       WHERE tenant_id = ?
         AND date BETWEEN ? AND ?
         AND (city = ? OR city IS NULL)`,
      [tenantId, startDate, endDate, city]
    );

    return rows;
  }

  private static async upsertEvent(
    tenantId: number,
    event: {
      date: string;
      city?: string | null;
      region?: string;
      countryCode?: string;
      calendarType: string;
      community?: string;
      title: string;
      localTitle?: string;
      eventType?: string;
      importance?: number;
      confidence?: string;
      isPublicHoliday?: boolean;
      isOptionalHoliday?: boolean;
      sourceName?: string;
      sourceUrl?: string;
      notes?: string;
    }
  ) {
    await pool.execute<ResultSetHeader>(
      `INSERT INTO calendar_events (
        tenant_id, date, city, region, country_code, calendar_type, community,
        title, local_title, event_type, importance, confidence,
        is_public_holiday, is_optional_holiday, source_name, source_url, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        event.date,
        event.city || null,
        event.region || null,
        event.countryCode || 'IN',
        event.calendarType,
        event.community || null,
        event.title,
        event.localTitle || null,
        event.eventType || null,
        event.importance || 1,
        event.confidence || 'imported',
        Boolean(event.isPublicHoliday),
        Boolean(event.isOptionalHoliday),
        event.sourceName || null,
        event.sourceUrl || null,
        event.notes || null,
      ]
    );
  }

  private static async recordSourceRun(
    tenantId: number,
    provider: string,
    sourceType: string,
    recordsImported: number
  ) {
    await pool.execute<ResultSetHeader>(
      `INSERT INTO calendar_source_runs
        (tenant_id, provider, source_type, status, records_imported, completed_at)
       VALUES (?, ?, ?, 'completed', ?, CURRENT_TIMESTAMP)`,
      [tenantId, provider, sourceType, recordsImported]
    );
  }
}
