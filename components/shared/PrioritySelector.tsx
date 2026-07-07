import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function PrioritySelector({
  value,
  onChange,
  isUpdating,
}: {
  value: string;
  onChange: (priority: 'normal' | 'medium' | 'high') => void;
  isUpdating: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange as (val: string) => void} disabled={isUpdating}>
      <SelectTrigger className="w-32 h-8 text-xs font-medium bg-white border-pq-neutral-200 hover:border-pq-primary-600">
        <SelectValue placeholder="Priority" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="normal">
          <div className="inline-flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-pq-neutral-400" />
            Normal
          </div>
        </SelectItem>
        <SelectItem value="medium">
          <div className="inline-flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
            Medium
          </div>
        </SelectItem>
        <SelectItem value="high">
          <div className="inline-flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            High
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
