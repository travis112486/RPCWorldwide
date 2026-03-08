import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",

  tracesSampleRate: 0.5,

  beforeSend(event) {
    if (event.user) {
      event.user = { id: event.user.id };
    }
    return event;
  },
});
