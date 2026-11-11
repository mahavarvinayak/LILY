import SlackLogo from "@/components/landing/brand-logos/slack";

// Official brand marks; their colours are fixed by each brand.
const Gmail = () => (
  <svg viewBox="52 42 88 66" className="size-7" aria-hidden="true">
    <path fill="#4285f4" d="M58 108h14V74L52 59v43c0 3.32 2.69 6 6 6" />
    <path fill="#34a853" d="M120 108h14c3.32 0 6-2.69 6-6V59l-20 15" />
    <path fill="#fbbc04" d="M120 48v26l20-15v-8c0-7.42-8.47-11.65-14.4-7.2" />
    <path fill="#ea4335" d="M72 74V48l24 18 24-18v26L96 92" />
    <path fill="#c5221f" d="M52 51v8l20 15V48l-5.6-4.2c-5.94-4.45-14.4-.22-14.4 7.2" />
  </svg>
);
const Outlook = () => (
  <svg viewBox="0 0 32 32" className="size-7" aria-hidden="true">
    <rect x="10" y="5" width="20" height="22" rx="2" fill="#0364b8" />
    <path d="M10 13h20v12a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2z" fill="#28a8ea" />
    <path d="M10 13l10 7 10-7v12a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2z" fill="#14447d" opacity=".35" />
    <rect x="2" y="9" width="15" height="15" rx="2" fill="#0078d4" />
    <ellipse cx="9.5" cy="16.5" rx="3.6" ry="4.3" fill="none" stroke="#fff" strokeWidth="2" />
  </svg>
);
const GoogleCalendar = () => (
  <svg viewBox="0 0 48 48" className="size-7" aria-hidden="true">
    <path fill="#fff" d="M37 11H11v26h26z" />
    <path fill="#ea4335" d="M37 48l11-11-5.5-1-5.5 1-1 5z" />
    <path fill="#188038" d="M0 37v7.3A3.7 3.7 0 0 0 3.7 48H11l1-5.5-1-5.5-5.5-1z" />
    <path fill="#1967d2" d="M48 11V3.7A3.7 3.7 0 0 0 44.3 0H37q-1 5.5 0 11 5.5 1 11 0" />
    <path fill="#fbbc04" d="M48 11H37v26h11z" />
    <path fill="#34a853" d="M37 37H11v11h26z" />
    <path fill="#4285f4" d="M37 0H3.7A3.7 3.7 0 0 0 0 3.7V37h11V11h26z" />
    <text x="24" y="31" textAnchor="middle" fontSize="15" fontWeight="700" fill="#4285f4" fontFamily="Arial">31</text>
  </svg>
);
const HubSpot = () => (
  <svg viewBox="0 0 24 24" className="size-7" aria-hidden="true">
    <path fill="#ff7a59" d="M18.16 7.58V4.73a2.2 2.2 0 0 0 1.27-1.98v-.07A2.2 2.2 0 0 0 17.24.49h-.07a2.2 2.2 0 0 0-2.19 2.19v.07a2.2 2.2 0 0 0 1.27 1.98v2.85a6.2 6.2 0 0 0-2.96 1.3L5.5 2.76a2.46 2.46 0 1 0-1.15 1.5l7.68 5.98a6.24 6.24 0 0 0 .1 7.03l-2.34 2.34a2 2 0 0 0-.58-.1 2.03 2.03 0 1 0 2.03 2.03 2 2 0 0 0-.1-.58l2.31-2.31a6.24 6.24 0 1 0 4.7-11.07m-.96 9.37a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4" />
  </svg>
);

const Smtp = () => (
  <svg viewBox="0 0 24 24" className="size-7" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
    <rect width="20" height="16" x="2" y="4" rx="2" stroke="#10b981" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" stroke="#10b981" />
  </svg>
);

export const CONNECTOR_LOGOS = {
  gmail: Gmail,
  outlook: Outlook,
  googlecalendar: GoogleCalendar,
  smtp: Smtp,
  hubspot: HubSpot,
  slack: () => <SlackLogo className="size-7" />,
} as const;
