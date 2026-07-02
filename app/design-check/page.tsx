"use client";

// app/design-check/page.tsx
// 임시 검증 페이지 — shadcn 이식 + 팀 컬러 팔레트가 제대로 먹었는지 눈으로 확인용.
// (다음 단계에서 실제 화면 이식하면 이 파일은 지워도 됨)

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const SWATCHES: { name: string; token: string; className: string; fg: string }[] = [
  { name: "primary (Dark Spruce)", token: "#214B14", className: "bg-primary", fg: "text-primary-foreground" },
  { name: "secondary (Muted Olive)", token: "#8FAA80", className: "bg-secondary", fg: "text-secondary-foreground" },
  { name: "accent (Tuscan Sun)", token: "#EAC747", className: "bg-accent", fg: "text-accent-foreground" },
  { name: "background (Parchment)", token: "#F4F2EC", className: "bg-background border border-border", fg: "text-foreground" },
  { name: "fern", token: "#506D43", className: "bg-fern", fg: "text-white" },
  { name: "mocha (text)", token: "#403330", className: "bg-mocha", fg: "text-white" },
  { name: "muted", token: "var(--muted)", className: "bg-muted", fg: "text-muted-foreground" },
  { name: "destructive", token: "#C0392B", className: "bg-destructive", fg: "text-destructive-foreground" },
];

export default function DesignCheck() {
  const [hc, setHc] = useState(false);

  return (
    <div className={hc ? "hc" : ""}>
      <main className="mx-auto max-w-4xl space-y-10 p-8">
        <header className="flex items-center justify-between">
          <div>
            <p className="eyebrow">Design check</p>
            <h1 className="text-2xl font-bold">나래소리 디자인 토큰 · shadcn 이식 확인</h1>
            <p className="text-sm text-muted-foreground">
              팀 팔레트(스프루스/펀/올리브/파치먼트/선/모카) + shadcn 컴포넌트 렌더 테스트
            </p>
          </div>
          <Button variant={hc ? "default" : "outline"} onClick={() => setHc((v) => !v)}>
            고대비 {hc ? "끄기" : "켜기"}
          </Button>
        </header>

        {/* 컬러 스와치 */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Color palette</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {SWATCHES.map((s) => (
              <div key={s.name} className="overflow-hidden rounded-lg card-elev-1">
                <div className={`flex h-20 items-end p-2 ${s.className} ${s.fg}`}>
                  <span className="text-xs font-medium">{s.token}</span>
                </div>
                <div className="bg-card p-2 text-xs text-card-foreground">{s.name}</div>
              </div>
            ))}
          </div>
        </section>

        {/* 버튼 variant */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Buttons</h2>
          <div className="flex flex-wrap items-center gap-3">
            <Button>Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
            <Button disabled>Disabled</Button>
          </div>
        </section>

        {/* Badge */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Badges</h2>
          <div className="flex flex-wrap items-center gap-3">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Badge variant="outline">Outline</Badge>
            <span className="chip-honey rounded-full px-2 py-0.5 text-xs">chip-honey</span>
            <span className="chip-leaf rounded-full px-2 py-0.5 text-xs">chip-leaf</span>
          </div>
        </section>

        {/* 교정 하이라이트 데모 (accent 노랑) */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">교정 하이라이트 (accent)</h2>
          <p className="text-base">
            오늘은 <span className="correct-word font-semibold">다형성</span>에 대해 배웁니다.
            <span className="ml-2 text-sm text-muted-foreground">← Tuscan Sun 스윕 강조</span>
          </p>
        </section>

        {/* Card + Select + Dialog */}
        <section className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Card 예시</CardTitle>
              <CardDescription>강의 카드 등에 쓰일 기본 카드</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">강의를 선택하세요.</p>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="강의 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ss-w3">신호 및 시스템 — 3주차</SelectItem>
                  <SelectItem value="oop-w5">객체지향 — 5주차</SelectItem>
                  <SelectItem value="algo-w2">알고리즘 — 2주차</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
            <CardFooter className="gap-2">
              <Button className="flex-1">강의 시작</Button>
              <Badge variant="secondary">실시간</Badge>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dialog 트리거</CardTitle>
              <CardDescription>모달/알림용 다이얼로그</CardDescription>
            </CardHeader>
            <CardContent>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">다이얼로그 열기</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>강의를 종료할까요?</DialogTitle>
                    <DialogDescription>
                      종료하면 자막이 요약 화면으로 넘어갑니다.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="ghost">취소</Button>
                    <Button>종료</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
