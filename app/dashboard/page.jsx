"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";

const API_BASE = "https://inventory-api-231876330057.asia-northeast3.run.app";

function ymdToday() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
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

// 모바일용: YY-MM-DD (어떤 형태로 와도 최대한 표시)
function toYMDShort(v) {
  if (!v) return "";

  const raw = String(v);

  // 1) 가장 확실: YYYY-MM-DD 추출
  const m = raw.match(/\d{4}-\d{2}-\d{2}/);
  if (m) return m[0].slice(2); // "2026-01-18" -> "26-01-18"

  // 2) ISO/영문 등 Date 파싱 가능한 경우
  const d = new Date(raw);
  if (!isNaN(d.getTime())) {
    const yy = String(d.getFullYear()).slice(2);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  }

  // 3) 최후 fallback: 뭐라도 표시
  return raw.slice(0, 10);
}


export default function DashboardPage() {
  const [summary, setSummary] = useState([]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [inputDate, setInputDate] = useState(ymdToday());
  const [region, setRegion] = useState("");
  const [storeCode, setStoreCode] = useState("");
  const [category, setCategory] = useState("");
  const currentStoreCode = searchParams.get("store_code") || "";
  const currentStoreName = searchParams.get("store_name") || "";

  const styles = `
    .page{
      min-height:100vh;
      background:linear-gradient(135deg,#FFF1E2 0%,#F5D4B7 100%);
    }

    .header{
      background:linear-gradient(90deg,#A3080B 0%,#DC001B 100%);
      padding:18px 28px;
      color:#fff;
      font-size:22px;
      font-weight:900;
    }

    /* ✅ 헤더 반응형을 위해 inner로 분리 */
    .headerInner{
      display:flex;
      justify-content:space-between;
      align-items:center;
      gap:12px;
    }

    .logo{
      letter-spacing:1px;
      white-space:nowrap;
    }

    .headerRight{
      display:flex;
      align-items:center;
      gap:10px;
      white-space:nowrap;
    }

    /* ✅ 입력하기 게이트 버튼 */
    .headerBtn{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      height:34px;
      padding:0 12px;
      border-radius:10px;
      background:rgba(255,255,255,0.18);
      border:1px solid rgba(255,255,255,0.35);
      color:#fff;
      font-weight:900;
      font-size:13px;
      text-decoration:none;
      white-space:nowrap;
      cursor:pointer;
    }
    .headerBtn:hover{
      background:rgba(255,255,255,0.28);
    }

    .todayText{
      font-size:14px;
      font-weight:900;
      opacity:.95;
      white-space:nowrap;
    }

    /* ✅ PC 기본 */
    .onlyDesktop{ display:inline; }
    .onlyMobile{ display:none; }

    .container{
      max-width:1400px;
      margin:30px auto;
      padding:0 20px;
    }

    .grid{
      display:grid;
      grid-template-columns:420px 1fr;
      gap:26px;
      align-items:start;
    }

    .leftCol{ display:flex; flex-direction:column; gap:14px; }

    .kpiGrid{
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:16px;
    }

    .kpiCard{
      background:#fff;
      border-radius:14px;
      padding:22px;
      box-shadow:0 4px 16px rgba(0,0,0,.08);
      text-align:center;
    }
    .kpiTitle{ font-size:14px; font-weight:800; color:#666; }
    .kpiValue{ font-size:38px; font-weight:900; color:#C62828; margin-top:8px; }

    .panel{
      background:#fff;
      border-radius:14px;
      padding:24px;
      box-shadow:0 4px 20px rgba(0,0,0,.08);
      overflow:auto;
      max-height: calc(100vh - 160px);
    }
    .panelTitle{ font-size:18px; font-weight:900; margin-bottom:14px; }

    /* Filter Box */
    .filterBox{
      background:#fff;
      border-radius:14px;
      padding:16px;
      box-shadow:0 4px 16px rgba(0,0,0,.08);
    }

    .filterTitle{
      font-weight:900;
      color:#A3080B;
      margin-bottom:12px;
      font-size:14px;
    }

    .filterRows{
      display:flex;
      flex-direction:column;
      gap:12px;
    }

    .row{
      display:grid;
      grid-template-columns: 64px 1fr;
      gap:12px;
      align-items:center;
    }

    .rowLabel{
      font-size:15px;
      font-weight:900;
      color:#444;
      white-space:nowrap;
      line-height:1;
    }

    .control{
      width:100%;
      height:44px;
      box-sizing:border-box;
      padding:0 14px;
      border:1px solid #E3E3E3;
      border-radius:10px;
      font-weight:900;
      background:#fff;
      outline:none;
      font-size:16px;
      line-height:44px;
      appearance:none;
    }

    .control:focus{
      border-color:#A3080B;
      box-shadow:0 0 0 3px rgba(163,8,11,.08);
    }

    input[type="date"].control{
      height:44px;
      line-height:44px;
      padding:0 14px;
    }

    select.control{
      height:44px;
      line-height:44px;
    }

    .btnRow{
      display:flex;
      gap:10px;
      margin-top:14px;
    }

    .btnSecondary{
      height:44px;
      border-radius:10px;
      border:1px solid #E3E3E3;
      cursor:pointer;
      font-weight:900;
      background:#fff;
      flex:1;
      font-size:14px;
    }

    table{
      width:100%;
      border-collapse:collapse;
    }
    th, td{
      padding:12px 10px;
      border-bottom:1px solid #eee;
      text-align:left;
      font-size:14px;
      vertical-align:top;
      white-space:nowrap;
    }
    th{ font-weight:900; color:#444; background:#fafafa; position:sticky; top:0; z-index:1; }

    .dangerText{ color:#C62828; font-weight:900; }
    .muted{ color:#777; font-weight:900; }

    @media (max-width: 980px){
      .grid{ grid-template-columns:1fr; }
      .header{ padding:16px 18px; font-size:18px; }
      .container{ margin:22px auto; }
      .panel{ max-height:none; }

      /* ✅ 태블릿 이하에서 헤더 줄바꿈 허용 */
      .logo{ white-space:normal; }
    }

    @media (max-width: 560px){
    /* ✅ 모바일에서 헤더 글자/버튼도 같이 줄임 */
    .header{ font-size:16px; }
    .todayText{ font-size:12px; }
    .headerBtn{ height:30px; padding:0 10px; font-size:12px; }

    /* ✅ 날짜 표시 전환 */
    .onlyDesktop{ display:none; }
    .onlyMobile{ display:inline; }

    .kpiGrid{ grid-template-columns:1fr; }
    .kpiCard{ padding:18px; }
    .kpiValue{ font-size:34px; }
    .row{ grid-template-columns:84px 1fr; }
    input[type="date"].control{ height:36px; line-height:36px; }

    .panelTitle{ font-size:14px; }

    table{ table-layout: fixed; }

    th, td{
        font-size:11px;
        padding:6px 6px;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
    }

    th:nth-child(1), td:nth-child(1){ width:26%; }
    th:nth-child(2), td:nth-child(2){ width:16%; }
    th:nth-child(3), td:nth-child(3){ width:28%; }
    th:nth-child(4), td:nth-child(4){ width:20%; }
    th:nth-child(5), td:nth-child(5){ width:10%; text-align:right; }

    .panel{ padding:14px; }
    
}
  `;

  // Fetch
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const qs = new URLSearchParams();
        if (inputDate) qs.set("input_date", inputDate);
        if (region) qs.set("region", region);

        const qsItems = new URLSearchParams(qs.toString());
        if (storeCode) qsItems.set("store_code", storeCode);
        if (category) qsItems.set("category", category);

        const [sRes, iRes] = await Promise.all([
          fetch(`${API_BASE}/api/dashboard/summary?${qs.toString()}`),
          fetch(`${API_BASE}/api/dashboard/items?${qsItems.toString()}`),
        ]);

        const sJson = await sRes.json();
        const iJson = await iRes.json();

        setSummary(sJson.rows || []);
        setItems(iJson.rows || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [inputDate, region, storeCode, category]);

  // Options
  const regionOptions = useMemo(() => {
    const set = new Set(summary.map((r) => r.region_name).filter(Boolean));
    return Array.from(set).sort((a, b) => String(a).localeCompare(String(b), "ko"));
  }, [summary]);

  const storeOptions = useMemo(() => {
    const rows = region ? summary.filter((r) => r.region_name === region) : summary;
    const map = new Map();
    for (const r of rows) {
      if (r.store_code) map.set(r.store_code, { store_code: r.store_code, store_name: r.store_name });
    }
    return Array.from(map.values()).sort((a, b) =>
      String(a.store_code).localeCompare(String(b.store_code))
    );
  }, [summary, region]);

  const categoryOptions = useMemo(() => {
    const set = new Set(items.map((r) => r.category).filter(Boolean));
    return Array.from(set).sort((a, b) => String(a).localeCompare(String(b), "ko"));
  }, [items]);

  useEffect(() => {
    setStoreCode("");
  }, [region]);

  // KPI (정의 확정)
  const kpi = useMemo(() => {
    const enteredStores = summary.filter((r) => r.is_entered === 1).length;
    const notEnteredStores = summary.filter((r) => r.is_entered === 0).length;

    const totalCnt = summary.length > 0 ? Number(summary[0]?.total_cnt ?? 0) : 0;

    const inputRows = items.length;

    return { enteredStores, notEnteredStores, totalCnt, inputRows };
  }, [summary, items]);

  const onResetFilters = () => {
    setInputDate(ymdToday());
    setRegion("");
    setStoreCode("");
    setCategory("");
  };

  if (loading) return <div style={{ padding: 40 }}>로딩중...</div>;

  return (
    <div className="page">
      <style dangerouslySetInnerHTML={{ __html: styles }} />

    <div className="header">
    <div className="headerInner">
        <div className="logo">KFC OPERATIONS - 유통기한 DASHBOARD</div>

        <div className="headerRight">
        {/* ✅ 입력하기를 날짜보다 왼쪽에 두고, 클릭 시 localhost:3000 으로 이동 */}
          <button
            className="headerBtn"
            type="button"
            onClick={() => {
              const qs = new URLSearchParams();

              if (currentStoreCode) qs.set("store_code", currentStoreCode);
              if (currentStoreName) qs.set("store_name", currentStoreName);

              const q = qs.toString();
              router.push(q ? `/?${q}` : `/`);
            }}
          >
            입력하기
          </button>

        <div className="todayText">{ymdToday()}</div>
        </div>
    </div>
    </div>

      <div className="container">
        <div className="grid">
          {/* Left */}
          <div className="leftCol">
            {/* KPI */}
            <div className="kpiGrid">
              <Kpi title="입력매장수" value={kpi.enteredStores} />
              <Kpi title="미입력매장수" value={kpi.notEnteredStores} />
              <Kpi title="등록품목" value={kpi.totalCnt} />
              <Kpi title="조회된 입력건수" value={kpi.inputRows} />
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
                  <select className="control" value={region} onChange={(e) => setRegion(e.target.value)}>
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
                  <select className="control" value={category} onChange={(e) => setCategory(e.target.value)}>
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

          {/* Right Panel */}
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

                      {/* ✅ PC: YYYY-MM-DD(요일) / 모바일: YY-MM-DD */}
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

function Kpi({ title, value }) {
  const safe = Number.isFinite(Number(value)) ? value : 0;
  return (
    <div className="kpiCard">
      <div className="kpiTitle">{title}</div>
      <div className="kpiValue">{safe}</div>
    </div>
  );
}
