type ScoreRingProps = {
  score: number
  size?: 'sm' | 'lg'
}

const sizeClasses = {
  sm: 'h-12 w-12 text-sm',
  lg: 'h-28 w-28 text-3xl',
}

export function ScoreRing({ score, size = 'sm' }: ScoreRingProps) {
  const degrees = Math.max(16, Math.round((score / 100) * 360))
  const gradient =
    score >= 80
      ? 'linear-gradient(135deg, rgba(52,211,153,1) 0%, rgba(103,232,249,1) 100%)'
      : score >= 60
        ? 'linear-gradient(135deg, rgba(252,211,77,1) 0%, rgba(251,146,60,1) 100%)'
        : 'linear-gradient(135deg, rgba(251,113,133,1) 0%, rgba(217,70,239,1) 100%)'

  return (
    <div
      className={`relative grid place-items-center rounded-full ${sizeClasses[size]}`}
      style={{
        background: `conic-gradient(from 0deg, rgba(125,211,252,0.95) 0deg ${degrees}deg, rgba(15,23,42,0.5) ${degrees}deg 360deg)`,
      }}
    >
      <div
        className="absolute inset-0 rounded-full opacity-90"
        style={{ background: gradient }}
      />
      <div className="absolute inset-[3px] rounded-full bg-slate-950" />
      <span className="relative z-10 font-semibold text-white">{score}</span>
    </div>
  )
}
