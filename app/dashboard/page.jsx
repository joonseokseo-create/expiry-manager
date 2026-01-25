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
const API_BASE =
  "https://inventory-api-231876330057.asia-northeast3.run.app";

/* =========================================================
 *  1) 날짜/표시 유틸 (KST 고정)
 * ========================================================= */
function ymdToday() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

/** YYYY-MM-DD로 무조건 정규화 (입력일/유통기한 모두 동일 포맷) */
function toYMD(v) {
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

function addDays(ymd, delta) {
  const m = String(ymd || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  dt.setDate(dt.getDate() + delta);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function diffDaysInclusive(startYMD, endYMD) {
  const s = toYMD(startYMD);
  const e = toYMD(endYMD);
  if (!s || !e) return 0;
  const [sy, sm, sd] = s.split("-").map(Number);
  const [ey, em, ed] = e.split("-").map(Number);
  const sDate = new Date(sy, sm - 1, sd);
  const eDate = new Date(ey, em - 1, ed);
  const ms = eDate.getTime() - sDate.getTime();
  if (isNaN(ms)) return 0;
  return Math.floor(ms / (24 * 60 * 60 * 1000)) + 1; // inclusive
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
   *  3-B) 화면 필터 상태 (기간)
   * --------------------------------------------------------- */
  const today = ymdToday();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  const [region, setRegion] = useState("");
  const [storeCode, setStoreCode] = useState("");
  const [category, setCategory] = useState("");

  /* ---------------------------------------------------------
   *  3-C) 서버 데이터 상태 (기간용 Raw + 화면 표시용)
   * --------------------------------------------------------- */
  const [rawSummary, setRawSummary] = useState([]);
  const [rawItems, setRawItems] = useState([]);

  const [summary, setSummary] = useState([]);
  const [items, setItems] = useState([]);

  const [loading, setLoading] = useState(false);

  /* ---------------------------------------------------------
   *  3-D) 성능 최적화(캐시/취소/transition)
   * --------------------------------------------------------- */
  const cacheRef = useRef(new Map());
  const dayCacheRef = useRef(new Map()); // key: ymd|scope -> {daySummary, dayItems}
  const abortRef = useRef(null);
  const [isPending, startTransition] = useTransition();

  // 7일 초과 알림 "중복 방지"
  const alertedRef = useRef({ key: "" });

  /* ---------------------------------------------------------
   *  3-E) 화면 스타일(CSS 문자열)
   * --------------------------------------------------------- */
  const styles = `
    *{
      font-family:"Pretendard", system-ui, -apple-system, BlinkMacSystemFont;
      font-weight:500;
      box-sizing:border-box;
    }
    .page{min-height:100vh;background:linear-gradient(135deg,#FFF1E2 0%,#F5D4B7 100%);}

    /* Header */
    .header{
      background:linear-gradient(90deg,#A3080B 0%,#DC001B 100%);
      padding:14px 20px;
      color:#fff;
      font-weight:700;
      overflow:hidden;
    }
    .header, .header *{font-weight:700;}
    .headerInner{
      display:flex;
      justify-content:space-between;
      align-items:center;
      gap:12px;
      width:100%;
      min-width:0;
      flex-wrap:nowrap;
    }

    /* Title */
    .logo{
      font-size:26px;
      font-weight:900;
      letter-spacing:.6px;
      line-height:1.05;
      min-width:0;
    }
    .logoTop{display:block;}
    .logoBottom{display:block;}

    /* Right */
    .headerRight{
      display:flex;
      align-items:center;
      gap:10px;
      white-space:nowrap;
      min-width:0;
      flex-shrink:0;
    }
    .todayText{
      font-size:14px;
      font-weight:900;
      opacity:.95;
      white-space:nowrap;
      word-break:keep-all;
      text-align:right;
      line-height:1.2;
      overflow:hidden;
      text-overflow:ellipsis;
      max-width:48vw;
    }
    .headerActions{
      display:flex;
      flex-direction:row;
      gap:8px;
      align-items:center;
      flex-shrink:0;
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

    /* Layout */
    .container{max-width:1400px;margin:22px auto;padding:0 16px;}
    .grid{display:grid;grid-template-columns:420px 1fr;gap:18px;align-items:start;}
    .leftCol{display:flex;flex-direction:column;gap:12px;}

    /* KPI */
    .kpiGrid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
    .kpiCard{
      background:#fff;border-radius:14px;padding:18px;
      box-shadow:0 4px 16px rgba(0,0,0,.08);
      text-align:center;
    }
    .kpiTitle{font-size:12px;font-weight:900;color:#666;}
    .kpiValue{font-size:32px;font-weight:900;color:#C62828;margin-top:6px;line-height:1;}

    /* Panel */
    .panel{
      background:#fff;border-radius:14px;padding:18px;
      box-shadow:0 4px 20px rgba(0,0,0,.08);
      overflow:auto;
      max-height:calc(100vh - 140px);
    }
    .panelTitle{font-size:16px;font-weight:900;margin-bottom:12px;}

    /* Filters */
    .filterBox{background:#fff;border-radius:14px;padding:14px;box-shadow:0 4px 16px rgba(0,0,0,.08);}
    .filterTitle{font-weight:900;color:#A3080B;margin-bottom:10px;font-size:12px;}
    .filterRows{display:flex;flex-direction:column;gap:10px;}
    .row{display:grid;grid-template-columns:64px 1fr;gap:10px;align-items:center;}
    .rangeRow{display:grid;grid-template-columns:64px 1fr;gap:10px;align-items:center;}
    .rowLabel{font-size:13px;font-weight:900;color:#444;white-space:nowrap;line-height:1;}
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
      min-width:0;
    }
    .control:focus{border-color:#A3080B;box-shadow:0 0 0 3px rgba(163,8,11,.08);}
    input[type="date"].control{height:40px;line-height:40px;padding:0 12px;}
    select.control{height:40px;line-height:40px;}

    .rangeControls{
      display:flex;
      gap:6px;
      align-items:center;
      min-width:0;
    }
    .rangeControls .control{flex:1;}

    .btnRow{display:flex;gap:10px;margin-top:12px;}
    .btnSecondary{
      height:40px;border-radius:10px;border:1px solid #E3E3E3;
      cursor:pointer;font-weight:900;background:#fff;flex:1;
      font-size:12px;
    }

    /* Table */
    table{width:100%;border-collapse:collapse;}
    th,td{
      padding:10px 8px;
      border-bottom:1px solid #eee;
      text-align:left;
      font-size:13px;
      vertical-align:top;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }
    th{
      font-weight:900;color:#444;background:#fafafa;
      position:sticky;top:0;z-index:1;
    }
    .dangerText{color:#C62828;font-weight:900;}
    .muted{color:#777;font-weight:900;}

    /* PC 매장명 폭 12글자 확보 */
    .storeNameCell{max-width:12ch;width:12ch;}

    @media (max-width:980px){
      .grid{grid-template-columns:1fr;}
      .header{padding:12px 16px;}
      .logo{font-size:22px;}
      .container{margin:16px auto;}
      .panel{max-height:none;}
      .todayText{max-width:60vw;}
    }

    @media (max-width:560px){
      .header{padding:10px 12px;}
      .headerInner{gap:8px;align-items:flex-start;min-width:0;}

      .logo{
        font-size:14px;
        max-width:52vw;
        white-space:normal;
        line-height:1.05;
        letter-spacing:0;
        overflow:hidden;
      }

      .headerRight{
        flex-direction:column;
        align-items:flex-end;
        gap:8px;
        white-space:normal;
        min-width:0;
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
        width:76px;
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

      /* ✅ 모바일 필터: 라벨/컨트롤 더 붙이고 사이즈 축소 */
      .filterBox{padding:10px;}
      .filterRows{gap:8px;}
      .row{grid-template-columns:52px 1fr;gap:6px;}
      .rangeRow{grid-template-columns:52px 1fr;gap:6px;}
      .rowLabel{font-size:12px;}
      .control{height:34px;line-height:34px;font-size:12px;padding:0 8px;border-radius:9px;}
      input[type="date"].control{height:34px;line-height:34px;}
      select.control{height:34px;line-height:34px;}
      .rangeControls{gap:4px;}
      .btnSecondary{height:34px;font-size:11px;border-radius:9px;}

      .hideCategoryOnMobile{display:none !important;}

      .panel{padding:12px;}
      .panelTitle{font-size:13px;margin-bottom:10px;}

      table{table-layout:fixed;}
      th,td{
        font-size:10px;
        padding:6px 6px;
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

      /* 모바일 폭 재배분 (입력일/매장명/자재명/유통기한) */
      th:nth-child(1),td:nth-child(1){width:26%;}
      th:nth-child(3),td:nth-child(3){width:26%;}
      th:nth-child(5),td:nth-child(5){width:24%;}
      th:nth-child(6),td:nth-child(6){width:24%;}

      .storeNameCell{max-width:none;width:auto;}
    }
  `;

  /* ---------------------------------------------------------
   *  3-F) 데이터 가져오기
   *    - 백엔드에 기간 파라미터 전달 X
   *    - input_date로 날짜별 호출 후 합산
   *    - 7일 초과는 "알림만" (조회는 계속 진행)
   * --------------------------------------------------------- */
  const fetchRangeData = useCallback(
    async (next) => {
      const { startDate: s0, endDate: e0, region: r, category: c, storeCode: sc } = next;

      const s = toYMD(s0);
      const e = toYMD(e0);
      if (!s || !e) return;

      const start = s <= e ? s : e;
      const end = s <= e ? e : s;

      const span = diffDaysInclusive(start, end);

      // ✅ 7일 초과: 알람만, 조회는 계속
      const alertKey = `${start}|${end}`;
      if (span > 7 && alertedRef.current.key !== alertKey) {
        alertedRef.current.key = alertKey;
        alert("조회기간 최대는 7일입니다.");
      }
      if (span <= 7 && alertedRef.current.key === alertKey) {
        alertedRef.current.key = "";
      }

      const cacheKey = JSON.stringify({
        start,
        end,
        r: r || "",
        sc: sc || "",
        c: c || "",
      });

      const cached = cacheRef.current.get(cacheKey);
      if (cached) {
        startTransition(() => {
          setRawSummary(cached.rawSummary);
          setRawItems(cached.rawItems);
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

        const days = [];
        for (let i = 0; i < span; i++) days.push(addDays(start, i));

        const fetchOneDay = async (day) => {
          const scopeKey = sc ? `sc:${sc}` : r ? `r:${r}` : "all";
          const dayKey = `${day}|${scopeKey}|${c || ""}`;

          const cachedDay = dayCacheRef.current.get(dayKey);
          if (cachedDay) return cachedDay;

          const qs = new URLSearchParams();
          qs.set("input_date", day);
          if (sc) qs.set("store_code", sc);
          else if (r) qs.set("region", r);

          const qsItems = new URLSearchParams();
          qsItems.set("input_date", day);
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

          const daySummary = Array.isArray(sJson.rows) ? sJson.rows : [];
          const dayItems0 = Array.isArray(iJson.rows) ? iJson.rows : [];

          // ✅ 입력일 주입 + 포맷 강제
          const dayItems = dayItems0.map((x) => ({
            ...x,
            input_date: toYMD(x.input_date || day),
          }));

          const out = { daySummary, dayItems };
          dayCacheRef.current.set(dayKey, out);
          return out;
        };

        const results = await Promise.all(days.map((d) => fetchOneDay(d)));

        // summary 합산(매장 단위, is_entered OR)
        const summaryMap = new Map();
        for (const res of results) {
          for (const r0 of res.daySummary) {
            const k = String(r0.store_code || "").trim();
            if (!k) continue;
            const prev = summaryMap.get(k);
            if (!prev) summaryMap.set(k, { ...r0 });
            else {
              summaryMap.set(k, {
                ...prev,
                is_entered:
                  Number(prev.is_entered) === 1 || Number(r0.is_entered) === 1 ? 1 : 0,
              });
            }
          }
        }
        const nextRawSummary = Array.from(summaryMap.values());
        const nextRawItems = results.flatMap((res) => res.dayItems);

        cacheRef.current.set(cacheKey, {
          rawSummary: nextRawSummary,
          rawItems: nextRawItems,
          summary: nextRawSummary,
          items: nextRawItems,
        });

        startTransition(() => {
          setRawSummary(nextRawSummary);
          setRawItems(nextRawItems);
          setSummary(nextRawSummary);
          setItems(nextRawItems);
        });
      } catch (e) {
        if (e?.name === "AbortError") return;
        console.error("Dashboard fetch error:", e);
        startTransition(() => {
          setRawSummary([]);
          setRawItems([]);
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
    fetchRangeData({ startDate, endDate, region, category, storeCode });
  }, [startDate, endDate, region, category, storeCode, fetchRangeData]);

  /* ---------------------------------------------------------
   *  3-G) 옵션: 지역/매장/카테고리
   * --------------------------------------------------------- */
  const regionOptions = useMemo(() => {
    const set = new Set(rawSummary.map((r) => r.region_name).filter(Boolean));
    return Array.from(set).sort((a, b) => String(a).localeCompare(String(b), "ko"));
  }, [rawSummary]);

  const storeOptions = useMemo(() => {
    const rows = region ? rawSummary.filter((r) => r.region_name === region) : rawSummary;
    const map = new Map();
    for (const r of rows) {
      if (r.store_code) {
        map.set(r.store_code, { store_code: r.store_code, store_name: r.store_name });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      String(a.store_code).localeCompare(String(b.store_code))
    );
  }, [rawSummary, region]);

  const categoryOptions = useMemo(() => {
    const set = new Set(rawItems.map((r) => r.category).filter(Boolean));
    return Array.from(set).sort((a, b) => String(a).localeCompare(String(b), "ko"));
  }, [rawItems]);

  /* ---------------------------------------------------------
   *  3-H) 화면 표시용 items 최종 필터 (프론트에서만)
   * --------------------------------------------------------- */
  const viewItems = useMemo(() => {
    let rows = Array.isArray(items) ? items : [];

    if (region && !storeCode) {
      rows = rows.filter((r) => String(r.region_name || "") === String(region));
    }
    if (storeCode) {
      rows = rows.filter((r) => String(r.store_code || "") === String(storeCode));
    }
    if (category) {
      rows = rows.filter((r) => String(r.category || "") === String(category));
    }

    // ✅ 입력일/유통기한 포맷 고정
    rows = rows.map((r) => ({
      ...r,
      input_date: toYMD(r.input_date),
      expiry_date: toYMD(r.expiry_date),
    }));

    // 정렬: 입력일 desc → 매장명 → 자재명
    rows.sort((a, b) => {
      const ad = String(a.input_date || "");
      const bd = String(b.input_date || "");
      if (ad !== bd) return bd.localeCompare(ad);
      const asn = String(a.store_name || "");
      const bsn = String(b.store_name || "");
      if (asn !== bsn) return asn.localeCompare(bsn, "ko");
      return String(a.item_name || "").localeCompare(String(b.item_name || ""), "ko");
    });

    return rows;
  }, [items, region, storeCode, category]);

  /* ---------------------------------------------------------
   *  3-I) KPI
   * --------------------------------------------------------- */
  const kpiData = useMemo(() => {
    const storeSet = new Set(
      summary.map((r) => String(r.store_code || "").trim()).filter(Boolean)
    );
    const totalStores = storeSet.size;
    const enteredStores = summary.filter((r) => Number(r.is_entered) === 1).length;
    const notEnteredStores = Math.max(0, totalStores - enteredStores);

    return {
      enteredStores,
      notEnteredStores,
      totalStores,
      inputRows: viewItems.length,
    };
  }, [summary, viewItems]);

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
   *  3-J) 필터 초기화
   * --------------------------------------------------------- */
  const onResetFilters = () => {
    const t = ymdToday();
    setStartDate(t);
    setEndDate(t);
    setRegion("");
    setStoreCode("");
    setCategory("");
  };

  /* ---------------------------------------------------------
   *  3-K) 저장하기(엑셀 다운로드)
   * --------------------------------------------------------- */
  const onDownloadXlsx = useCallback(async () => {
    if (!viewItems || viewItems.length === 0) return;

    const XLSX = await import("xlsx");

    const rows = viewItems.map((r) => ({
      input_date: toYMD(r.input_date),
      region_name: r.region_name || region || "",
      store_code: r.store_code || "",
      store_name: r.store_name || "",
      category: r.category || "",
      item_name: r.item_name || "",
      expiry_date: toYMD(r.expiry_date),
      remaining_days: Number.isFinite(Number(r.remaining_days_by_filter))
        ? Number(r.remaining_days_by_filter)
        : "",
      comment: r.comment || "",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dashboard");
    XLSX.writeFile(wb, "dashboard.xlsx");
  }, [viewItems, region]);

  /* ---------------------------------------------------------
   *  3-L) 입력하기 이동
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
   *  4) 헤더 표기
   * --------------------------------------------------------- */
  const headerDate = ymdToday();
  const safeCode = headerStoreCode || "-";
  const safeName = headerStoreName || "매장명 없음";

  return (
    <div className="page">
      <style dangerouslySetInnerHTML={{ __html: styles }} />

      <div className="header">
        <div className="headerInner">
          <div className="logo">
            <span className="logoTop">KFC OPERATIONS</span>
            <span className="logoBottom">유통기한 DASHBOARD</span>
          </div>

          <div className="headerRight">
            <div className="todayText" title={`${headerDate} | ${safeCode} | ${safeName}`}>
              {headerDate} | {safeCode} | {safeName}
              {isPending ? " | 업데이트중..." : ""}
            </div>

            <div className="headerActions">
              <button
                className="headerBtn btnYellow"
                type="button"
                disabled={!viewItems || viewItems.length === 0}
                onClick={onDownloadXlsx}
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

      <div className="container">
        <div className="grid">
          <div className="leftCol">
            <div className="kpiGrid">
              {KPI_DEFS.map((k) => (
                <Kpi key={k.key} title={k.title} value={kpiData[k.key]} />
              ))}
            </div>

            <div className="filterBox">
              <div className="filterTitle">필터</div>

              <div className="filterRows">
                <div className="rangeRow">
                  <div className="rowLabel">기간</div>
                  <div className="rangeControls">
                    <input
                      className="control"
                      type="date"
                      value={toYMD(startDate)}
                      onChange={(e) => setStartDate(toYMD(e.target.value))}
                    />
                    <input
                      className="control"
                      type="date"
                      value={toYMD(endDate)}
                      onChange={(e) => setEndDate(toYMD(e.target.value))}
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
                {viewItems.map((r, idx) => {
                  const remain = Number.isFinite(Number(r.remaining_days_by_filter))
                    ? Number(r.remaining_days_by_filter)
                    : null;

                  return (
                    <tr key={idx}>
                      <td>{toYMD(r.input_date)}</td>
                      <td>{r.store_code || "-"}</td>
                      <td className="storeNameCell" title={r.store_name || ""}>
                        {r.store_name || "-"}
                      </td>
                      <td>{r.category || "-"}</td>
                      <td title={r.item_name || ""}>{r.item_name || "-"}</td>
                      <td className="dangerText">{toYMD(r.expiry_date)}</td>
                      <td className={remain !== null && remain < 0 ? "dangerText" : "muted"}>
                        {remain === null ? "-" : remain}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {viewItems.length === 0 && (
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