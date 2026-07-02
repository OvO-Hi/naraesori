"use client";

// app/dashboard/profile/page.tsx
// 프로필 수정하기 — 개인정보 폼 + 수강 과목. shadcn Input/Select. 저장은 mock(sonner 토스트).

import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COURSES, PROFILE, courseById } from "@/lib/mock-dashboard";
import { VoiceEnroll } from "@/components/naraesori/VoiceEnroll";

const DEPARTMENTS = ["전자공학과", "컴퓨터공학과", "기계공학과", "전기공학과", "산업공학과"];

export default function ProfilePage() {
  const [name, setName] = useState(PROFILE.name);
  const [studentId, setStudentId] = useState(PROFILE.studentId);
  const [department, setDepartment] = useState(PROFILE.department);
  const [email, setEmail] = useState(PROFILE.email);

  function save(e: React.FormEvent) {
    e.preventDefault();
    // ⚠️ mock — 실제 저장 없음.
    toast.success("저장되었습니다.");
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">프로필 수정하기</p>
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-foreground sm:text-3xl">프로필 수정하기</h1>
        <p className="mt-1 text-sm text-muted-foreground">개인정보와 수강 과목을 관리하세요.</p>
      </div>

      <form onSubmit={save} className="space-y-6">
        {/* 개인정보 */}
        <section className="card-elev-1 rounded-3xl border border-border bg-card p-6">
          <h2 className="text-lg font-bold text-foreground">개인정보</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-foreground">이름</span>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="이름" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-foreground">학번</span>
              <Input value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="학번" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-foreground">학과</span>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger>
                  <SelectValue placeholder="학과 선택" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-foreground">이메일</span>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="이메일" />
            </label>
          </div>
        </section>

        {/* 수업 정보 */}
        <section className="card-elev-1 rounded-3xl border border-border bg-card p-6">
          <h2 className="text-lg font-bold text-foreground">수강 과목</h2>
          <p className="mt-1 text-sm text-muted-foreground">이번 학기 수강 중인 과목이에요.</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {PROFILE.enrolledCourseIds.map((id) => {
              const c = courseById(id);
              return (
                <li
                  key={id}
                  className="rounded-full px-3 py-1.5 text-sm font-semibold"
                  style={{ backgroundColor: `${c.color}22`, color: c.color }}
                >
                  {c.name}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            전체 개설 과목 {COURSES.length}개 중 {PROFILE.enrolledCourseIds.length}개 수강 중
          </p>
        </section>

        <div className="flex justify-end">
          <button
            type="submit"
            className="lift rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:opacity-95"
          >
            저장
          </button>
        </div>
      </form>

      {/* 내 목소리 등록(ElevenLabs) — 폼 밖에 둬서 등록/테스트 버튼이 폼 제출과 섞이지 않게 */}
      <VoiceEnroll />
    </div>
  );
}
