import * as Sentry from '@sentry/react';
import { Integrations } from '@sentry/tracing';
import { datadogRum } from '@datadog/browser-rum';

export const initializeMonitoring = () => {
  // Sentry Configuration
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      integrations: [new Integrations.BrowserTracing()],
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
      environment: process.env.NODE_ENV,
      beforeSend(event) {
        // Remove sensitive data
        if (event.request?.headers) {
          delete event.request.headers['authorization'];
        }
        return event;
      },
    });
  }

  // Datadog RUM Configuration
  if (process.env.DATADOG_API_KEY) {
    datadogRum.init({
      applicationId: process.env.DATADOG_APPLICATION_ID || '',
      clientToken: process.env.DATADOG_CLIENT_TOKEN || '',
      site: 'datadoghq.com',
      service: 'flashtrade-logic',
      env: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
      sampleRate: 100,
      trackInteractions: true,
      defaultPrivacyLevel: 'mask-user-input'
    });
  }
};

export const monitorTransaction = async (txHash: string, description: string) => {
  try {
    Sentry.addBreadcrumb({
      category: 'transaction',
      message: `Monitoring transaction: ${description}`,
      level: 'info',
      data: { txHash }
    });

    // Add transaction to Datadog RUM
    datadogRum.addAction('transaction_initiated', {
      txHash,
      description
    });

    return true;
  } catch (error) {
    console.error('Error monitoring transaction:', error);
    Sentry.captureException(error);
    return false;
  }
};

export const trackMetric = (
  name: string,
  value: number,
  tags: Record<string, string> = {}
) => {
  try {
    // Send metric to Datadog RUM
    datadogRum.addTiming(name, value);
    
    // Add context to Sentry
    Sentry.setContext('metrics', {
      [name]: value,
      ...tags
    });
  } catch (error) {
    console.error('Error tracking metric:', error);
    Sentry.captureException(error);
  }
};
