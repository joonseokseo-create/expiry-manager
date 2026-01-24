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

// 오늘 날짜 (KST) YYYY-MM-DD
function ymdToday() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

// 유통기한 표시: "2026-01-25" 형태로 강제 (✅ 요청 1)
function formatExpiryYMD(v) {
  if (!v) return "";

  const raw = String(v);

  // 1) "YYYY-MM-DD"가 포함되어 있으면 그것 우선
  const m = raw.match(/\d{4}-\d{2}-\d{2}/);
  if (m) return m[0]; // ✅ 2026-01-25

  // 2) Date 파싱 가능한 경우 (예: "Sun, 25 Jan 2026 00:00:00 GMT")
  const d = new Date(raw);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${mm}-${dd}`; // ✅ 2026-01-25
  }

  // 3) 최후 fallback
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
  const currentStoreCode = (searchParams.get("store_code") || "").trim();
  const currentStoreName = (searchParams.get("store_name") || "").trim();

  const [headerStoreCode, setHeaderStoreCode] = useState("");
  const [headerStoreName, setHeaderStoreName] = useState("");

  useEffect(() => {
    if (currentStoreCode) setHeaderStoreCode(currentStoreCode);
    if (currentStoreName) setHeaderStoreName(currentStoreName);
  }, [currentStoreCode, currentStoreName]);

  useEffect(() => {
    if (currentStoreCode || currentStoreName) return;
    try {
      const raw = localStorage.getItem("kfc_store_info");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const sc = (parsed?.storeCode || "").trim();
      const sn = (parsed?.storeName || "").trim();
      if (sc) setHeaderStoreCode(sc);
      if (sn) setHeaderStoreName(sn);
    } catch {}
  }, [currentStoreCode, currentStoreName]);

  /* ---------------------------------------------------------
   *  3-B) 화면 필터 상태
   *   ✅ 기본 축: 날짜 + 지역
   *   ✅ 매장은 Drill-down(선택 시만 store_code 사용)
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
   *   ✅ 요청 3: 입력하기(초록), 저장하기(노랑)
   * --------------------------------------------------------- */
  const styles = `
    .page{min-height:100vh;background:linear-gradient(135deg,#FFF1E2 0%,#F5D4B7 100%);}

    /* Header */
    .header{
      background:linear-gradient(90deg,#A3080B 0%,#DC001B 100%);
      padding:14px 20px;
      color:#fff;
      font-size:18px;
      font-weight:900;
    }
    .headerInner{
      display:flex;
      justify-content:space-between;
      align-items:center;
      gap:10px;
    }
    .logo{
      letter-spacing:.5px;
      white-space:nowrap;
      font-size:18px;
      font-weight:900;
    }
    .headerRight{
      display:flex;
      align-items:center;
      gap:8px;
      white-space:nowrap;
    }

    .headerBtn{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      height:32px;
      padding:0 10px;
      border-radius:10px;
      border:1px solid rgba(255,255,255,0.35);
      color:#fff;
      font-weight:900;
      font-size:12px;
      text-decoration:none;
      white-space:nowrap;
      cursor:pointer;
      box-shadow:0 2px 10px rgba(0,0,0,.12);
    }
    .btnGreen{background:rgba(46, 204, 113, 0.95); border-color: rgba(255,255,255,0.25);}
    .btnGreen:hover{filter:brightness(0.95);}
    .btnYellow{background:rgba(241, 196, 15, 0.95); border-color: rgba(255,255,255,0.25); color:#2b2b2b;}
    .btnYellow:hover{filter:brightness(0.96);}
    .headerBtn:disabled{opacity:.55;cursor:not-allowed;}

    .todayText{
      font-size:12px;
      font-weight:900;
      opacity:.95;
      white-space:nowrap;
    }

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
      .header{padding:12px 16px;font-size:14px;}
      .logo{font-size:14px;white-space:normal;}
      .container{margin:16px auto;}
      .panel{max-height:none;}
    }

    /* Mobile (핵심 축소) */
    @media (max-width:560px){
      .header{padding:10px 12px;}
      .headerInner{gap:8px;}
      .logo{
        font-size:12px;
        letter-spacing:0;
        white-space:normal;
        line-height:1.1;
        max-width:46vw;
      }
      .headerRight{gap:6px;}

      .headerBtn{
        height:26px;
        padding:0 8px;
        font-size:10px;
        border-radius:8px;
      }
      .todayText{
        font-size:9px;
        max-width:36vw;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
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
      th:nth-child(1),td:nth-child(1){width:18%;}
      th:nth-child(2),td:nth-child(2){width:24%;}
      th:nth-child(3),td:nth-child(3){width:16%;}
      th:nth-child(4),td:nth-child(4){width:22%;}
      th:nth-child(5),td:nth-child(5){width:12%;}
      th:nth-child(6),td:nth-child(6){width:8%;text-align:right;}
    }
  `;

  /* ---------------------------------------------------------
   *  3-F) 데이터 가져오기 (캐시 + 취소 + transition)
   *  ✅ 정책:
   *   - input_date 항상 적용
   *   - region 선택 시 region 적용
   *   - storeCode 선택 시 store_code로 Drill-down (region보다 우선)
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

        // summary: 날짜 + (매장선택이면 store_code, 아니면 region)
        const qs = new URLSearchParams();
        if (d) qs.set("input_date", d);
        if (sc) qs.set("store_code", sc);
        else if (r) qs.set("region", r);

        // items: 날짜 + (매장선택이면 store_code, 아니면 region) + category
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

        cacheRef.current.set(cacheKey, { summary: nextSummary, items: nextItems });

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
   *  3-G) 필터 옵션 (지역/매장/카테고리)
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
   *  3-H) KPI (✅ 요청 2)
   *
   *  - enteredStores: 해당 필터(날짜+지역(+매장))에서 is_entered=1인 매장수
   *  - totalStores: 해당 필터에 걸린 전체 매장수(중복 제거)
   *  - notEnteredStores = totalStores - enteredStores
   *
   *  ⚠️ 기존 문제 원인: is_entered가 문자열("1")인 경우가 많아 ===1로 카운팅이 안 됨.
   *     → Number()로 정규화해서 카운팅
   * --------------------------------------------------------- */
  const kpiData = useMemo(() => {
    // summary가 "매장 1행" 구조라고 가정하고, 안전하게 unique store로 계산
    const storeSet = new Set(
      summary.map((r) => String(r.store_code || "").trim()).filter(Boolean)
    );
    const totalStores = storeSet.size;

    const enteredStores = summary.filter((r) => Number(r.is_entered) === 1).length;

    const notEnteredStores = Math.max(0, totalStores - enteredStores);

    // 등록품목/조회건수: 현재 items 기준으로 유지
    const totalCnt = items.length; // "현재 필터로 조회된 입력건수"와 동일하게 보이게(혼선 방지)
    const inputRows = items.length;

    return { enteredStores, notEnteredStores, totalCnt, inputRows, totalStores };
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
   *  3-J) 저장하기(엑셀 다운로드) (✅ 요청 3)
   *   - 현재 필터로 조회된 items를 dashboard.xlsx로 다운로드
   * --------------------------------------------------------- */
  const onDownloadXlsx = useCallback(async () => {
    // 데이터 없으면 다운로드하지 않음
    if (!items || items.length === 0) return;

    // 동적 import로 번들 최소화
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

    // 시트명: Dashboard
    XLSX.utils.book_append_sheet(wb, ws, "Dashboard");

    // 파일명: dashboard.xlsx (요청 그대로)
    XLSX.writeFile(wb, "dashboard.xlsx");
  }, [items, inputDate, region]);

  /* ---------------------------------------------------------
   *  3-K) 로딩 표시
   * --------------------------------------------------------- */
  if (loading) return <div style={{ padding: 40 }}>로딩중...</div>;

  /* =========================================================
   *  4) 렌더링
   * ========================================================= */
  return (
    <div className="page">
      <style dangerouslySetInnerHTML={{ __html: styles }} />

      {/* Header */}
      <div className="header">
        <div className="headerInner">
          <div className="logo">KFC OPERATIONS - 유통기한 DASHBOARD</div>

          <div className="headerRight">
            {/* ✅ 저장하기 버튼(노랑) */}
            <button
              className="headerBtn btnYellow"
              type="button"
              disabled={!items || items.length === 0}
              onClick={onDownloadXlsx}
              title={items?.length ? "dashboard.xlsx 다운로드" : "다운로드할 데이터가 없습니다"}
            >
              저장하기
            </button>

            {/* ✅ 입력하기 버튼(초록) */}
            <button
              className="headerBtn btnGreen"
              type="button"
              onClick={() => {
                const qs = new URLSearchParams();
                if (headerStoreCode) qs.set("store_code", headerStoreCode);
                if (headerStoreName) qs.set("store_name", headerStoreName);
                const q = qs.toString();
                router.push(q ? `/?${q}` : `/`);
              }}
            >
              입력하기
            </button>

            <div className="todayText">
              {ymdToday()} | {headerStoreCode || "-"} | {headerStoreName || "매장명 없음"}
              {isPending ? " | 업데이트중..." : ""}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="container">
        <div className="grid">
          {/* Left: KPI + Filters */}
          <div className="leftCol">
            {/* KPI */}
            <div className="kpiGrid">
              {KPI_DEFS.map((k) => (
                <Kpi key={k.key} title={k.title} value={kpiData[k.key]} />
              ))}
            </div>

            {/* Filters */}
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
                      setStoreCode(""); // 지역 변경 시 매장 초기화
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

                <div className="row">
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

                      {/* ✅ 요청 1: 2026-01-25 */}
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
  );@media (max-width:768px){
}
