import RequireRoles from '@/components/layout/RequireRoles';

export default function RawMaterialPR2PrintLayout({ children }: { children: React.ReactNode }) {
  return <RequireRoles>{children}</RequireRoles>;
}
