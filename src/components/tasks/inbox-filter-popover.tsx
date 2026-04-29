'use client';

import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { PRIORITIES, SOURCES } from '@/lib/constants';
import { TASK_STATUSES } from '@/lib/types';
import { SORT_LABEL, type SortKey } from '@/lib/custom-views';
import { cn } from '@/lib/utils';

const SORT_OPTIONS: SortKey[] = [
  'created_at',
  'priority',
  'deadline',
  'title',
  'requester',
  'source',
];

const SOURCE_LABEL: Record<string, string> = {
  manual: 'WID',
  notion: 'notion',
  slack: 'slack',
};

interface Props {
  sort: SortKey;
  priority: string;        // 'all' | Priority
  source: string;          // 'all' | Source
  statuses: string[];      // multi
  requester: string;       // 'all' | name
  delegate: string;        // 'all' | name
  requesters: string[];    // 선택 가능한 요청자 목록 (실제 task에서 추출)
  delegatees: string[];    // 선택 가능한 위임 대상 목록
  onSortChange: (v: SortKey) => void;
  onPriorityChange: (v: string) => void;
  onSourceChange: (v: string) => void;
  onStatusesChange: (v: string[]) => void;
  onRequesterChange: (v: string) => void;
  onDelegateChange: (v: string) => void;
}

export function InboxFilterPopover({
  sort,
  priority,
  source,
  statuses,
  requester,
  delegate,
  requesters,
  delegatees,
  onSortChange,
  onPriorityChange,
  onSourceChange,
  onStatusesChange,
  onRequesterChange,
  onDelegateChange,
}: Props) {
  const [open, setOpen] = useState(false);

  const activeCount =
    (priority !== 'all' ? 1 : 0) +
    (source !== 'all' ? 1 : 0) +
    (requester !== 'all' ? 1 : 0) +
    (delegate !== 'all' ? 1 : 0) +
    statuses.length;

  const reset = () => {
    onPriorityChange('all');
    onSourceChange('all');
    onStatusesChange([]);
    onRequesterChange('all');
    onDelegateChange('all');
  };

  const toggleStatus = (s: string) => {
    onStatusesChange(
      statuses.includes(s) ? statuses.filter(x => x !== s) : [...statuses, s],
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            size="sm"
            variant="outline"
            className={cn(
              'h-8 gap-1.5',
              activeCount > 0 && 'border-foreground/30 text-foreground',
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>필터{activeCount > 0 ? ` (${activeCount})` : ''}</span>
            <ChevronDown className="h-3 w-3 opacity-60" />
          </Button>
        }
      />
      <PopoverContent align="end" className="w-72 p-3">
        <div className="space-y-3">
          <Section label="정렬">
            <ChipRow>
              {SORT_OPTIONS.map(k => (
                <Chip
                  key={k}
                  active={sort === k}
                  onClick={() => onSortChange(k)}
                  ariaPressed
                >
                  {SORT_LABEL[k]}
                </Chip>
              ))}
            </ChipRow>
          </Section>

          <Separator />

          <Section label="우선순위">
            <ChipRow>
              <Chip active={priority === 'all'} onClick={() => onPriorityChange('all')} ariaPressed>
                전체
              </Chip>
              {PRIORITIES.map(p => (
                <Chip
                  key={p}
                  active={priority === p}
                  onClick={() => onPriorityChange(p)}
                  ariaPressed
                >
                  {p}
                </Chip>
              ))}
            </ChipRow>
          </Section>

          <Separator />

          <Section label="출처">
            <ChipRow>
              <Chip active={source === 'all'} onClick={() => onSourceChange('all')} ariaPressed>
                전체
              </Chip>
              {SOURCES.map(s => (
                <Chip
                  key={s}
                  active={source === s}
                  onClick={() => onSourceChange(s)}
                  ariaPressed
                >
                  {SOURCE_LABEL[s] ?? s}
                </Chip>
              ))}
            </ChipRow>
          </Section>

          <Separator />

          <Section label="상태 (다중)">
            <ChipRow>
              {TASK_STATUSES.map(s => (
                <Chip
                  key={s}
                  active={statuses.includes(s)}
                  onClick={() => toggleStatus(s)}
                >
                  {s}
                </Chip>
              ))}
            </ChipRow>
          </Section>

          <Separator />
          <Section label="요청자">
            {requesters.length === 0 ? (
              <p className="text-[11px] text-muted-foreground/80">
                요청자가 입력된 task가 아직 없어요. task 상세에서 채우면 여기 떠요.
              </p>
            ) : (
              <ChipRow>
                <Chip active={requester === 'all'} onClick={() => onRequesterChange('all')} ariaPressed>
                  전체
                </Chip>
                {requesters.map(name => (
                  <Chip
                    key={name}
                    active={requester === name}
                    onClick={() => onRequesterChange(name)}
                    ariaPressed
                  >
                    {name}
                  </Chip>
                ))}
              </ChipRow>
            )}
          </Section>

          <Separator />
          <Section label="위임 대상">
            {delegatees.length === 0 ? (
              <p className="text-[11px] text-muted-foreground/80">
                위임 대상이 입력된 task가 아직 없어요.
              </p>
            ) : (
              <ChipRow>
                <Chip active={delegate === 'all'} onClick={() => onDelegateChange('all')} ariaPressed>
                  전체
                </Chip>
                {delegatees.map(name => (
                  <Chip
                    key={name}
                    active={delegate === name}
                    onClick={() => onDelegateChange(name)}
                    ariaPressed
                  >
                    {name}
                  </Chip>
                ))}
              </ChipRow>
            )}
          </Section>

          {activeCount > 0 && (
            <>
              <Separator />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={reset}
                  className="text-[11px] text-muted-foreground hover:text-foreground underline"
                >
                  초기화
                </button>
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">
        {label}
      </div>
      {children}
    </div>
  );
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-1.5">{children}</div>;
}

function Chip({
  active,
  onClick,
  children,
  ariaPressed,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  ariaPressed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ariaPressed ? active : undefined}
      className={cn(
        'h-7 px-2.5 rounded-full border text-[12px] transition-colors',
        active
          ? 'bg-foreground/10 border-foreground/30 text-foreground'
          : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
