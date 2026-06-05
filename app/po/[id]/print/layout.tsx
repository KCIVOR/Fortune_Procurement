import RequireRoles from '@/components/layout/RequireRoles';

export default function PoPrintLayout({ children }: { children: React.ReactNode }) {
  return <RequireRoles>{children}</RequireRoles>;
}
