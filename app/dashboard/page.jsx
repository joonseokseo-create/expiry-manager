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
   *   - ⚠️ 조회 조건에는 절대 사용하지 않음
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
   *  3-B) 화면 필터 상태
   * --------------------------------------------------------- */
  const [inputDate, setInputDate] = useState(ymdToday());
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
   *  3-E) 화면 스타일(CSS 문자열)
   *  ✅ 모바일(≤560px)에서만:
   *    - 헤더 타이틀 2줄
   *    - 날짜/매장코드/매장명 3줄
   *    - 저장/입력 버튼 세로(작게)
   * --------------------------------------------------------- */
  const styles = `
    /* ✅ 전역: Pretendard Medium */
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
      font-weight:700; /* ✅ 헤더: Pretendard Black */
    }
    /* ✅ 헤더 내부 전부 Black 강제 */
    .header, .header *{
      font-weight:700;
    }

    .headerInner{
      display:flex;
      justify-content:space-between;
      align-items:center;
      gap:12px;
    }

    /* ✅ PC 기본: 2줄 타이틀 + 크게 */
    .logo{
      font-size:28px;
      font-weight:900;
      letter-spacing:.6px;
      white-space:normal;     /* ✅ 2줄 허용 */
      line-height:1.05;
    }
    .logoLine{display:block;}  /* ✅ 항상 줄 단위 */
    .logoBreak{display:block;} /* ✅ 필요시만 쓰고 싶으면 유지 */

    /* PC 기본: 오른쪽 가로 */
    .headerRight{
      display:flex;
      align-items:center;
      gap:10px;
      white-space:nowrap;
    }

    /* PC 기본: 날짜/코드/매장명은 한 줄 */
    .todayText{
      font-size:14px;
      font-weight:900;
      opacity:.95;
      white-space:nowrap;
      word-break:keep-all;
      text-align:right;
      line-height:1.2;
    }
    .headerMetaLine{display:inline;}

    /* PC 기본: 버튼 가로 */
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
    .rowLabel{font-size:13px;font-weight:900;color:#444;white-space:nowrap;line-height:1;}
    .control{
      width:100%;
      height:40px;
      box-sizing:border-box;
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

    /* Table */
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

    /* Tablet */
    @media (max-width:980px){
      .grid{grid-template-columns:1fr;}
      .header{padding:12px 16px;}
      .logo{font-size:22px;white-space:normal;} /* ✅ 22x 오타 수정 */
      .container{margin:16px auto;}
      .panel{max-height:none;}
    }

    /* Mobile (≤560px) */
    @media (max-width:560px){
      .header{padding:10px 12px;}
      .headerInner{gap:10px;align-items:flex-start;}

      /* ✅ 헤더 타이틀 2줄 */
      .logo{
        font-size:21px;
        white-space:normal;
        max-width:52vw;
        line-height:1.15;
        letter-spacing:0;
      }
      .logoLine{display:block;}
      .logoBreak{display:block;}

      /* ✅ 오른쪽 수직 */
      .headerRight{
        flex-direction:column;
        align-items:flex-end;
        gap:8px;
        white-space:normal;
      }

    /* ✅ 날짜 | 매장코드 | 매장명 → 왼쪽 하단 / 한 줄 고정 */
    .todayText{
      grid-column:1 / 2;
      grid-row:2 / 3;

      font-size:10px;
      line-height:1.2;
      text-align:left;

      white-space:nowrap;        /* ✅ 무조건 한 줄 */
      overflow:hidden;           /* ✅ 넘치면 숨김 */
      text-overflow:ellipsis;    /* ✅ 말줄임 처리 */
      max-width:100%;
    }


      /* ✅ 저장/입력 버튼: 세로 + 더 작게 */
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
      .rowLabel{font-size:12px;}
      .control{height:34px;line-height:34px;font-size:12px;padding:0 10px;border-radius:9px;}
      input[type="date"].control{height:34px;line-height:34px;}
      select.control{height:34px;line-height:34px;}

      .btnSecondary{height:34px;font-size:11px;border-radius:9px;}

      /* ✅ 모바일에서 카테고리 필터 숨김 */
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

      /* ✅ 모바일에서 남은일수(6번째) 숨김 */
      table th:nth-child(6),
      table td:nth-child(6){
        display:none;
      }

      /* ✅ 모바일 전용: 매장코드(1번째) 숨김 */
      table th:nth-child(1),
      table td:nth-child(1){
        display:none;
      }

      /* ✅ 모바일 전용: 카테고리(3번째) 숨김 */
      table th:nth-child(3),
      table td:nth-child(3){
        display:none;
      }

      th:nth-child(2),td:nth-child(2){width:36%;}
      th:nth-child(4),td:nth-child(4){width:38%;}
      th:nth-child(5),td:nth-child(5){width:26%;}
    }
  `;

  /* ---------------------------------------------------------
   *  3-F) 데이터 가져오기 (캐시 + 취소 + transition)
   * --------------------------------------------------------- */
  const fetchData = useCallback(
    async (next) => {
      const { inputDate: d, region: r, category: c, storeCode: sc } = next;

      const cacheKey = JSON.stringify({
        d: d || "",
        r: r || "",
        c: c || "",
        sc: sc || "",
      });

      const cached = cacheRef.current.get(cacheKey);
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

        const qs = new URLSearchParams();
        if (d) qs.set("input_date", d);
        if (sc) qs.set("store_code", sc);
        else if (r) qs.set("region", r);

        const qsItems = new URLSearchParams();
        if (d) qsItems.set("input_date", d);
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

        const nextSummary = Array.isArray(sJson.rows) ? sJson.rows : [];
        const nextItems = Array.isArray(iJson.rows) ? iJson.rows : [];

        cacheRef.current.set(cacheKey, {
          summary: nextSummary,
          items: nextItems,
        });

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
    fetchData({ inputDate, region, category, storeCode });
  }, [inputDate, region, category, storeCode, fetchData]);

  /* ---------------------------------------------------------
   *  3-G) 필터 옵션
   * --------------------------------------------------------- */
  const regionOptions = useMemo(() => {
    const set = new Set(summary.map((r) => r.region_name).filter(Boolean));
    return Array.from(set).sort((a, b) =>
      String(a).localeCompare(String(b), "ko")
    );
  }, [summary]);

  const storeOptions = useMemo(() => {
    const rows = region ? summary.filter((r) => r.region_name === region) : summary;
    const map = new Map();
    for (const r of rows) {
      if (r.store_code) {
        map.set(r.store_code, {
          store_code: r.store_code,
          store_name: r.store_name,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      String(a.store_code).localeCompare(String(b.store_code))
    );
  }, [summary, region]);

  const categoryOptions = useMemo(() => {
    const set = new Set(items.map((r) => r.category).filter(Boolean));
    return Array.from(set).sort((a, b) =>
      String(a).localeCompare(String(b), "ko")
    );
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
    setInputDate(ymdToday());
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
      input_date: inputDate || "",
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
  }, [items, inputDate, region]);

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

  /* =========================================================
   *  4) 헤더 표기 문자열
   *   - PC: "YYYY-MM-DD / CODE / NAME" 한 줄
   *   - Mobile: 3줄 (CSS에서 block 처리)
   * ========================================================= */
  const headerDate = ymdToday();
  const safeCode = headerStoreCode || "-";
  const safeName = headerStoreName || "매장명 없음";

  return (
    <div className="page">
      <style dangerouslySetInnerHTML={{ __html: styles }} />

      {/* Header */}
      <div className="header">
        <div className="headerInner">
          {/* ✅ 모바일에서 2줄 */}
          <div className="logo">
            <span className="logoLine">KFC OPERATIONS</span>
            <span className="logoBreak" />
            <span className="logoLine">유통기한 DASHBOARD</span>
          </div>

          <div className="headerRight">
            {/* ✅ PC: 한 줄 / Mobile: 3줄 */}
            <div className="todayText">
              <span className="headerMetaLine">{headerDate}</span>
              <span className="headerMetaLine"> | {safeCode}</span>
              <span className="headerMetaLine"> | {safeName}</span>
              <span>{isPending ? " | 업데이트중..." : ""}</span>
            </div>

            {/* ✅ PC: 가로 / Mobile: 세로(작게) */}
            <div className="headerActions">
              <button
                className="headerBtn btnYellow"
                type="button"
                disabled={!items || items.length === 0}
                onClick={onDownloadXlsx}
                title={
                  items?.length ? "dashboard.xlsx 다운로드" : "다운로드할 데이터가 없습니다"
                }
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
                <div className="row">
                  <div className="rowLabel">날짜</div>
                  <input
                    className="control"
                    type="date"
                    value={inputDate}
                    onChange={(e) => setInputDate(e.target.value)}
                  />
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