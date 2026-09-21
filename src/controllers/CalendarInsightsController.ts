import { Response } from 'express';
import { CalendarInsightsService } from '../services/CalendarInsightsService';
import { asyncHandler } from '../middleware/errorHandler';
import { TenantRequest } from '../middleware/tenantMiddleware';

const toNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const getCalendarInsights = asyncHandler(
  async (req: TenantRequest, res: Response) => {
    if (!req.tenantId) {
      return res.status(403).json({
        success: false,
        message: 'Tenant context is required',
      });
    }

    const now = new Date();
    const year = toNumber(req.query.year, now.getFullYear());
    const month = toNumber(req.query.month, now.getMonth() + 1);

    if (!Number.isInteger(year) || year < 1900 || year > 2200) {
      return res.status(400).json({
        success: false,
        message: 'year must be an integer between 1900 and 2200',
      });
    }

    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return res.status(400).json({
        success: false,
        message: 'month must be an integer from 1 to 12',
      });
    }

    const payload = await CalendarInsightsService.getMonthlyInsights({
      tenantId: req.tenantId,
      year,
      month,
      hallId: req.query.hall_id ? toNumber(req.query.hall_id, 0) : undefined,
      city: typeof req.query.city === 'string' ? req.query.city : undefined,
      region: typeof req.query.region === 'string' ? req.query.region : undefined,
      countryCode:
        typeof req.query.countryCode === 'string' ? req.query.countryCode : undefined,
      latitude: req.query.lat ? toNumber(req.query.lat, 12.9141) : undefined,
      longitude: req.query.lon ? toNumber(req.query.lon, 74.856) : undefined,
      timezone:
        typeof req.query.timezone === 'string' ? req.query.timezone : undefined,
    });

    return res.json(payload);
  }
);

export const importPanchangCsv = asyncHandler(
  async (req: TenantRequest, res: Response) => {
    if (!req.tenantId) {
      return res.status(403).json({
        success: false,
        message: 'Tenant context is required',
      });
    }

    if (!req.file?.buffer) {
      return res.status(400).json({
        success: false,
        message: 'CSV file is required',
      });
    }

    const result = await CalendarInsightsService.importPanchangCsv(
      req.tenantId,
      req.file.buffer.toString('utf8')
    );

    return res.json({
      success: true,
      message: 'Panchang CSV imported',
      data: result,
    });
  }
);

export const importHolidayCsv = asyncHandler(
  async (req: TenantRequest, res: Response) => {
    if (!req.tenantId) {
      return res.status(403).json({
        success: false,
        message: 'Tenant context is required',
      });
    }

    if (!req.file?.buffer) {
      return res.status(400).json({
        success: false,
        message: 'CSV file is required',
      });
    }

    const result = await CalendarInsightsService.importHolidayCsv(
      req.tenantId,
      req.file.buffer.toString('utf8')
    );

    return res.json({
      success: true,
      message: 'Holiday CSV imported',
      data: result,
    });
  }
);

export const getCalendarPreferences = asyncHandler(
  async (req: TenantRequest, res: Response) => {
    if (!req.tenantId) {
      return res.status(403).json({
        success: false,
        message: 'Tenant context is required',
      });
    }

    const preferences = await CalendarInsightsService.getPreferences({
      tenantId: req.tenantId,
      hallId: req.query.hall_id ? toNumber(req.query.hall_id, 0) : undefined,
      city: typeof req.query.city === 'string' ? req.query.city : undefined,
      timezone:
        typeof req.query.timezone === 'string' ? req.query.timezone : undefined,
    });

    return res.json({
      success: true,
      data: preferences,
    });
  }
);

export const updateCalendarPreferences = asyncHandler(
  async (req: TenantRequest, res: Response) => {
    if (!req.tenantId) {
      return res.status(403).json({
        success: false,
        message: 'Tenant context is required',
      });
    }

    const hijriAdjustmentDays = toNumber(req.body.hijri_adjustment_days, 0);
    if (![-1, 0, 1].includes(hijriAdjustmentDays)) {
      return res.status(400).json({
        success: false,
        message: 'hijri_adjustment_days must be -1, 0, or 1',
      });
    }

    const preferences = await CalendarInsightsService.upsertPreferences({
      tenantId: req.tenantId,
      hallId: req.body.hall_id ? toNumber(req.body.hall_id, 0) : undefined,
      city: typeof req.body.city === 'string' ? req.body.city : undefined,
      region: typeof req.body.region === 'string' ? req.body.region : undefined,
      latitude: req.body.latitude ? toNumber(req.body.latitude, 12.9141) : undefined,
      longitude: req.body.longitude ? toNumber(req.body.longitude, 74.856) : undefined,
      timezone:
        typeof req.body.timezone === 'string' ? req.body.timezone : undefined,
      defaultCalendarMode:
        typeof req.body.default_calendar_mode === 'string'
          ? req.body.default_calendar_mode
          : undefined,
      enabledLayers: Array.isArray(req.body.enabled_layers)
        ? req.body.enabled_layers
        : undefined,
      hijriAdjustmentDays,
    });

    return res.json({
      success: true,
      message: 'Calendar preferences updated',
      data: preferences,
    });
  }
);
