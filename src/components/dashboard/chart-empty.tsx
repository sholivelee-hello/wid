import { BarChart3 } from 'lucide-react';

export function ChartEmpty({ message = '데이터가 없습니다' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
      <BarChart3 className="h-8 w-8 mb-2 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
