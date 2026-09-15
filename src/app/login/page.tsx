import type { Metadata } from 'next'
import Image from 'next/image'
import { LoginForm } from '@/components/auth/login-form'

export const metadata: Metadata = {
  title: 'Login | Vyapar Samraj — Smart Finance. Stronger Business.',
  description:
    'Login to Vyapar Samraj to access your financial dashboard. Manage your business finances smarter.',
}

export default function LoginPage() {
  return (
    <main
      className="relative flex min-h-screen w-full flex-col items-center overflow-x-hidden bg-white"
      aria-label="Login page"
    >
      {/* ─── Main content ──────────────────────────────── */}
      <div className="relative z-10 flex w-full flex-1 flex-col items-center px-6 pb-48 pt-10 sm:px-8 sm:pt-14">

        {/* ── Logo — no background box, no rounded container ── */}
        <div className="mb-5">
          <Image
            src="/vs-logo.png"
            alt="Vyapar Samraj logo"
            width={220}
            height={220}
            priority
            unoptimized
            className="h-auto w-[190px] select-none object-contain sm:w-[210px]"
            style={{ mixBlendMode: 'multiply' }}
          />
        </div>

        {/* ── Brand name ── */}
        <h1
          className="text-center text-[28px] font-bold leading-none tracking-tight sm:text-[30px]"
          style={{ color: '#0D1B3E' }}
        >
          Vyapar Samraj
        </h1>

        {/* ── Blue accent divider ── */}
        <div
          className="mt-[10px] h-[3px] w-10 rounded-full"
          style={{ backgroundColor: '#2351D9' }}
          aria-hidden="true"
        />

        {/* ── Tagline ── */}
        <p
          className="mt-[10px] text-center text-[14px] font-normal leading-snug"
          style={{ color: '#8D9BB8' }}
        >
          Smart Finance. Stronger Business.
        </p>

        {/* ── Login form ── */}
        <div className="mt-9 w-full max-w-[400px]">
          <LoginForm />
        </div>
      </div>

      {/* ─── Bottom wave — fixed to bottom of screen ─────── */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 z-0 w-full"
        aria-hidden="true"
        style={{ lineHeight: 0 }}
      >
        <svg
          viewBox="0 0 414 110"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          style={{ display: 'block', width: '100%', height: '110px' }}
        >
          {/* Back layer — lightest */}
          <path
            d="M0 60 C70 25 150 75 230 50 C310 25 375 68 414 42 L414 110 L0 110 Z"
            fill="#D6E8FF"
            fillOpacity="0.45"
          />
          {/* Mid layer */}
          <path
            d="M0 75 C65 45 140 88 215 65 C290 42 360 78 414 58 L414 110 L0 110 Z"
            fill="#BDD5FF"
            fillOpacity="0.50"
          />
          {/* Front layer — slightly more opaque */}
          <path
            d="M0 90 C55 65 130 100 200 80 C270 60 350 92 414 75 L414 110 L0 110 Z"
            fill="#A8C5FF"
            fillOpacity="0.35"
          />
        </svg>
      </div>
    </main>
  )
}
