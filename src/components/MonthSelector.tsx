import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
}

export default function MonthSelector({ year, month, onChange }: Props) {
  const label = new Date(year, month).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const prev = () => {
    if (month === 0) onChange(year - 1, 11);
    else onChange(year, month - 1);
  };

  const next = () => {
    if (month === 11) onChange(year + 1, 0);
    else onChange(year, month + 1);
  };

  return (
    <div className="flex items-center gap-2 bg-card border rounded-lg px-3 py-1.5">
      <button onClick={prev} className="p-1 hover:text-primary transition-colors">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="text-sm font-medium capitalize min-w-[140px] text-center">{label}</span>
      <button onClick={next} className="p-1 hover:text-primary transition-colors">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
