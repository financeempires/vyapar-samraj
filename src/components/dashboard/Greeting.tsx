interface GreetingProps {
  name?: string
}

export function Greeting({ name = 'Super Admin' }: GreetingProps) {
  return (
    <div className="px-4 pt-4 pb-2">
      <h1 className="text-[22px] font-bold leading-tight" style={{ color: '#0D1B3E' }}>
        Hello,{' '}
        <span style={{ color: '#2351D9' }}>{name}</span>
      </h1>
      <p className="mt-1 text-[13px]" style={{ color: '#7B8BB2' }}>
        Here&apos;s what&apos;s happening with your business today.
      </p>
    </div>
  )
}
