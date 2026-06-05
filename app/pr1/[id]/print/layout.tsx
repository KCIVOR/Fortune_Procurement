import RequireRoles from '@/components/layout/RequireRoles';

export default function Pr1PrintLayout({ children }: { children: React.ReactNode }) {
  return <RequireRoles>{children}</RequireRoles>;
}
