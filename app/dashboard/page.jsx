"use client";

import React, {
  Suspense,
  useMemo,
  useState,
  useEffect,
  useCallback,
  useRef,
  useTransition,
} from "react";
import { useSearchParams, useRouter } from "next/navigation";

export const dynamic = "force-dynamic";

/* =========================================================
 *  0) 고정 설정
 * ========================================================= */
const API_BASE = "https://inventory-api-231876330057.asia-northeast3.run.app";
const MAX_RANGE_DAYS = 7; // ✅ 조회기간 최대 7일

/* =========================================================
 *  1) 날짜/표시 유틸 (KST 고정)
 * ========================================================= */
function ymdToday() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function parseYMD(ymd) {
  const s = String(ymd || "").slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  if (isNaN(dt.getTime())) return null;
  return dt;
}

function diffDaysInclusive(fromYmd, toYmd) {
  const s0 = parseYMD(fromYmd);
  const e0 = parseYMD(toYmd);
  if (!s0 || !e0) return null;

  const s = s0.getTime() <= e0.getTime() ? s0 : e0;
  const e = s0.getTime() <= e0.getTime() ? e0 : s0;

  return Math.floor((e.getTime() - s.getTime()) / 86400000) + 1;
}

function buildDateListInclusive(fromYmd, toYmd) {
  const s0 = parseYMD(fromYmd);
  const e0 = parseYMD(toYmd);
  if (!s0 || !e0) return [];

  const s = s0.getTime() <= e0.getTime() ? s0 : e0;
  const e = s0.getTime() <= e0.getTime() ? e0 : s0;

  const out = [];
  let cur = new Date(s.getFullYear(), s.getMonth(), s.getDate());
  const end = new Date(e.getFullYear(), e.getMonth(), e.getDate());

  while (cur.getTime() <= end.getTime()) {
    const y = cur.getFullYear();
    const mm = String(cur.getMonth() + 1).padStart(2, "0");
    const dd = String(cur.getDate()).padStart(2, "0");
    out.push(`${y}-${mm}-${dd}`);
    cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
  }
  return out;
}

function formatExpiryYMD(v) {
  if (!v) return "";
  const raw = String(v);

  const m = raw.match(/\d{4}-\d{2}-\d{2}/);
  if (m) return m[0];

  const d = new Date(raw);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  }

  return raw.slice(0, 10);
}

/* =========================================================
 *  2) 페이지 엔트리 (Suspense 래퍼)
 * ========================================================= */
export default function DashboardPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40 }}>로딩중...</div>}>
      <DashboardPageInner />
    </Suspense>
  );
}

/* =========================================================
 *  3) 메인 페이지 컴포넌트
 * ========================================================= */
function DashboardPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  /* ---------------------------------------------------------
   *  3-A) URL/로컬스토리지에서 헤더 매장 정보 읽기 (표시용)
   * --------------------------------------------------------- */
  const urlStoreCode = (searchParams.get("store_code") || "").trim();
  const urlStoreName = (searchParams.get("store_name") || "").trim();

  const [headerStoreCode, setHeaderStoreCode] = useState("");
  const [headerStoreName, setHeaderStoreName] = useState("");

  useEffect(() => {
    if (urlStoreCode) setHeaderStoreCode(urlStoreCode);
    if (urlStoreName) setHeaderStoreName(urlStoreName);
  }, [urlStoreCode, urlStoreName]);

  useEffect(() => {
    if (urlStoreCode || urlStoreName) return;
    try {
      const raw = localStorage.getItem("kfc_store_info");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const sc = (parsed?.storeCode || "").trim();
      const sn = (parsed?.storeName || "").trim();
      if (sc) setHeaderStoreCode(sc);
      if (sn) setHeaderStoreName(sn);
    } catch {}
  }, [urlStoreCode, urlStoreName]);

  /* ---------------------------------------------------------
   *  3-B) 화면 필터 상태 (기간 조회)
   * --------------------------------------------------------- */
  const [dateFrom, setDateFrom] = useState(ymdToday());
  const [dateTo, setDateTo] = useState(ymdToday());
  const [region, setRegion] = useState("");
  const [storeCode, setStoreCode] = useState("");
  const [category, setCategory] = useState("");

  /* ---------------------------------------------------------
   *  3-C) 서버 데이터 상태
   * --------------------------------------------------------- */
  const [summary, setSummary] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  /* ---------------------------------------------------------
   *  3-D) 성능 최적화(캐시/취소/transition)
   * --------------------------------------------------------- */
  const cacheRef = useRef(new Map());
  const abortRef = useRef(null);
  const [isPending, startTransition] = useTransition();

  /* ---------------------------------------------------------
   *  3-E) CSS
   *   - 기간 입력 2개를 한 행 + 간격 축소
   *   - 매장명 컬럼 폭 확장(최소 12글자)
   * --------------------------------------------------------- */
  const styles = `
    *{
      font-family:"Pretendard", system-ui, -apple-system, BlinkMacSystemFont;
      font-weight:500;
      box-sizing:border-box;
    }

    .page{min-height:100vh;background:linear-gradient(135deg,#FFF1E2 0%,#F5D4B7 100%);}

    .header{
      background:linear-gradient(90deg,#A3080B 0%,#DC001B 100%);
      padding:14px 20px;
      color:#fff;
      font-weight:700;
    }
    .header, .header *{ font-weight:700; }

    .headerInner{
      display:flex;
      justify-content:space-between;
      align-items:center;
      gap:12px;
    }

    .logo{
      font-size:22px;
      font-weight:900;
      letter-spacing:.4px;
      white-space:nowrap;
      line-height:1.1;
    }

    .headerRight{
      display:flex;
      align-items:center;
      gap:10px;
      white-space:nowrap;
    }

    .todayText{
      font-size:14px;
      font-weight:900;
      opacity:.95;
      white-space:nowrap;
      word-break:keep-all;
      text-align:right;
      line-height:1.2;
    }

    .headerActions{
      display:flex;
      flex-direction:row;
      gap:8px;
      align-items:center;
    }
    .headerBtn{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      height:32px;
      padding:0 12px;
      border-radius:10px;
      border:1px solid rgba(255,255,255,0.35);
      color:#fff;
      font-weight:900;
      font-size:12px;
      cursor:pointer;
      box-shadow:0 2px 10px rgba(0,0,0,.12);
      white-space:nowrap;
      word-break:keep-all;
      min-width:84px;
    }
    .btnGreen{background:rgba(46, 204, 113, 0.95); border-color: rgba(255,255,255,0.25);}
    .btnGreen:hover{filter:brightness(0.95);}
    .btnYellow{background:rgba(241, 196, 15, 0.95); border-color: rgba(255,255,255,0.25); color:#2b2b2b;}
    .btnYellow:hover{filter:brightness(0.96);}
    .headerBtn:disabled{opacity:.55;cursor:not-allowed;}

    .container{max-width:1400px;margin:22px auto;padding:0 16px;}
    .grid{display:grid;grid-template-columns:420px 1fr;gap:18px;align-items:start;}
    .leftCol{display:flex;flex-direction:column;gap:12px;}

    .kpiGrid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
    .kpiCard{
      background:#fff;border-radius:14px;padding:18px;
      box-shadow:0 4px 16px rgba(0,0,0,.08);
      text-align:center;
    }
    .kpiTitle{font-size:12px;font-weight:900;color:#666;}
    .kpiValue{font-size:32px;font-weight:900;color:#C62828;margin-top:6px;line-height:1;}

    .panel{
      background:#fff;border-radius:14px;padding:18px;
      box-shadow:0 4px 20px rgba(0,0,0,.08);
      overflow:auto;
      max-height:calc(100vh - 140px);
    }
    .panelTitle{font-size:16px;font-weight:900;margin-bottom:12px;}

    .filterBox{background:#fff;border-radius:14px;padding:14px;box-shadow:0 4px 16px rgba(0,0,0,.08);}
    .filterTitle{font-weight:900;color:#A3080B;margin-bottom:10px;font-size:12px;}
    .filterRows{display:flex;flex-direction:column;gap:10px;}
    .row{display:grid;grid-template-columns:64px 1fr;gap:10px;align-items:center;}
    .rowLabel{font-size:13px;font-weight:900;color:#444;white-space:nowrap;line-height:1;}

    /* ✅ 기간 2개 한 행 + 간격 축소 + 구분문자 제거 */
    .rangeRow{
      display:grid;
      grid-template-columns:64px 1fr;
      gap:10px;
      align-items:center;
    }
    .rangeControls{
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:6px; /* ✅ 간격 축소 */
      align-items:center;
    }

    .control{
      width:100%;
      height:40px;
      padding:0 12px;
      border:1px solid #E3E3E3;
      border-radius:10px;
      font-weight:900;
      background:#fff;
      outline:none;
      font-size:14px;
      line-height:40px;
      appearance:none;
    }
    .control:focus{border-color:#A3080B;box-shadow:0 0 0 3px rgba(163,8,11,.08);}
    input[type="date"].control{height:40px;line-height:40px;padding:0 12px;}
    select.control{height:40px;line-height:40px;}

    .btnRow{display:flex;gap:10px;margin-top:12px;}
    .btnSecondary{
      height:40px;border-radius:10px;border:1px solid #E3E3E3;
      cursor:pointer;font-weight:900;background:#fff;flex:1;
      font-size:12px;
    }

    table{width:100%;border-collapse:collapse;}
    th,td{
      padding:10px 8px;
      border-bottom:1px solid #eee;
      text-align:left;
      font-size:13px;
      vertical-align:top;
      white-space:nowrap;
    }
    th{
      font-weight:900;color:#444;background:#fafafa;
      position:sticky;top:0;z-index:1;
    }
    .dangerText{color:#C62828;font-weight:900;}
    .muted{color:#777;font-weight:900;}

    /* ✅ 매장명(3번째) 폭 확대: 최소 12글자 */
    table th:nth-child(3),
    table td:nth-child(3){
      min-width:12ch;
      max-width:18ch;
    }

    @media (max-width:980px){
      .grid{grid-template-columns:1fr;}
      .header{padding:12px 16px;}
      .logo{font-size:18px;white-space:nowrap;}
      .container{margin:16px auto;}
      .panel{max-height:none;}
    }

    @media (max-width:560px){
      .header{padding:10px 12px;}
      .headerInner{gap:10px;align-items:flex-start;}

      .logo{
        font-size:14px;
        max-width:52vw;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
        letter-spacing:0;
      }

      .headerRight{
        flex-direction:column;
        align-items:flex-end;
        gap:8px;
        white-space:normal;
      }

      .todayText{
        font-size:10px;
        line-height:1.2;
        text-align:left;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
        max-width:100%;
      }

      .headerActions{
        flex-direction:column;
        gap:6px;
        width:78px;
        align-items:stretch;
      }
      .headerBtn{
        height:26px;
        padding:0 8px;
        font-size:10px;
        border-radius:9px;
        min-width:0;
      }

      .container{padding:0 12px;margin:14px auto;}
      .kpiGrid{grid-template-columns:1fr;gap:10px;}
      .kpiCard{padding:14px;}
      .kpiTitle{font-size:11px;}
      .kpiValue{font-size:26px;}

      .filterBox{padding:12px;}
      .row{grid-template-columns:72px 1fr;}
      .rangeRow{grid-template-columns:72px 1fr;}
      .control{height:34px;line-height:34px;font-size:12px;padding:0 10px;border-radius:9px;}
      input[type="date"].control{height:34px;line-height:34px;}
      select.control{height:34px;line-height:34px;}
      .btnSecondary{height:34px;font-size:11px;border-radius:9px;}

      .hideCategoryOnMobile{display:none !important;}

      .panel{padding:12px;}
      .panelTitle{font-size:13px;margin-bottom:10px;}

      table{table-layout:fixed;}
      th,td{
        font-size:10px;
        padding:6px 6px;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }

      /* 모바일에서 남은일수(7번째) 숨김 */
      table th:nth-child(7),
      table td:nth-child(7){ display:none; }

      /* 모바일: 매장코드(2번째) 숨김 */
      table th:nth-child(2),
      table td:nth-child(2){ display:none; }

      /* 모바일: 카테고리(4번째) 숨김 */
      table th:nth-child(4),
      table td:nth-child(4){ display:none; }

      /* ✅ 모바일 폭 재배분 (입력일/매장명/자재명/유통기한) */
      th:nth-child(1),td:nth-child(1){width:26%;}
      th:nth-child(3),td:nth-child(3){width:34%;}
      th:nth-child(5),td:nth-child(5){width:24%;}
      th:nth-child(6),td:nth-child(6){width:16%;}
    }
  `;

  /* ---------------------------------------------------------
   *  3-F) 데이터 가져오기 (기간 조회: 프론트에서 날짜별 호출 후 합치기)
   *   - ✅ 7일 초과면 알림만 띄우고 조회 중단
   * --------------------------------------------------------- */
  const fetchData = useCallback(
    async (next) => {
      const { dateFrom: df, dateTo: dt, region: r, category: c, storeCode: sc } = next;

      // ✅ 7일 제한: 알림만 띄우고 fetch 자체를 중단
      const dayCount = diffDaysInclusive(df, dt);
      if (dayCount !== null && dayCount > MAX_RANGE_DAYS) {
        alert("조회기간 최대는 7일입니다.");
        startTransition(() => {
          setSummary([]);
          setItems([]);
        });
        return;
      }

      const rangeKey = JSON.stringify({
        df: df || "",
        dt: dt || "",
        r: r || "",
        c: c || "",
        sc: sc || "",
      });

      const cached = cacheRef.current.get(rangeKey);
      if (cached) {
        startTransition(() => {
          setSummary(cached.summary);
          setItems(cached.items);
        });
        return;
      }

      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        setLoading(true);

        const dates = buildDateListInclusive(df, dt);
        if (!dates.length) {
          startTransition(() => {
            setSummary([]);
            setItems([]);
          });
          return;
        }

        async function promisePool(list, limit, worker) {
          const results = new Array(list.length);
          let i = 0;
          const runners = Array.from({ length: Math.min(limit, list.length) }, async () => {
            while (i < list.length) {
              const idx = i++;
              results[idx] = await worker(list[idx], idx);
            }
          });
          await Promise.all(runners);
          return results;
        }

        const CONCURRENCY = 4;

        const daily = await promisePool(dates, CONCURRENCY, async (d) => {
          const qs = new URLSearchParams();
          qs.set("input_date", d);
          if (sc) qs.set("store_code", sc);
          else if (r) qs.set("region", r);

          const qsItems = new URLSearchParams();
          qsItems.set("input_date", d);
          if (sc) qsItems.set("store_code", sc);
          else if (r) qsItems.set("region", r);
          if (c) qsItems.set("category", c);

          const [sRes, iRes] = await Promise.all([
            fetch(`${API_BASE}/api/dashboard/summary?${qs.toString()}`, {
              cache: "no-store",
              signal: controller.signal,
            }),
            fetch(`${API_BASE}/api/dashboard/items?${qsItems.toString()}`, {
              cache: "no-store",
              signal: controller.signal,
            }),
          ]);

          const sJson = await sRes.json().catch(() => ({}));
          const iJson = await iRes.json().catch(() => ({}));

          const sRows = Array.isArray(sJson.rows) ? sJson.rows : [];
          const iRows = Array.isArray(iJson.rows) ? iJson.rows : [];

          const iRowsWithDate = iRows.map((row) => ({
            ...row,
            input_date: d, // ✅ 입력일을 항상 포함
          }));

          return { date: d, summary: sRows, items: iRowsWithDate };
        });

        // ✅ summary 합치기: store_code 기준, 기간 중 1번이라도 입력이면 entered=1
        const sumMap = new Map();
        for (const day of daily) {
          for (const row of day.summary) {
            const key = String(row.store_code || "").trim();
            if (!key) continue;

            const prev = sumMap.get(key);
            const curEntered = Number(row.is_entered) === 1;

            if (!prev) {
              sumMap.set(key, {
                ...row,
                is_entered: curEntered ? 1 : 0,
              });
            } else {
              sumMap.set(key, {
                ...prev,
                store_name: prev.store_name || row.store_name,
                region_name: prev.region_name || row.region_name,
                is_entered: Number(prev.is_entered) === 1 || curEntered ? 1 : 0,
              });
            }
          }
        }

        const nextSummary = Array.from(sumMap.values()).sort((a, b) =>
          String(a.store_code || "").localeCompare(String(b.store_code || ""))
        );

        // ✅ items 합치기 + 정렬
        const nextItems = daily
          .flatMap((d) => d.items)
          .sort((a, b) => {
            const ad = String(a.input_date || "");
            const bd = String(b.input_date || "");
            if (ad !== bd) return ad.localeCompare(bd);

            const asc = String(a.store_code || "");
            const bsc = String(b.store_code || "");
            if (asc !== bsc) return asc.localeCompare(bsc);

            const ac = String(a.category || "");
            const bc = String(b.category || "");
            if (ac !== bc) return ac.localeCompare(bc, "ko");

            return String(a.item_name || "").localeCompare(String(b.item_name || ""), "ko");
          });

        cacheRef.current.set(rangeKey, { summary: nextSummary, items: nextItems });

        startTransition(() => {
          setSummary(nextSummary);
          setItems(nextItems);
        });
      } catch (e) {
        if (e?.name === "AbortError") return;
        console.error("Dashboard fetch error:", e);
        startTransition(() => {
          setSummary([]);
          setItems([]);
        });
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
          setLoading(false);
        }
      }
    },
    [startTransition]
  );

  useEffect(() => {
    fetchData({ dateFrom, dateTo, region, category, storeCode });
  }, [dateFrom, dateTo, region, category, storeCode, fetchData]);

  /* ---------------------------------------------------------
   *  3-G) 필터 옵션
   * --------------------------------------------------------- */
  const regionOptions = useMemo(() => {
    const set = new Set(summary.map((r) => r.region_name).filter(Boolean));
    return Array.from(set).sort((a, b) => String(a).localeCompare(String(b), "ko"));
  }, [summary]);

  const storeOptions = useMemo(() => {
    const rows = region ? summary.filter((r) => r.region_name === region) : summary;
    const map = new Map();
    for (const r of rows) {
      if (r.store_code) {
        map.set(r.store_code, { store_code: r.store_code, store_name: r.store_name });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      String(a.store_code).localeCompare(String(b.store_code))
    );
  }, [summary, region]);

  const categoryOptions = useMemo(() => {
    const set = new Set(items.map((r) => r.category).filter(Boolean));
    return Array.from(set).sort((a, b) => String(a).localeCompare(String(b), "ko"));
  }, [items]);

  /* ---------------------------------------------------------
   *  3-H) KPI
   * --------------------------------------------------------- */
  const kpiData = useMemo(() => {
    const storeSet = new Set(
      summary.map((r) => String(r.store_code || "").trim()).filter(Boolean)
    );
    const totalStores = storeSet.size;

    const enteredStores = summary.filter((r) => Number(r.is_entered) === 1).length;
    const notEnteredStores = Math.max(0, totalStores - enteredStores);
    const inputRows = items.length;

    return { enteredStores, notEnteredStores, inputRows, totalStores };
  }, [summary, items]);

  const KPI_DEFS = useMemo(
    () => [
      { key: "enteredStores", title: "입력매장수" },
      { key: "notEnteredStores", title: "미입력매장수" },
      { key: "totalStores", title: "전체매장수" },
      { key: "inputRows", title: "조회된 입력건수" },
    ],
    []
  );

  /* ---------------------------------------------------------
   *  3-I) 필터 초기화
   * --------------------------------------------------------- */
  const onResetFilters = () => {
    const t = ymdToday();
    setDateFrom(t);
    setDateTo(t);
    setRegion("");
    setStoreCode("");
    setCategory("");
  };

  /* ---------------------------------------------------------
   *  3-J) 저장하기(엑셀 다운로드)
   * --------------------------------------------------------- */
  const onDownloadXlsx = useCallback(async () => {
    if (!items || items.length === 0) return;

    const XLSX = await import("xlsx");

    const rows = items.map((r) => ({
      input_date: String(r.input_date || ""), // ✅ 2026-01-25 형태 유지
      region_name: r.region_name || region || "",
      store_code: r.store_code || "",
      store_name: r.store_name || "",
      category: r.category || "",
      item_name: r.item_name || "",
      expiry_date: formatExpiryYMD(r.expiry_date),
      remaining_days: Number.isFinite(Number(r.remaining_days_by_filter))
        ? Number(r.remaining_days_by_filter)
        : "",
      comment: r.comment || "",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dashboard");
    XLSX.writeFile(wb, "dashboard.xlsx");
  }, [items, region]);

  /* ---------------------------------------------------------
   *  3-K) 입력하기 이동 (항상 store_code/store_name 유지)
   * --------------------------------------------------------- */
  const goInputPage = useCallback(() => {
    const sc = (headerStoreCode || "").trim();
    const sn = (headerStoreName || "").trim();

    const qs = new URLSearchParams();
    if (sc) qs.set("store_code", sc);
    if (sn) qs.set("store_name", sn);

    const q = qs.toString();
    router.push(q ? `/?${q}` : `/`);
  }, [router, headerStoreCode, headerStoreName]);

  if (loading) return <div style={{ padding: 40 }}>로딩중...</div>;

  /* ---------------------------------------------------------
   *  4) 헤더 표기 문자열
   * --------------------------------------------------------- */
  const headerDate = ymdToday();
  const safeCode = headerStoreCode || "-";
  const safeName = headerStoreName || "매장명 없음";

  return (
    <div className="page">
      <style dangerouslySetInnerHTML={{ __html: styles }} />

      {/* Header */}
      <div className="header">
        <div className="headerInner">
          <div className="logo">KFC OPERATIONS | 유통기한 DASHBOARD</div>

          <div className="headerRight">
            <div className="todayText">
              {headerDate} | {safeCode} | {safeName}
              {isPending ? " | 업데이트중..." : ""}
            </div>

            <div className="headerActions">
              <button
                className="headerBtn btnYellow"
                type="button"
                disabled={!items || items.length === 0}
                onClick={onDownloadXlsx}
                title={items?.length ? "dashboard.xlsx 다운로드" : "다운로드할 데이터가 없습니다"}
              >
                저장하기
              </button>

              <button className="headerBtn btnGreen" type="button" onClick={goInputPage}>
                입력하기
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="container">
        <div className="grid">
          {/* Left: KPI + Filters */}
          <div className="leftCol">
            <div className="kpiGrid">
              {KPI_DEFS.map((k) => (
                <Kpi key={k.key} title={k.title} value={kpiData[k.key]} />
              ))}
            </div>

            <div className="filterBox">
              <div className="filterTitle">필터</div>

              <div className="filterRows">
                {/* ✅ 기간 입력 2개 한 행 (구분문자 없음) */}
                <div className="rangeRow">
                  <div className="rowLabel">기간</div>
                  <div className="rangeControls">
                    <input
                      className="control"
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                    <input
                      className="control"
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </div>
                </div>

                <div className="row">
                  <div className="rowLabel">지역</div>
                  <select
                    className="control"
                    value={region}
                    onChange={(e) => {
                      setRegion(e.target.value);
                      setStoreCode("");
                    }}
                  >
                    <option value="">전체</option>
                    {regionOptions.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="row">
                  <div className="rowLabel">매장</div>
                  <select
                    className="control"
                    value={storeCode}
                    onChange={(e) => setStoreCode(e.target.value)}
                  >
                    <option value="">전체</option>
                    {storeOptions.map((s) => (
                      <option key={s.store_code} value={s.store_code}>
                        {s.store_code} | {s.store_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="row hideCategoryOnMobile">
                  <div className="rowLabel">카테고리</div>
                  <select
                    className="control"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="">전체</option>
                    {categoryOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="btnRow">
                <button className="btnSecondary" type="button" onClick={onResetFilters}>
                  초기화
                </button>
              </div>
            </div>
          </div>

          {/* Right: Table */}
          <div className="panel">
            <div className="panelTitle">📋 자재별 유통기한 현황</div>

            <table>
              <thead>
                <tr>
                  <th>입력일</th>
                  <th>매장코드</th>
                  <th>매장명</th>
                  <th>카테고리</th>
                  <th>자재명</th>
                  <th>유통기한</th>
                  <th>남은일수</th>
                </tr>
              </thead>

              <tbody>
                {items.map((r, idx) => {
                  const remain = Number.isFinite(Number(r.remaining_days_by_filter))
                    ? Number(r.remaining_days_by_filter)
                    : null;

                  return (
                    <tr key={idx}>
                      <td>{String(r.input_date || "-")}</td>
                      <td>{r.store_code || "-"}</td>
                      <td>{r.store_name || "-"}</td>
                      <td>{r.category || "-"}</td>
                      <td>{r.item_name || "-"}</td>
                      <td className="dangerText">{formatExpiryYMD(r.expiry_date)}</td>
                      <td className={remain !== null && remain < 0 ? "dangerText" : "muted"}>
                        {remain === null ? "-" : remain}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {items.length === 0 && (
              <div style={{ padding: 30, textAlign: "center", color: "#999" }}>
                표시할 데이터가 없습니다.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
 *  5) KPI 컴포넌트
 * ========================================================= */
function Kpi({ title, value }) {
  const safe = Number.isFinite(Number(value)) ? value : 0;
  return (
    <div className="kpiCard">
      <div className="kpiTitle">{title}</div>
      <div className="kpiValue">{safe}</div>
    </div>
  );
}