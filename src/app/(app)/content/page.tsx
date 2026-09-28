import { ComingSoon } from '@/components/layout/ComingSoon'

export default function ContentPage() {
  return (
    <ComingSoon
      title="Content"
      phase="Coming in Phase 4 — Content"
      description="Plan and track social media content across platforms."
      bullets={[
        'Content pipeline: Idea → Planned → Filming → Editing → Ready → Posted',
        'Instagram, TikTok, Facebook, WhatsApp and other platforms',
        'Views, likes, comments, shares and saves per post',
        'Posts per week/month, engagement rate, best-performing content',
      ]}
    />
  )
}
