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

const API_BASE = "https://inventory-api-231876330057.asia-northeast3.run.app";

/** =========================
 *  0) 유틸 함수
 * ========================= */
function ymdToday() {
  return new Date().toISOString().slice(0, 10);
}

// PC용: YYYY-MM-DD(요일)
function toYMD(v) {
  if (!v) return "";
  const raw = String(v);
  const m = raw.match(/\d{4}-\d{2}-\d{2}/);
  const ymd = m ? m[0] : raw.slice(0, 10);

  let d;
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    const [yy, mm, dd] = ymd.split("-").map(Number);
    d = new Date(yy, mm - 1, dd);
  } else {
    d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
  }

  const y = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const week = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return `${y}-${mm}-${dd}(${week})`;
}

// 모바일용: YY-MM-DD
function toYMDShort(v) {
  if (!v) return "";
  const raw = String(v);
  const m = raw.match(/\d{4}-\d{2}-\d{2}/);
  if (m) return m[0].slice(2);

  const d = new Date(raw);
  if (!isNaN(d.getTime())) {
    const yy = String(d.getFullYear()).slice(2);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  }
  return raw.slice(0, 10);
}

/** =========================
 *  1) 페이지 엔트리 (Suspense)
 * ========================= */
export default function DashboardPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40 }}>로딩중...</div>}>
      <DashboardPageInner />
    </Suspense>
  );
}

/** =========================
 *  2) 실제 대시보드 컴포넌트
 * ========================= */
function DashboardPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  /** =========================
   *  A) 현재 매장 정보 (Header 표시용)
   * ========================= */
  const currentStoreCode = (searchParams.get("store_code") || "").trim();
  const currentStoreName = (searchParams.get("store_name") || "").trim();

  const [headerStoreCode, setHeaderStoreCode] = useState("");
  const [headerStoreName, setHeaderStoreName] = useState("");

  // 1) URL 값 우선 반영
  useEffect(() => {
    if (currentStoreCode) setHeaderStoreCode(currentStoreCode);
    if (currentStoreName) setHeaderStoreName(currentStoreName);
  }, [currentStoreCode, currentStoreName]);

  // 2) URL이 없을 때 localStorage fallback
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

  /** =========================
   *  B) 상태 (필터/데이터)
   * ========================= */
  const [summary, setSummary] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const [inputDate, setInputDate] = useState(ymdToday());
  const [region, setRegion] = useState("");
  const [storeCode, setStoreCode] = useState("");
  const [category, setCategory] = useState("");

  // 실제 조회에 사용할 store_code (기존 로직 유지)
  const effectiveStoreCode = useMemo(() => {
    return (storeCode || headerStoreCode || "").trim();
  }, [storeCode, headerStoreCode]);

  // 첫 진입 시 URL store_code가 있으면 필터에도 주입
  useEffect(() => {
    if (currentStoreCode) setStoreCode(currentStoreCode);
  }, [currentStoreCode]);

  /** =========================
   *  B-1) 성능 개선용 (취소/캐시/transition)
   * ========================= */
  const cacheRef = useRef(new Map()); // key -> {summary, items}
  const abortRef = useRef(null); // AbortController
  const [isPending, startTransition] = useTransition();

  /** =========================
   *  C) 스타일 (CSS)
   * ========================= */
  const styles = `
    .page{min-height:100vh;background:linear-gradient(135deg,#FFF1E2 0%,#F5D4B7 100%);}
    .header{background:linear-gradient(90deg,#A3080B 0%,#DC001B 100%);padding:18px 28px;color:#fff;font-size:22px;font-weight:900;}
    .headerInner{display:flex;justify-content:space-between;align-items:center;gap:12px;}
    .logo{letter-spacing:1px;white-space:nowrap;}
    .headerRight{display:flex;align-items:center;gap:10px;white-space:nowrap;}
    .headerBtn{display:inline-flex;align-items:center;justify-content:center;height:34px;padding:0 12px;border-radius:10px;background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.35);color:#fff;font-weight:900;font-size:13px;text-decoration:none;white-space:nowrap;cursor:pointer;}
    .headerBtn:hover{background:rgba(255,255,255,0.28);}
    .todayText{font-size:14px;font-weight:900;opacity:.95;white-space:nowrap;}
    .onlyDesktop{display:inline;} .onlyMobile{display:none;}

    .container{max-width:1400px;margin:30px auto;padding:0 20px;}
    .grid{display:grid;grid-template-columns:420px 1fr;gap:26px;align-items:start;}
    .leftCol{display:flex;flex-direction:column;gap:14px;}

    .kpiGrid{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
    .kpiCard{background:#fff;border-radius:14px;padding:22px;box-shadow:0 4px 16px rgba(0,0,0,.08);text-align:center;}
    .kpiTitle{font-size:14px;font-weight:800;color:#666;}
    .kpiValue{font-size:38px;font-weight:900;color:#C62828;margin-top:8px;}

    .panel{background:#fff;border-radius:14px;padding:24px;box-shadow:0 4px 20px rgba(0,0,0,.08);overflow:auto;max-height:calc(100vh - 160px);}
    .panelTitle{font-size:18px;font-weight:900;margin-bottom:14px;}

    .filterBox{background:#fff;border-radius:14px;padding:16px;box-shadow:0 4px 16px rgba(0,0,0,.08);}
    .filterTitle{font-weight:900;color:#A3080B;margin-bottom:12px;font-size:14px;}
    .filterRows{display:flex;flex-direction:column;gap:12px;}
    .row{display:grid;grid-template-columns:64px 1fr;gap:12px;align-items:center;}
    .rowLabel{font-size:15px;font-weight:900;color:#444;white-space:nowrap;line-height:1;}
    .control{width:100%;height:44px;box-sizing:border-box;padding:0 14px;border:1px solid #E3E3E3;border-radius:10px;font-weight:900;background:#fff;outline:none;font-size:16px;line-height:44px;appearance:none;}
    .control:focus{border-color:#A3080B;box-shadow:0 0 0 3px rgba(163,8,11,.08);}
    input[type="date"].control{height:44px;line-height:44px;padding:0 14px;}
    select.control{height:44px;line-height:44px;}

    .btnRow{display:flex;gap:10px;margin-top:14px;}
    .btnSecondary{height:44px;border-radius:10px;border:1px solid #E3E3E3;cursor:pointer;font-weight:900;background:#fff;flex:1;font-size:14px;}

    table{width:100%;border-collapse:collapse;}
    th,td{padding:12px 10px;border-bottom:1px solid #eee;text-align:left;font-size:14px;vertical-align:top;white-space:nowrap;}
    th{font-weight:900;color:#444;background:#fafafa;position:sticky;top:0;z-index:1;}
    .dangerText{color:#C62828;font-weight:900;}
    .muted{color:#777;font-weight:900;}

    @media (max-width:980px){
      .grid{grid-template-columns:1fr;}
      .header{padding:16px 18px;font-size:18px;}
      .container{margin:22px auto;}
      .panel{max-height:none;}
      .logo{white-space:normal;}
    }
    @media (max-width:560px){
      .header{font-size:16px;}
      .todayText{font-size:12px;}
      .headerBtn{height:30px;padding:0 10px;font-size:12px;}
      .onlyDesktop{display:none;} .onlyMobile{display:inline;}
      .kpiGrid{grid-template-columns:1fr;}
      .kpiCard{padding:18px;}
      .kpiValue{font-size:34px;}
      .row{grid-template-columns:84px 1fr;}
      input[type="date"].control{height:36px;line-height:36px;}
      .panelTitle{font-size:14px;}
      table{table-layout:fixed;}
      th,td{font-size:11px;padding:6px 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      th:nth-child(1),td:nth-child(1){width:26%;}
      th:nth-child(2),td:nth-child(2){width:16%;}
      th:nth-child(3),td:nth-child(3){width:28%;}
      th:nth-child(4),td:nth-child(4){width:20%;}
      th:nth-child(5),td:nth-child(5){width:10%;text-align:right;}
      .panel{padding:14px;}
    }
  `;

  /** =========================
   *  D) 데이터 Fetch (취소+캐시+전환)
   *  - 기능/쿼리 규칙은 기존 유지
   * ========================= */
  const fetchData = useCallback(async (next) => {
    const { inputDate: d, region: r, category: c, effectiveStoreCode: sc } = next;

    // 캐시 키
    const key = JSON.stringify({
      d: d || "",
      r: r || "",
      c: c || "",
      sc: sc || "",
    });

    // ✅ 캐시 hit: 즉시 반영
    const cached = cacheRef.current.get(key);
    if (cached) {
      startTransition(() => {
        setSummary(cached.summary);
        setItems(cached.items);
      });
      return;
    }

    // ✅ 이전 요청 취소
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setLoading(true);

      const qs = new URLSearchParams();
      if (d) qs.set("input_date", d);
      if (r) qs.set("region", r);

      const qsItems = new URLSearchParams(qs.toString());

      // ✅ 기존 규칙 유지: region이 있으면 store_code를 보내지 않음
      if (!r && sc) qsItems.set("store_code", sc);

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

      // 캐시 저장
      cacheRef.current.set(key, { summary: nextSummary, items: nextItems });

      // 전환 업데이트
      startTransition(() => {
        setSummary(nextSummary);
        setItems(nextItems);
      });
    } catch (e) {
      if (e?.name === "AbortError") return; // 정상 케이스

      console.error("Dashboard fetch error:", e);
      startTransition(() => {
        setSummary([]);
        setItems([]);
      });
    } finally {
      // 마지막 요청만 로딩 종료
      if (abortRef.current === controller) {
        setLoading(false);
        abortRef.current = null;
      }
    }
  }, [startTransition]);

  // 필터 변화 시 조회
  useEffect(() => {
    fetchData({ inputDate, region, category, effectiveStoreCode });
  }, [inputDate, region, category, effectiveStoreCode, fetchData]);

  /** =========================
   *  E) 필터 옵션 생성
   * ========================= */
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

  /** =========================
   *  F) KPI (단계적 수정 구조)
   *  - 1) 값 정의: kpiData
   *  - 2) 화면 정의: KPI_DEFS
   * ========================= */
  const kpiData = useMemo(() => {
    const enteredStores = summary.filter((r) => r.is_entered === 1).length;
    const notEnteredStores = summary.filter((r) => r.is_entered === 0).length;
    const totalCnt = summary.length > 0 ? Number(summary[0]?.total_cnt ?? 0) : 0;
    const inputRows = items.length;

    return { enteredStores, notEnteredStores, totalCnt, inputRows };
  }, [summary, items]);

  // ✅ KPI 표시 항목은 여기만 수정하면 됨
  const KPI_DEFS = useMemo(
    () => [
      { key: "enteredStores", title: "입력매장수" },
      { key: "notEnteredStores", title: "미입력매장수" },
      { key: "totalCnt", title: "등록품목" },
      { key: "inputRows", title: "조회된 입력건수" },
    ],
    []
  );

  /** =========================
   *  G) 필터 초기화 (체감 개선: 즉시 fetch)
   * ========================= */
  const onResetFilters = () => {
    const d = ymdToday();
    const r = "";
    const sc = currentStoreCode || headerStoreCode || "";
    const c = "";

    setInputDate(d);
    setRegion(r);
    setStoreCode(sc);
    setCategory(c);

    // ✅ 즉시 조회(체감속도)
    fetchData({ inputDate: d, region: r, category: c, effectiveStoreCode: sc });
  };

  if (loading) return <div style={{ padding: 40 }}>로딩중...</div>;

  /** =========================
   *  I) 렌더링
   * ========================= */
  return (
    <div className="page">
      <style dangerouslySetInnerHTML={{ __html: styles }} />

      {/* Header */}
      <div className="header">
        <div className="headerInner">
          <div className="logo">KFC OPERATIONS - 유통기한 DASHBOARD</div>

          <div className="headerRight">
            <button
              className="headerBtn"
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
          {/* Left */}
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
                      const v = e.target.value;
                      setRegion(v);
                      setStoreCode(""); // 지역 바꿀 때 매장 필터 초기화(기존 유지)
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

          {/* Right */}
          <div className="panel">
            <div className="panelTitle">📋 자재별 유통기한 현황 (선택 날짜 기준 정렬)</div>

            <table>
              <thead>
                <tr>
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
                      <td>{r.store_name}</td>
                      <td>{r.category}</td>
                      <td>{r.item_name}</td>

                      <td className="dangerText">
                        <span className="onlyDesktop">{toYMD(r.expiry_date)}</span>
                        <span className="onlyMobile">{toYMDShort(r.expiry_date)}</span>
                      </td>

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

/** =========================
 *  3) KPI 컴포넌트
 * ========================= */
function Kpi({ title, value }) {
  const safe = Number.isFinite(Number(value)) ? value : 0;
  return (
    <div className="kpiCard">
      <div className="kpiTitle">{title}</div>
      <div className="kpiValue">{safe}</div>
    </div>
  );
}