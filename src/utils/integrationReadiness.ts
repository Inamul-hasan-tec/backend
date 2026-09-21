type IntegrationStatus = 'configured' | 'disabled' | 'missing' | 'incomplete';

export interface IntegrationReadiness {
  status: IntegrationStatus;
  message: string;
  missing: string[];
}

function present(name: string): boolean {
  const value = String(process.env[name] || '').trim();
  return Boolean(value) && !/replace-|your-|example|localhost|disabled/i.test(value);
}

export function smtpReadiness(): IntegrationReadiness {
  if (process.env.SMTP_ENABLED !== 'true') {
    return {
      status: 'disabled',
      message: 'SMTP is disabled. Email actions will be skipped and manual links should be shown.',
      missing: [],
    };
  }

  const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'];
  const missing = required.filter((name) => !present(name));

  return missing.length === 0
    ? { status: 'configured', message: 'SMTP is configured.', missing: [] }
    : {
        status: 'incomplete',
        message: 'SMTP is enabled but incomplete. Email actions will be skipped safely.',
        missing,
      };
}

export function cloudinaryReadiness(): IntegrationReadiness {
  const required = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
  const missing = required.filter((name) => !present(name));

  return missing.length === 0
    ? { status: 'configured', message: 'Cloudinary storage is configured.', missing: [] }
    : {
        status: 'missing',
        message:
          'Cloudinary storage is not configured. Public images may use local fallback; sensitive proofs are blocked.',
        missing,
      };
}

export function errorMonitoringReadiness(): IntegrationReadiness {
  return present('ERROR_MONITORING_DSN')
    ? { status: 'configured', message: 'Error monitoring DSN is configured.', missing: [] }
    : {
        status: 'missing',
        message: 'Error monitoring DSN is missing. Server logs remain the fallback.',
        missing: ['ERROR_MONITORING_DSN'],
      };
}

export function uptimeReadiness(): IntegrationReadiness {
  const required = ['UPTIME_MONITOR_HEALTH_URL', 'UPTIME_MONITOR_FRONTEND_URL', 'OPS_ALERT_RECIPIENT'];
  const missing = required.filter((name) => !present(name));

  return missing.length === 0
    ? { status: 'configured', message: 'Uptime monitoring values are configured.', missing: [] }
    : {
        status: 'missing',
        message: 'Uptime monitoring values are incomplete.',
        missing,
      };
}

export function productionIntegrationsReadiness() {
  return {
    smtp: smtpReadiness(),
    cloudinary: cloudinaryReadiness(),
    error_monitoring: errorMonitoringReadiness(),
    uptime_monitoring: uptimeReadiness(),
  };
}
