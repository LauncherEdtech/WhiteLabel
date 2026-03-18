import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/lib/constants/config";
type Role = keyof typeof ROLE_LABELS;
const variants: Record<Role,"default"|"secondary"|"success"|"warning"> = {
  student:"default", producer_staff:"secondary", producer_admin:"success", super_admin:"warning"
};
export function RoleBadge({ role }: { role: Role }) {
  return <Badge variant={variants[role]}>{ROLE_LABELS[role]}</Badge>;
}
