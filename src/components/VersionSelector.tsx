import { useVersion } from '@/contexts/VersionContext';
import { VERSION_LABELS, VersionKey } from '@/hooks/useVolumeBPData';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GitCompare } from 'lucide-react';

export default function VersionSelector() {
  const { version, setVersion } = useVersion();
  const options: VersionKey[] = ['bp', 're05', 're09'];

  return (
    <div className="flex items-center gap-2">
      <GitCompare className="h-4 w-4 text-muted-foreground" />
      <span className="text-xs text-muted-foreground hidden sm:inline">Comparar com:</span>
      <Select value={version} onValueChange={(v) => setVersion(v as VersionKey)}>
        <SelectTrigger className="h-8 w-[160px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(opt => (
            <SelectItem key={opt} value={opt} className="text-xs">{VERSION_LABELS[opt]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
