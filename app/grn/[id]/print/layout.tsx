import RequireRoles from '@/components/layout/RequireRoles';

export default function GrnPrintLayout({ children }: { children: React.ReactNode }) {
  return <RequireRoles>{children}</RequireRoles>;
}
