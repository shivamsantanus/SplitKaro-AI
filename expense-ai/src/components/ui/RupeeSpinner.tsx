export function RupeeSpinner({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <span
      className={`relative inline-flex items-center justify-center ${className}`}
      aria-label="Loading"
      role="status"
    >
      <svg
        className="animate-spin absolute inset-0 w-full h-full"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        {/* Faint full ring */}
        <circle
          cx="12"
          cy="12"
          r="9"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeOpacity="0.25"
        />
        {/* Bright quarter-arc that spins */}
        <path
          d="M12 3a9 9 0 0 1 9 9"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      {/* Static ₹ in the centre */}
      <span className="relative text-[0.52em] font-black leading-none select-none">
        ₹
      </span>
    </span>
  )
}
