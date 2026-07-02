"use client";

// components/naraesori/PdfViewer.tsx
// 강의자료 PDF 뷰어(react-pdf / pdf.js). 현재 페이지만 렌더 + 이전/다음 네비.
// ⚠️ next/dynamic({ ssr:false })로 로드해야 안전(pdf.js는 브라우저 전용).
//    worker 는 pdfjs.version 과 동일 버전 CDN 을 써서 버전 불일치 에러를 막는다.

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

// pdfjs 와 동일 버전 worker (버전 불일치가 대표적 에러 원인)
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export function PdfViewer({ file }: { file: File | string }) {
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [width, setWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // 카드 폭에 맞춰 페이지 scale (반응형)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // 파일 바뀌면 첫 페이지로
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
    setNumPages(0);
    setError(null);
  }, [file]);

  const canPrev = page > 1;
  const canNext = numPages > 0 && page < numPages;

  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <span className="text-sm font-bold text-foreground">강의자료</span>
        {numPages > 0 && (
          <div className="flex items-center gap-1.5 text-sm">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!canPrev}
              className="lift rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-40"
            >
              이전
            </button>
            <span className="min-w-14 text-center text-xs tabular-nums text-muted-foreground">
              {page} / {numPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(numPages, p + 1))}
              disabled={!canNext}
              className="lift rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-40"
            >
              다음
            </button>
          </div>
        )}
      </div>

      <div ref={containerRef} className="grid min-h-[40dvh] place-items-center overflow-hidden rounded-xl bg-muted/30">
        {error ? (
          <p className="p-8 text-center text-sm text-red-600">PDF를 열 수 없어요: {error}</p>
        ) : (
          <Document
            file={file}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            onLoadError={(e) => setError(e.message)}
            loading={<p className="p-8 text-center text-sm text-muted-foreground">PDF 불러오는 중…</p>}
            error={<p className="p-8 text-center text-sm text-red-600">PDF를 불러오지 못했어요.</p>}
          >
            {width > 0 && (
              <Page
                pageNumber={page}
                width={width}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                loading={<p className="p-8 text-center text-sm text-muted-foreground">페이지 렌더링 중…</p>}
              />
            )}
          </Document>
        )}
      </div>
    </div>
  );
}
