export default function BrandLogo({ size = 36, showText = false, subtitle = 'Management System' }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0, filter: 'drop-shadow(0 4px 12px rgba(99, 102, 241, 0.35))' }}
      >
        <defs>
          <linearGradient id="bpms-logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="60%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
          <linearGradient id="bpms-node-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#818cf8" />
          </linearGradient>
        </defs>
        
        {/* Rounded square container */}
        <rect width="40" height="40" rx="11" fill="url(#bpms-logo-grad)" />
        
        {/* Subtle geometric grid background accent */}
        <path d="M0 20H40M20 0V40" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="1" />
        
        {/* Monogram P & B intersection */}
        <path
          d="M13 11H23.5C26.5376 11 29 13.4624 29 16.5C29 19.5376 26.5376 22 23.5 22H17.5V29H13V11Z"
          fill="#ffffff"
        />
        {/* Inner cutout */}
        <path
          d="M17.5 15V18H23C23.8284 18 24.5 17.3284 24.5 16.5C24.5 15.6716 23.8284 15 23 15H17.5Z"
          fill="#6366f1"
        />
        
        {/* Connected dynamic project node */}
        <circle cx="26.5" cy="27.5" r="4" fill="url(#bpms-node-grad)" stroke="#ffffff" strokeWidth="1.75" />
      </svg>

      {showText && (
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
          <span style={{
            fontSize: '1.15rem',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            fontFamily: 'var(--font-heading, sans-serif)',
            background: 'linear-gradient(135deg, #ffffff 40%, #cbd5e1 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            BPMS
          </span>
          <span style={{
            fontSize: '0.65rem',
            color: 'var(--text-muted, #94a3b8)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontWeight: 600,
          }}>
            {subtitle}
          </span>
        </div>
      )}
    </div>
  );
}
