import { cn } from '@/lib/utils'

type Grade = 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'High Risk'

function getGrade(score: number): Grade {
  if (score <= 15) return 'AAA'
  if (score <= 25) return 'AA'
  if (score <= 40) return 'A'
  if (score <= 55) return 'BBB'
  if (score <= 70) return 'BB'
  return 'High Risk'
}

function getTone(grade: Grade): { bg: string; text: string; ring: string } {
  switch (grade) {
    case 'AAA':
      return { bg: 'bg-[#0b1a12]', text: 'text-[#8BEA7A]', ring: 'ring-[#2a6b45]/50' }
    case 'AA':
      return { bg: 'bg-[#0b181a]', text: 'text-[#7de3ff]', ring: 'ring-[#25667a]/50' }
    case 'A':
      return { bg: 'bg-[#0f141e]', text: 'text-[#a7b8ff]', ring: 'ring-[#3847a8]/45' }
    case 'BBB':
      return { bg: 'bg-[#17140b]', text: 'text-[#f6d27a]', ring: 'ring-[#a26d14]/45' }
    case 'BB':
      return { bg: 'bg-[#1a120b]', text: 'text-[#ffb072]', ring: 'ring-[#a04b1a]/45' }
    default:
      return { bg: 'bg-[#1a0b0b]', text: 'text-[#ff8080]', ring: 'ring-[#9b2525]/45' }
  }
}

export function RiskScoreBadge(props: { score: number; className?: string }) {
  const grade = getGrade(props.score)
  const tone = getTone(grade)

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ring-1',
        tone.bg,
        tone.text,
        tone.ring,
        props.className,
      )}
    >
      <span>{grade}</span>
      <span className="text-[11px] font-medium opacity-80">{Math.round(props.score)}/100</span>
    </span>
  )
}

