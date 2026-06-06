'use client';

import * as React from 'react';
import { ChevronLeft } from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';

/**
 * 모바일 바텀 액션 시트 — task-card의 우클릭/⋯ 메뉴를 폰에서 대체한다.
 *
 * task-card는 액션 항목을 `renderActionItems(M: MenuKit)` 한 곳에만 정의하고,
 * 데스크톱은 CTX_KIT(우클릭)·DD_KIT(드롭다운)을 주입한다. 이 파일은 같은
 * MenuKit 인터페이스에 구조적으로 호환되는 SHEET_KIT을 제공해, 폰에서 동일한
 * 항목 정의를 풀폭 52px 행으로 렌더한다 — 항목 정의 중복 없음.
 *
 * 서브메뉴(상태 변경 · ISSUE에 연결)는 PC처럼 옆으로 펼치지 않고, 시트 내부
 * 내비게이션으로 처리한다: SubTrigger 행을 탭하면 시트 내용이 SubContent
 * 목록으로 교체되고 상단에 ‹ 뒤로 헤더가 뜬다. 뒤로 탭 → 메인 목록 복귀.
 */

// 시트 닫기 + 서브뷰 내비게이션을 행 컴포넌트들이 공유하기 위한 컨텍스트.
interface SheetCtx {
  /** 액션 실행 후 시트를 닫는다. */
  closeSheet: () => void;
  /** SubTrigger 탭 시 호출 — 해당 SubContent를 서브뷰로 띄운다. */
  pushView: (label: React.ReactNode, content: React.ReactNode) => void;
}
const SheetContext = React.createContext<SheetCtx | null>(null);

// Sub 묶음 안에서 SubTrigger가 형제 SubContent를 찾기 위한 내부 컨텍스트.
// SubContent는 자기 children을 register로 올려두고, SubTrigger가 그걸 pushView한다.
interface SubCtx {
  setContent: (node: React.ReactNode) => void;
  getContent: () => React.ReactNode;
}
const SubContext = React.createContext<SubCtx | null>(null);

interface ItemProps {
  disabled?: boolean;
  variant?: 'destructive';
  onClick?: () => void;
  children: React.ReactNode;
}

/** 풀폭 52px 행 — 아이콘+라벨. 탭 시 onClick 실행 후 시트 닫힘. */
function Item({ disabled, variant, onClick, children }: ItemProps) {
  const ctx = React.useContext(SheetContext);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        onClick?.();
        // 액션 실행 직후 시트를 닫는다(서브뷰에 있었어도 닫힘).
        ctx?.closeSheet();
      }}
      className={cn(
        // 풀폭 행: 좌측 아이콘(lucide 기본 16px) + 라벨. 터치 타깃 52px.
        'flex w-full items-center gap-3 px-5 min-h-[52px] text-left text-[15px]',
        'transition-colors active:bg-accent/60 disabled:opacity-40 disabled:pointer-events-none',
        // 아이콘 크기·색 — 라벨과 정렬. 메뉴 항목 lucide 아이콘은 18px로 키운다.
        '[&_svg]:size-[18px] [&_svg]:shrink-0',
        variant === 'destructive'
          ? 'text-destructive [&_svg]:text-destructive'
          : 'text-foreground',
      )}
    >
      {children}
    </button>
  );
}

/** hairline 구분선. */
function Separator() {
  return <div className="my-1 h-px bg-border" />;
}

/** 서브메뉴 묶음 — SubTrigger·SubContent를 묶어 형제끼리 내용을 공유한다. */
function Sub({ children }: { children: React.ReactNode }) {
  const contentRef = React.useRef<React.ReactNode>(null);
  const value = React.useMemo<SubCtx>(
    () => ({
      setContent: (node) => {
        contentRef.current = node;
      },
      getContent: () => contentRef.current,
    }),
    [],
  );
  return <SubContext.Provider value={value}>{children}</SubContext.Provider>;
}

/** 서브뷰로 들어가는 행 — 탭 시 형제 SubContent를 시트에 띄운다. */
function SubTrigger({ children }: { children: React.ReactNode }) {
  const sheet = React.useContext(SheetContext);
  const sub = React.useContext(SubContext);
  return (
    <button
      type="button"
      onClick={() => {
        if (sheet && sub) sheet.pushView(children, sub.getContent());
      }}
      className={cn(
        'flex w-full items-center gap-3 px-5 min-h-[52px] text-left text-[15px] text-foreground',
        'transition-colors active:bg-accent/60',
        '[&_svg]:size-[18px] [&_svg]:shrink-0',
      )}
    >
      {children}
      <span className="ml-auto text-muted-foreground" aria-hidden>
        ›
      </span>
    </button>
  );
}

/** 서브뷰 내용 — 렌더 시점에 형제 Sub에 자기 children을 등록만 하고 화면엔
 *  아무것도 그리지 않는다(실제 표시는 SubTrigger가 pushView로 처리). */
function SubContent({ children }: { className?: string; children: React.ReactNode }) {
  const sub = React.useContext(SubContext);
  // 렌더 단계에서 등록 — SubTrigger 탭 시점에 최신 내용을 가져갈 수 있게.
  if (sub) sub.setContent(children);
  return null;
}

/** task-card의 MenuKit 인터페이스에 구조적으로 호환되는 시트용 킷. */
export const SHEET_KIT = {
  Item,
  Separator,
  Sub,
  SubTrigger,
  SubContent,
};

interface TaskActionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** renderActionItems(SHEET_KIT) 결과를 그대로 받는다. */
  children: React.ReactNode;
}

export function TaskActionSheet({
  open,
  onOpenChange,
  children,
}: TaskActionSheetProps) {
  // 서브뷰 상태 — null이면 메인 목록, 값이 있으면 그 서브뷰를 보여준다.
  const [subView, setSubView] = React.useState<{
    label: React.ReactNode;
    content: React.ReactNode;
  } | null>(null);

  // 시트가 닫힐 때마다 서브뷰 상태 초기화 — 다음에 열면 항상 메인부터.
  React.useEffect(() => {
    if (!open) setSubView(null);
  }, [open]);

  const ctx = React.useMemo<SheetCtx>(
    () => ({
      closeSheet: () => onOpenChange(false),
      pushView: (label, content) => setSubView({ label, content }),
    }),
    [onOpenChange],
  );

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="pb-[env(safe-area-inset-bottom)]">
        {/* 스크린리더용 제목 — 시각적으로는 숨김(시트 자체가 맥락). */}
        <DrawerTitle className="sr-only">task 액션</DrawerTitle>
        <SheetContext.Provider value={ctx}>
          {subView ? (
            <div>
              {/* ‹ 뒤로 헤더 — 메인 목록으로 복귀. */}
              <button
                type="button"
                onClick={() => setSubView(null)}
                className="flex w-full items-center gap-2 px-4 min-h-[52px] text-left text-[15px] font-medium text-foreground border-b border-border active:bg-accent/60"
              >
                <ChevronLeft className="size-[18px] shrink-0 text-muted-foreground" />
                <span className="inline-flex items-center gap-2 [&_svg]:size-[18px]">
                  {subView.label}
                </span>
              </button>
              <div className="py-1">{subView.content}</div>
            </div>
          ) : (
            <div className="py-1">{children}</div>
          )}

          {/* 맨 아래 닫기 행 — 항상 메인/서브뷰 공통. */}
          <div className="border-t border-border">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex w-full items-center justify-center px-5 min-h-[52px] text-[15px] font-medium text-muted-foreground active:bg-accent/60"
            >
              닫기
            </button>
          </div>
        </SheetContext.Provider>
      </DrawerContent>
    </Drawer>
  );
}
