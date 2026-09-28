import { AppShell } from '@/components/layout/AppShell'
import { getCurrentBusinessContext } from '@/lib/services/current-business'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { business } = await getCurrentBusinessContext()

  return <AppShell businessName={business.name}>{children}</AppShell>
}
