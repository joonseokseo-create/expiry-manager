"use client";

import React, {
  Suspense,
  useMemo,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";

// Static Export/Prerender 시도 막기
export const dynamic = "force-dynamic";

/* =========================================================
 *  1) Date Utils
 * ========================================================= */
function parseYMD(ymd) {
  const s = String(ymd || "").slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return new Date();
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return new Date(y, mo - 1, d);
}

// =======================
// Picker Style Constants
// =======================
const arrowBtnStyle = {
  border: "none",
  background: "transparent",
  fontSize: 26,
  fontWeight: 900,
  cursor: "pointer",
  lineHeight: 1,
  color: "#555",
};

const numberAreaStyle = {
  height: 120,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  cursor: "ns-resize",
};


/* =========================================================
 *  3) NumberPicker (Wheel UI)  ✅ DateWheelPicker보다 먼저 선언
 * ========================================================= */
function NumberPicker({ value, min, max, onChange }) {
  const ref = React.useRef(null);

  // ✅ 직접입력 모드
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(String(value));

  React.useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  const clamp = React.useCallback(
    (v) => Math.min(max, Math.max(min, v)),
    [min, max]
  );

  const commit = React.useCallback(() => {
    const n = Number(draft);
    if (!Number.isFinite(n)) {
      setDraft(String(value));
      setEditing(false);
      return;
    }
    onChange(clamp(Math.trunc(n)));
    setEditing(false);
  }, [draft, onChange, clamp, value]);

  const cancel = React.useCallback(() => {
    setDraft(String(value));
    setEditing(false);
  }, [value]);

  const move = React.useCallback(
    (delta) => onChange(clamp(value + delta)),
    [value, onChange, clamp]
  );

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onWheel = (e) => {
      if (editing) return;
      e.preventDefault();
      move(e.deltaY > 0 ? 1 : -1);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [move, editing]);

  const up = value + 1 <= max ? value + 1 : "";
  const down = value - 1 >= min ? value - 1 : "";

  return (
    <div
      ref={ref}
      tabIndex={0}
      onKeyDown={(e) => {
        if (editing) return;
        if (e.key === "ArrowUp") move(1);
        if (e.key === "ArrowDown") move(-1);
      }}
      style={{
        width: 120,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        userSelect: "none",
        outline: "none",
      }}
    >
      <button type="button" onClick={() => move(1)} style={arrowBtnStyle}>
        ▲
      </button>

      <div style={numberAreaStyle}>
        <div style={{ opacity: 0.25, height: 24 }}>{up}</div>

        {/* ✅ 중앙 큰 숫자: 클릭하면 직접입력 */}
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            style={{
              border: "none",
              background: "transparent",
              padding: 0,
              cursor: "text",
              fontSize: 38,
              fontWeight: 900,
              color: "#A3080B",
            }}
            title="클릭해서 직접 입력"
          >
            {value}
          </button>
        ) : (
          <input
            autoFocus
            inputMode="numeric"
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ""))}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") cancel();
            }}
            style={{
              width: 96,
              textAlign: "center",
              fontSize: 34,
              fontWeight: 900,
              color: "#A3080B",
              border: "2px solid #E0E0E0",
              borderRadius: 10,
              padding: "6px 8px",
              outline: "none",
            }}
          />
        )}

        <div style={{ opacity: 0.25, height: 24 }}>{down}</div>
      </div>

      <button type="button" onClick={() => move(-1)} style={arrowBtnStyle}>
        ▼
      </button>
    </div>
  );
}

/* =========================================================
 *  2) DateWheelPicker (Modal 내부 날짜 선택)
 *  ✅ +7/+30 클릭 오류(무한루프) 방지 버전
 * ========================================================= */
function DateWheelPicker({ value, onChange }) {
  // value를 항상 YYYY-MM-DD로 정규화
  const norm = React.useCallback(
    (v) => String(v || "").slice(0, 10),
    []
  );

  // 마지막으로 "처리한" value 추적 (루프 차단 핵심)
  const lastValueRef = React.useRef(norm(value));

  const initDate = React.useMemo(() => parseYMD(value), [value]);

  const [year, setYear] = React.useState(() => initDate.getFullYear());
  const [month, setMonth] = React.useState(() => initDate.getMonth() + 1);
  const [day, setDay] = React.useState(() => initDate.getDate());

  // 1) 외부 value가 바뀌면 내부 상태 동기화
  React.useEffect(() => {
    const v = norm(value);
    if (!v) return;

    // 이미 같은 value면 동작 안함
    if (v === lastValueRef.current) return;

    lastValueRef.current = v;

    const d = parseYMD(v);
    const ny = d.getFullYear();
    const nm = d.getMonth() + 1;
    const nd = d.getDate();

    setYear((prev) => (prev === ny ? prev : ny));
    setMonth((prev) => (prev === nm ? prev : nm));
    setDay((prev) => (prev === nd ? prev : nd));
  }, [value, norm]);

  const maxDay = React.useMemo(
    () => new Date(year, month, 0).getDate(),
    [year, month]
  );

  // 2) day clamp (필요할 때만 set)
  React.useEffect(() => {
    if (day > maxDay) setDay(maxDay);
    else if (day < 1) setDay(1);
  }, [day, maxDay]);

  // 3) 내부 year/month/day 변경 → 부모 value 업데이트 (단, lastValueRef로 루프 차단)
  React.useEffect(() => {
    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    const next = `${year}-${mm}-${dd}`;

    // 이미 마지막 처리 값이면 onChange 호출 금지
    if (next === lastValueRef.current) return;

    lastValueRef.current = next;
    onChange(next);
  }, [year, month, day, onChange]);

  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 28 }}>
      <NumberPicker value={year} min={2026} max={2035} onChange={setYear} />
      <NumberPicker value={month} min={1} max={12} onChange={setMonth} />
      <NumberPicker value={day} min={1} max={maxDay} onChange={setDay} />
    </div>
  );
}


/* =========================================================
 *  4) Category config
 * ========================================================= */
const CATEGORY_ICON_MAP = {
  워크인: "🍗",
  냉동: "❄️",
  냉장: "🧊",
  "소스류/빽": "🥫",
  파우더: "📦",
  카운터: "🖥",
  "시럽/상품음료": "🥤",
  화학세제: "🧪",
  기타: "🔍",
};

const CATEGORY_ORDER = [
  "워크인",
  "냉동",
  "냉장",
  "소스류/빽",
  "파우더",
  "카운터",
  "시럽/상품음료",
  "화학세제",
  "기타",
];

/* =========================================================
 *  5) Page Wrapper (Suspense)
 * ========================================================= */
export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 40 }}>로딩중...</div>}>
      <PageClient />
    </Suspense>
  );
}

/* =========================================================
 *  6) Main Component
 * ========================================================= */
function PageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // searchParams 값은 변수로 빼서 effect 의존성 안정화
  const urlStoreCode = (searchParams.get("store_code") || "").trim();
  const urlStoreName = (searchParams.get("store_name") || "").trim();

  /* ---------------------------
   *  스타일 (문자열 CSS)
   * --------------------------- */
    const styles = useMemo(
      () => `
    /* =========================
      0) 기본 Reset / Body
      ========================= */
    *{
      margin:0;
      padding:0;
      box-sizing:border-box;
      font-family:"Pretendard", system-ui, -apple-system, BlinkMacSystemFont;
    }
    body{
      background:linear-gradient(135deg,#FFF1E2 0%,#F5D4B7 100%);
      min-height:100vh;
    }

    /* =========================
      1) Header
      ========================= */
    .header{
      background:linear-gradient(90deg,#A3080B 0%,#DC001B 100%);
      padding:20px 0;
      box-shadow:0 4px 12px rgba(163,8,11,.3);
    }
    .header-content{
      max-width:1200px;
      margin:0 auto;
      display:flex;
      align-items:center;
      justify-content:space-between;
      padding:0 30px;
      gap:12px;
    }
    .logo{
      font-size:32px;
      font-weight:900;
      color:#fff;
      letter-spacing:2px;
      text-shadow:2px 2px 4px rgba(0,0,0,.3);
    }
    .user-info{
      color:#FFF1E2;
      font-size:18px;
      font-weight:900;
      white-space:nowrap;
    }

    /* =========================
      2) Layout Container / Box
      ========================= */
    .container{
      max-width:1200px;
      margin:40px auto;
      padding:0 20px;
    }
    .login-box,
    .main-content{
      background:#fff;
      border-radius:15px;
      box-shadow:0 8px 32px rgba(0,0,0,.1);
      padding:40px;
      margin-bottom:30px;
    }
    .login-box{
      max-width:450px;
      margin:100px auto;
    }

    /* =========================
      3) Login Text
      ========================= */
    .login-title{
      text-align:center;
      color:#A3080B;
      font-size:28px;
      font-weight:900;
      margin-bottom:10px;
    }
    .login-subtitle{
      text-align:center;
      color:#666;
      margin-bottom:30px;
    }

    /* =========================
      4) Form / Inputs
      ========================= */
    .form-group{ margin-bottom:20px; }
    .form-label{
      display:block;
      color:#333;
      font-weight:700;
      margin-bottom:8px;
      font-size:14px;
    }
    .form-input{
      width:100%;
      padding:14px 18px;
      border:2px solid #E0E0E0;
      border-radius:8px;
      font-size:15px;
      transition:all .3s;
      background:#fff;
    }
    .form-input:focus{
      outline:none;
      border-color:#A3080B;
      box-shadow:0 0 0 3px rgba(163,8,11,.1);
    }

    /* =========================
      5) Buttons
      ========================= */
    /* 기본 빨간 버튼 (저장/결과조회/시작하기 등) */
    .btn-primary{
      width:100%;
      padding:16px;
      margin-top:10px;
      background:linear-gradient(90deg,#A3080B 0%,#DC001B 100%);
      color:#fff;
      border:none;
      border-radius:8px;
      font-size:16px;
      font-weight:800;
      cursor:pointer;
      transition:all .2s;
      text-transform:uppercase;
      letter-spacing:1px;
    }
    .btn-primary:hover{
      transform:translateY(-2px);
      box-shadow:0 6px 20px rgba(163,8,11,.35);
    }
    .btn-primary:disabled{
      opacity:.6;
      cursor:not-allowed;
      transform:none;
      box-shadow:none;
    }

    /* 로그아웃 버튼 (노란색) */
    .btn-logout{
      height:36px;
      padding:0 14px;
      border:none;
      border-radius:10px;
      background:#FFD400;
      color:#111;
      font-weight:900;
      cursor:pointer;
      box-shadow:0 3px 10px rgba(0,0,0,.12);
    }
    .btn-logout:hover{ filter:brightness(.95); }
    .btn-logout:active{ transform:translateY(1px); }

    /* =========================
      6) Category / Items
      ========================= */
    .category-section{
      background:#FFF1E2;
      border-left:5px solid #A3080B;
      padding:25px;
      margin-bottom:25px;
      border-radius:10px;
    }
    .category-title{
      color:#A3080B;
      font-size:22px;
      font-weight:900;
      margin-bottom:20px;
      display:flex;
      align-items:center;
    }
    .category-icon{
      width:30px;
      height:30px;
      background:#A3080B;
      color:#fff;
      border-radius:50%;
      display:flex;
      align-items:center;
      justify-content:center;
      margin-right:12px;
      flex:0 0 30px;
    }
    .item-row{
      background:#fff;
      padding:20px;
      margin-bottom:12px;
      border-radius:12px;
      display:grid;
      grid-template-columns:2fr 3fr 1.5fr;
      gap:20px;
      align-items:center;
      box-shadow:0 2px 8px rgba(0,0,0,.05);
    }
    .item-name{
      font-weight:800;
      color:#333;
    }
    .date-btn{
      width:100%;
      padding:14px 14px;
      border:2px solid #E0E0E0;
      border-radius:10px;
      background:#FAFAFA;
      font-weight:800;
      cursor:pointer;
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:10px;
      font-size:15px;
    }
    .date-btn:active{ transform:scale(.995); }
    .date-btn .hint{ color:#666; font-weight:800; }
    .date-btn .value{ color:#111; font-weight:900; }

    /* =========================
      7) Status Badge
      ========================= */
    .status-badge{
      padding:8px 12px;
      border-radius:20px;
      font-size:12px;
      font-weight:900;
      text-align:center;
      text-transform:uppercase;
      letter-spacing:.5px;
    }
    .status-ok{ background:#4CAF50; color:#fff; }
    .status-warning{ background:#FFC107; color:#333; }
    .status-danger{ background:#F44336; color:#fff; }

    /* =========================
      8) Save Area (Bottom Sticky)
      ========================= */
    .save-section{
      position:sticky;
      bottom:20px;
      background:#fff;
      padding:20px;
      border-radius:12px;
      box-shadow:0 -4px 20px rgba(0,0,0,.1);
      text-align:center;
    }

    /* =========================
      9) Alerts
      ========================= */
    .alert{
      padding:12px 16px;
      border-radius:8px;
      margin-bottom:20px;
      font-weight:700;
    }
    .alert-error{ background:#FFEBEE; color:#C62828; }
    .alert-success{ background:#E8F5E9; color:#2E7D32; }

    /* =========================
      10) Modal
      ========================= */
    .modal-backdrop{
      position:fixed;
      inset:0;
      background:rgba(0,0,0,.55);
      display:flex;
      align-items:flex-end;
      justify-content:center;
      padding:16px;
      z-index:9999;
    }
    .modal{
      width:100%;
      max-width:520px;
      background:#fff;
      border-radius:16px;
      overflow:hidden;
      box-shadow:0 12px 40px rgba(0,0,0,.25);
    }
    .modal-header{
      display:flex;
      align-items:center;
      justify-content:space-between;
      padding:14px 16px;
      background:#FFF1E2;
      border-bottom:1px solid #f0e0d1;
    }
    .modal-title{
      font-weight:900;
      color:#A3080B;
    }
    .modal-close{
      border:none;
      background:transparent;
      font-size:22px;
      cursor:pointer;
      font-weight:900;
      color:#A3080B;
    }
    .modal-body{ padding:16px; }
    .quick-actions{
      display:flex;
      gap:10px;
      margin-bottom:12px;
    }
    .quick-actions button{
      flex:1;
      padding:12px 10px;
      border-radius:10px;
      border:2px solid #E0E0E0;
      background:#fff;
      font-weight:900;
      cursor:pointer;
    }
    .quick-actions button:hover{ border-color:#A3080B; }
    .modal-footer{
      padding:14px 16px;
      border-top:1px solid #f2f2f2;
      display:flex;
      gap:10px;
    }
    .btn-secondary{
      flex:1;
      padding:14px 12px;
      border-radius:10px;
      border:2px solid #E0E0E0;
      background:#fff;
      font-weight:900;
      cursor:pointer;
    }
    .btn-confirm{
      flex:2;
      padding:14px 12px;
      border-radius:10px;
      border:none;
      background:linear-gradient(90deg,#A3080B 0%,#DC001B 100%);
      color:#fff;
      font-weight:900;
      cursor:pointer;
    }

    /* =========================
      11) Responsive (Tablet)
      ========================= */
    @media (max-width:768px){
      .header-content{ padding:0 16px; }
      .logo{ font-size:15px; letter-spacing:.5px; }
      .user-info{ font-size:11px; }

      .login-box{ margin:60px auto; padding:24px; }
      .main-content{ padding:20px; }

      .category-title{ font-size:16px; }
      .category-section{ padding:16px; }

      .item-row{ grid-template-columns:1fr; gap:10px; padding:16px; }
      .item-name{ font-size:14px; line-height:1.25; }

      .date-btn{ font-size:13px; padding:16px 14px; border-radius:12px; }

      .status-badge{
        font-size:11px;
        padding:6px 10px;
        justify-self:start;
        width:fit-content;
      }

      .modal-title{ font-size:15px; }
      .quick-actions button{ font-size:13px; padding:10px 6px; }
    }

    /* =========================
      12) Responsive (Mobile: Logout Button)
      ========================= */
    @media (max-width:560px){
      .btn-logout{
        height:28px;
        padding:0 10px;
        font-size:12px;
        border-radius:8px;
      }
    }
    `,
      []
    );

  const API_BASE = "https://inventory-api-231876330057.asia-northeast3.run.app";

  /* ---------------------------
   *  로그인 상태
   * --------------------------- */
  const [storeCode, setStoreCode] = useState("");
  const [storeName, setStoreName] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  /* =========================================================
   *  6-A) localStorage 기반 로그인 복원 (새로고침 유지)
   * ========================================================= */
  useEffect(() => {
    try {
      const saved = localStorage.getItem("kfc_store_info");
      if (!saved) return;

      const info = JSON.parse(saved);
      if (!info?.loggedIn || !info?.storeCode) return;

      // 세션 만료 체크 (24시간)
      const ts = info.timestamp ? new Date(info.timestamp).getTime() : Date.now();
      const ageMs = Date.now() - ts;
      if (ageMs > 24 * 60 * 60 * 1000) {
        localStorage.removeItem("kfc_store_info");
        return;
      }

      if (/^1410\d{3}$/.test(info.storeCode)) {
        setStoreCode(info.storeCode);
        setStoreName(info.storeName || "");
        setLoggedIn(true);
      }
    } catch (err) {
      console.error("로그인 정보 복원 실패:", err);
    }
  }, []);

  /* =========================================================
   *  6-B) URL 파라미터가 있으면 우선 적용 + localStorage 갱신
   * ========================================================= */
  useEffect(() => {
    if (!urlStoreCode || !/^1410\d{3}$/.test(urlStoreCode)) return;

    localStorage.setItem(
      "kfc_store_info",
      JSON.stringify({
        storeCode: urlStoreCode,
        storeName: urlStoreName,
        loggedIn: true,
        timestamp: new Date().toISOString(),
      })
    );

    setStoreCode(urlStoreCode);
    setStoreName(urlStoreName);
    setLoggedIn(true);
    setError("");
    setSuccess("");
  }, [urlStoreCode, urlStoreName]);

  /* =========================================================
   *  6-C) loggedIn인데 URL에 파라미터 없으면 주입 (URL 유지)
   * ========================================================= */
  useEffect(() => {
    if (!loggedIn) return;
    if (urlStoreCode && /^1410\d{3}$/.test(urlStoreCode)) return;

    const code = storeCode.trim();
    const name = storeName.trim();
    if (!/^1410\d{3}$/.test(code) || !name) return;

    const q = new URLSearchParams();
    q.set("store_code", code);
    q.set("store_name", name);

    router.replace(`/?${q.toString()}`);
  }, [loggedIn, storeCode, storeName, urlStoreCode, router]);

  /* ---------------------------
   *  카테고리/입력값 상태
   * --------------------------- */
  const [categories, setCategories] = useState(null);
  const [dates, setDates] = useState({});
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [catError, setCatError] = useState("");

  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [searchText, setSearchText] = useState("");

  /* ---------------------------
   *  날짜 선택 모달 상태
   * --------------------------- */
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeKey, setActiveKey] = useState("");
  const [activeLabel, setActiveLabel] = useState("");
  const [draftDate, setDraftDate] = useState("");

  const todayText = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const storageKey = useMemo(() => {
    const code = storeCode.trim();
    return code ? `expiry_dates_${code}` : "";
  }, [storeCode]);

  /* =========================================================
   *  카테고리 로드
   * ========================================================= */
  useEffect(() => {
    const cacheKey = "categories_cache_v1";

    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) setCategories(parsed);
      }
    } catch {}

    setLoadingCategories(true);
    fetch(`${API_BASE}/categories`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        const cats = data.categories || [];
        setCategories(cats);
        try {
          localStorage.setItem(cacheKey, JSON.stringify(cats));
        } catch {}
        setCatError("");
      })
      .catch((err) => {
        console.error("카테고리 호출 실패:", err);
        setCatError("카테고리 로딩 실패");
        setCategories((prev) => prev || []);
      })
      .finally(() => setLoadingCategories(false));
  }, []);

  /* =========================================================
   *  dates 로컬스토리지 로드/저장
   * ========================================================= */
  useEffect(() => {
    if (!loggedIn || !storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        setDates(parsed.dates || {});
      }
    } catch (e) {
      console.error("dates 로드 실패:", e);
    }
  }, [loggedIn, storageKey]);

  useEffect(() => {
    if (!loggedIn || !storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ dates }));
    } catch (e) {
      console.error("dates 저장 실패:", e);
    }
  }, [dates, loggedIn, storageKey]);

  /* =========================================================
   *  필터링된 카테고리 계산
   * ========================================================= */
  const filteredCategories = useMemo(() => {
    if (!categories) return [];

    const filtered = categories
      .filter((cat) => selectedCategory === "ALL" || cat.category === selectedCategory)
      .map((cat) => ({
        ...cat,
        items: (cat.items || []).filter((item) =>
          String(item).toLowerCase().includes(searchText.toLowerCase())
        ),
      }))
      .filter((cat) => (cat.items || []).length > 0);

    filtered.sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a.category);
      const bi = CATEGORY_ORDER.indexOf(b.category);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });

    return filtered;
  }, [categories, selectedCategory, searchText]);

  /* =========================================================
   *  로그인 핸들러
   * ========================================================= */
  function onLogin(e) {
    e.preventDefault();

    const code = storeCode.trim();
    const name = storeName.trim();

    if (!/^1410\d{3}$/.test(code)) {
      setError("매장코드는 1410으로 시작하는 7자리 숫자만 가능합니다. (예: 1410760)");
      setSuccess("");
      return;
    }
    if (!name) {
      setError("매장명을 입력해주세요.");
      setSuccess("");
      return;
    }

    localStorage.setItem(
      "kfc_store_info",
      JSON.stringify({
        storeCode: code,
        storeName: name,
        loggedIn: true,
        timestamp: new Date().toISOString(),
      })
    );

    setError("");
    setSuccess("로그인 성공");
    setLoggedIn(true);

    // URL도 같이 유지
    const q = new URLSearchParams();
    q.set("store_code", code);
    q.set("store_name", name);
    router.replace(`/?${q.toString()}`);
  }

  /* =========================================================
   *  상태 텍스트(남은일수)
   * ========================================================= */
  function updateStatusText(dateStr) {
    if (!dateStr) return { text: "입력 필요", cls: "status-ok" };

    const expiry = parseYMD(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diff = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
    if (diff < 0) return { text: "기한 만료", cls: "status-danger" };
    if (diff <= 7) return { text: `${diff}일 남음`, cls: "status-warning" };
    return { text: `${diff}일 남음`, cls: "status-ok" };
  }

  /* =========================================================
   *  날짜 유틸(+N일)
   * ========================================================= */
  const addDays = useCallback(
    (base, days) => {
      const d = parseYMD(base || todayText);
      d.setDate(d.getDate() + days);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${dd}`;
    },
    [todayText]
  );

  /* =========================================================
   *  모달 open/close/confirm
   * ========================================================= */
  const openPicker = useCallback(
    (key, label) => {
      const current = dates[key] || "";
      const initial = current || todayText;

      setActiveKey(key);
      setActiveLabel(label);
      setDraftDate(initial);
      setPickerOpen(true);
    },
    [dates, todayText]
  );

  const closePicker = useCallback(() => {
    setPickerOpen(false);
    setActiveKey("");
    setActiveLabel("");
    setDraftDate("");
  }, []);

  const confirmPicker = useCallback(() => {
    if (!activeKey) return;
    const picked = (draftDate || "").slice(0, 10);
    setDates((prev) => ({ ...prev, [activeKey]: picked }));
    closePicker();
  }, [activeKey, draftDate, closePicker]);

    /* =========================================================
    *  저장(서버 bulk 저장)
    * ========================================================= */
    const onSave = useCallback(async () => {
      try {
        setError("");
        setSuccess("");

        const store_code = storeCode.trim();
        if (!store_code) {
          setError("매장코드가 없습니다.");
          return;
        }

        const rawEntries = Object.entries(dates)
          .filter(([_, v]) => Boolean(v))
          .map(([k, v]) => {
            const key = String(k);
            const sep = key.indexOf("__");
            if (sep < 0) return null;

            const category = key.slice(0, sep).trim();
            const item_name = key.slice(sep + 2).trim();
            const expiry_date = String(v).slice(0, 10);

            if (!category || !item_name || !expiry_date) return null;
            return { category, item_name, expiry_date };
          })
          .filter(Boolean);

        if (rawEntries.length === 0) {
          setError("저장할 항목이 없습니다. 유효기간을 먼저 입력해주세요.");
          return;
        }

        // item_name 기준 dedupe
        const uniqMap = new Map();
        for (const e of rawEntries) {
          const dedupeKey = `${e.item_name}`;
          uniqMap.set(dedupeKey, e);
        }
        const entries = Array.from(uniqMap.values());

        setSaving(true);
        const res = await fetch(`${API_BASE}/api/expiry-entries/bulk`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            store_code,
            input_date: todayText,
            entries,
          }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data.ok) {
          setError(data?.error || "저장에 실패했습니다.");
          return;
        }

        setSuccess(`저장 완료 (${data.count}건)`);
        setTimeout(() => setSuccess(""), 1500);
      } catch (e) {
        setError(e?.message || "저장 중 오류가 발생했습니다.");
      } finally {
        setSaving(false);
      }
    }, [dates, storeCode, todayText]);

  /* =========================================================
   *  Render
   * ========================================================= */
  return (
    <main>
      <style dangerouslySetInnerHTML={{ __html: styles }} />

      {/* Header */}
      <div className="header">
        <div className="header-content">
          <div className="logo">KFC OPERATIONS - 자재유통기한 관리</div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="user-info">
              {loggedIn
                ? `${todayText} | ${storeCode.trim()} | ${storeName.trim()}`
                : ""}
            </div>

            {loggedIn && (
              <button
                type="button"
                className="btn-logout"
                onClick={() => {
                  // 1) 로그인 정보 삭제
                  localStorage.removeItem("kfc_store_info");

                  // 2) 로그인 상태 초기화
                  setLoggedIn(false);
                  setStoreCode("");
                  setStoreName("");

                  // 3) 최초 화면으로 이동 (URL 파라미터 제거)
                  router.replace("/");
                }}
              >
                로그아웃
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Login View */}
      {!loggedIn && (
        <div className="container">
          <div className="login-box">
            <h1 className="login-title">유통기한 관리</h1>
            <p className="login-subtitle">매장 정보를 입력해주세요</p>

            {error && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            <form onSubmit={onLogin}>
              <div className="form-group">
                <label className="form-label">매장코드</label>
                <input
                  className="form-input"
                  value={storeCode}
                  onChange={(e) => setStoreCode(e.target.value)}
                  placeholder="예: 1410760"
                />
              </div>

              <div className="form-group" style={{ marginBottom: 40 }}>
                <label className="form-label">매장명</label>
                <input
                  className="form-input"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="예: 코엑스MALL"
                />
              </div>

              <button className="btn-primary" type="submit">
                시작하기
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Main View */}
      {loggedIn && (
        <div className="container">
          <div className="main-content">
            <h2 style={{ color: "#A3080B", fontSize: 28, fontWeight: 900 }}>
              유효기간 입력
            </h2>

            <p style={{ color: "#666", marginTop: 8, marginBottom: 18 }}>
              매장: <b>{storeCode.trim()}</b> | <b>{storeName.trim()}</b>
            </p>

            {loadingCategories && (
              <div className="alert alert-success">카테고리 불러오는 중...</div>
            )}
            {catError && <div className="alert alert-error">{catError}</div>}

            {error && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            <div style={{ display: "flex", gap: 12, margin: "20px 0" }}>
              <select
                className="form-input"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="ALL">전체 카테고리</option>
                {categories?.map((cat, idx) => (
                  <option key={idx} value={cat.category}>
                    {cat.category}
                  </option>
                ))}
              </select>

              <input
                className="form-input"
                placeholder="자재명 검색"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>

            {filteredCategories.map((category, ci) => (
              <div className="category-section" key={ci}>
                <div className="category-title">
                  <div className="category-icon">
                    {CATEGORY_ICON_MAP[category.category] ?? CATEGORY_ICON_MAP["기타"]}
                  </div>
                  <div>{category.category}</div>
                </div>

                {(category.items || []).map((item) => {
                  const key = `${category.category}__${String(item)}`;
                  const val = dates[key] || "";
                  const st = updateStatusText(val);

                  return (
                    <div className="item-row" key={key}>
                      <div className="item-name">📌 {item}</div>

                      <button
                        type="button"
                        className="date-btn"
                        onClick={() => openPicker(key, String(item))}
                      >
                        <span className="hint">유효기간</span>
                        <span className="value">{val || "선택"}</span>
                      </button>

                      <div className={`status-badge ${st.cls}`}>{st.text}</div>
                    </div>
                  );
                })}
              </div>
            ))}

            <div
              className="save-section"
              style={{ display: "flex", gap: 12, justifyContent: "center" }}
            >
              <button
                className="btn-primary"
                style={{ maxWidth: 220 }}
                type="button"
                onClick={onSave}
                disabled={saving}
              >
                {saving ? "저장 중..." : "저장하기"}
              </button>

              <button
                className="btn-primary"
                style={{ maxWidth: 220, background: "#444" }}
                type="button"
                onClick={() => {
                  const q = new URLSearchParams();
                  q.set("store_code", storeCode.trim());
                  q.set("store_name", storeName.trim());
                  router.push(`/dashboard?${q.toString()}`);
                }}
              >
                결과조회
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Date Picker Modal */}
      {pickerOpen && (
        <div className="modal-backdrop" onClick={closePicker}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">유효기간 선택 - {activeLabel}</div>
              <button className="modal-close" onClick={closePicker} type="button">
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="quick-actions">
                <button type="button" onClick={() => setDraftDate(todayText)}>
                  오늘
                </button>
                <button type="button" onClick={() => setDraftDate(addDays(draftDate, 7))}>
                  +7일
                </button>
                <button type="button" onClick={() => setDraftDate(addDays(draftDate, 30))}>
                  +30일
                </button>
              </div>

              <DateWheelPicker value={draftDate} onChange={setDraftDate} />
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={closePicker}>
                취소
              </button>

              <button type="button" className="btn-confirm" onClick={confirmPicker}>
                적용
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}