"use client";

// app/dashboard/layout.tsx
// 대시보드 공용 셸 — 접히는 사이드바 + 기존 Header(접근성) + 데모 인증 게이트.
// (하위 대시보드 라우트가 이 셸을 공유한다. 실제 데이터/서브화면은 C-2에서.)

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  History,
  Users,
  MessageSquare,
  Settings,
  LifeBuoy,
  ChevronDown,
  LogOut,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession, signOut } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Header } from "@/components/naraesori/Header";
import { Logo } from "@/components/naraesori/Logo";
import { DashboardIntro } from "@/components/naraesori/DashboardIntro";
import { Toaster } from "@/components/ui/sonner";
import { PROFILE } from "@/lib/mock-dashboard";

// 사이드바 메뉴. "프로필 수정"은 헤더 사용자 메뉴로 이동해 여기선 제외.
const NAV = [
  { title: "보드", href: "/dashboard", icon: LayoutDashboard },
  { title: "지난 강의 보기", href: "/dashboard/lectures", icon: History },
  { title: "나래벗 프로필 보기", href: "/dashboard/buddy", icon: Users },
  { title: "질문 내역 보기", href: "/dashboard/questions", icon: MessageSquare },
  { title: "장애학생센터 문의하기", href: "/dashboard/support", icon: LifeBuoy },
];

function AppSidebar() {
  const pathname = usePathname();
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-4">
        {/* 펼침: 로고(좌) + 접기 버튼(우). 접힘(icon): 로고 숨기고 그 자리에 펴기 버튼만 */}
        <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:justify-center">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 group-data-[collapsible=icon]:hidden"
            aria-label="나래소리 대시보드 홈"
          >
            <Logo variant="symbol" tone="white" size={26} />
            <span className="text-base font-semibold text-sidebar-foreground">나래소리</span>
          </Link>
          <SidebarTrigger
            aria-label="사이드바 접기/펴기"
            className="size-8 shrink-0 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          />
        </div>
      </SidebarHeader>
      <SidebarContent className="px-1">
        <SidebarGroup>
          <SidebarGroupLabel>메뉴</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              {NAV.map((item) => {
                const active =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.title}
                      // 여유있는 높이 + active: 밝은 오버레이(기본) + Tuscan Sun 얇은 왼쪽 바 + 아이콘 강조
                      className="relative h-10 rounded-xl px-3 data-[active=true]:before:absolute data-[active=true]:before:left-0 data-[active=true]:before:top-1/2 data-[active=true]:before:h-4 data-[active=true]:before:w-[3px] data-[active=true]:before:-translate-y-1/2 data-[active=true]:before:rounded-full data-[active=true]:before:bg-accent data-[active=true]:[&_svg]:text-accent"
                    >
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { status } = useSession(); // NextAuth 세션
  const [demoAuth, setDemoAuth] = useState<boolean | null>(null); // 데모 우회 플래그(null=확인 전)
  const [fontScale, setFontScale] = useState(1);
  const [highContrast, setHighContrast] = useState(false);

  // 데모 우회 플래그 확인(클라이언트 전용)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDemoAuth(typeof window !== "undefined" && localStorage.getItem("naraesori_demo_auth") === "true");
  }, []);

  const checking = status === "loading" || demoAuth === null;
  const authed = status === "authenticated" || demoAuth === true;

  // 세션도 없고 데모 우회도 없으면 /login 으로.
  useEffect(() => {
    if (!checking && !authed) router.replace("/login");
  }, [checking, authed, router]);

  // 접근성: 글자 크기 / 고대비 (기존 Header 기능과 동일 패턴)
  useEffect(() => {
    document.documentElement.style.setProperty("--font-scale", String(fontScale));
  }, [fontScale]);
  useEffect(() => {
    document.documentElement.classList.toggle("hc", highContrast);
  }, [highContrast]);
  useEffect(
    () => () => {
      document.documentElement.style.removeProperty("--font-scale");
      document.documentElement.classList.remove("hc");
    },
    [],
  );

  // 로딩 중: 깜빡임 방지용 최소 로더.
  if (checking) {
    return (
      <div className="grid min-h-dvh place-items-center text-sm text-muted-foreground">불러오는 중…</div>
    );
  }
  if (!authed) return null; // /login 으로 리다이렉트 중

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="watercolor-bg">
        <Header
          onHome={() => router.push("/dashboard")}
          fontScale={fontScale}
          setFontScale={setFontScale}
          highContrast={highContrast}
          setHighContrast={setHighContrast}
          showHistory={false}
          rightExtra={<UserMenu />}
        />
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">{children}</main>
      </SidebarInset>
      <DashboardIntro />
      <Toaster />
    </SidebarProvider>
  );
}

// 헤더 우측 사용자 메뉴 — 세션이 있으면 구글 계정 정보, 데모 우회면 mock 정보.
function UserMenu() {
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user;
  const displayName = user?.name ?? PROFILE.name;
  const email = user?.email ?? undefined;
  const image = user?.image ?? undefined;

  function logout() {
    if (session) {
      // 실제 로그인 상태 → NextAuth 로그아웃
      signOut({ callbackUrl: "/login" });
      return;
    }
    // 데모 우회 상태 → 플래그 제거 후 이동
    try {
      localStorage.removeItem("naraesori_demo_auth");
    } catch {
      /* 무시 */
    }
    router.push("/login");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="lift flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-2.5 text-sm font-semibold text-foreground hover:bg-secondary"
          aria-label="사용자 메뉴"
        >
          <Avatar className="h-7 w-7">
            <AvatarImage src={image} alt={displayName} />
            <AvatarFallback className="bg-primary text-xs font-bold text-primary-foreground">
              {displayName.slice(0, 1)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-[9rem] truncate sm:inline">{displayName}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span className="truncate font-semibold">{displayName}</span>
          {email && <span className="truncate text-xs font-normal text-muted-foreground">{email}</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard/profile">
            <Settings className="mr-2 h-4 w-4" />
            프로필 수정
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/buddy">
            <Users className="mr-2 h-4 w-4" />
            나래벗 프로필 보기
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          로그아웃
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
