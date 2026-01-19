"use client";

export const dynamic = 'force-dynamic';

import React, { Suspense, useMemo, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// ✅ (보험) Static Export/Prerender 시도 막기
export const dynamic = "force-dynamic";

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

// ✅ Suspense Wrapper (여기서는 useSearchParams 절대 호출하지 않음)
export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 40 }}>로딩중...</div>}>
      <PageClient />
    </Suspense>
  );
}

// ✅ 기존 페이지 로직은 여기로 그대로 이동
function PageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const styles = useMemo(
    () => `
*{
  margin:0;
  padding:0;
  box-sizing:border-box;
  font-family: "Pretendard", system-ui, -apple-system, BlinkMacSystemFont;
}

body{
  background:linear-gradient(135deg,#FFF1E2 0%,#F5D4B7 100%);
  min-height:100vh;
}

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
  color:#FFFFFF;
  letter-spacing:2px;
  text-shadow:2px 2px 4px rgba(0,0,0,0.3);
}

.user-info{
  color:#FFF1E2;
  font-size:18px;
  font-weight:900;
  white-space:nowrap;
}

.container{
  max-width:1200px;
  margin:40px auto;
  padding:0 20px;
}

.login-box, .main-content{
  background:white;
  border-radius:15px;
  box-shadow:0 8px 32px rgba(0,0,0,0.1);
  padding:40px;
  margin-bottom:30px;
}

.login-box{
  max-width:450px;
  margin:100px auto;
}

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

.form-group{margin-bottom:20px}

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
  transition:all 0.3s;
  background:#fff;
}

.form-input:focus{
  outline:none;
  border-color:#A3080B;
  box-shadow:0 0 0 3px rgba(163,8,11,0.1);
}

.btn-primary{
  width:100%;
  padding:16px;
  margin-top:10px;
  background:linear-gradient(90deg,#A3080B 0%,#DC001B 100%);
  color:white;
  border:none;
  border-radius:8px;
  font-size:16px;
  font-weight:800;
  cursor:pointer;
  transition:all 0.2s;
  text-transform:uppercase;
  letter-spacing:1px;
}

.btn-primary:hover{
  transform:translateY(-2px);
  box-shadow:0 6px 20px rgba(163,8,11,0.35);
}

.btn-primary:disabled{
  opacity:0.6;
  cursor:not-allowed;
  transform:none;
  box-shadow:none;
}

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
  color:white;
  border-radius:50%;
  display:flex;
  align-items:center;
  justify-content:center;
  margin-right:12px;
  flex:0 0 30px;
}

.item-row{
  background:white;
  padding:20px;
  margin-bottom:12px;
  border-radius:12px;
  display:grid;
  grid-template-columns:2fr 3fr 1.5fr;
  gap:20px;
  align-items:center;
  box-shadow:0 2px 8px rgba(0,0,0,0.05);
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

.date-btn:active{
  transform:scale(0.995);
}

.date-btn .hint{
  color:#666;
  font-weight:800;
}

.date-btn .value{
  color:#111;
  font-weight:900;
}

.status-badge{
  padding:8px 12px;
  border-radius:20px;
  font-size:12px;
  font-weight:900;
  text-align:center;
  text-transform:uppercase;
  letter-spacing:0.5px;
}

.status-ok{background:#4CAF50;color:white}
.status-warning{background:#FFC107;color:#333}
.status-danger{background:#F44336;color:white}

.save-section{
  position:sticky;
  bottom:20px;
  background:white;
  padding:20px;
  border-radius:12px;
  box-shadow:0 -4px 20px rgba(0,0,0,0.1);
  text-align:center;
}

.alert{
  padding:12px 16px;
  border-radius:8px;
  margin-bottom:20px;
  font-weight:700;
}

.alert-error{
  background:#FFEBEE;
  color:#C62828;
}

.alert-success{
  background:#E8F5E9;
  color:#2E7D32;
}

/* ===== 모달 달력 (크게) ===== */
.modal-backdrop{
  position:fixed;
  inset:0;
  background:rgba(0,0,0,0.55);
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
  box-shadow:0 12px 40px rgba(0,0,0,0.25);
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

.modal-body{
  padding:16px;
}

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

.quick-actions button:hover{
  border-color:#A3080B;
}

.big-date-input{
  width:100%;
  padding:18px 14px;
  border:2px solid #A3080B;
  border-radius:12px;
  font-size:18px;
  font-weight:900;
  background:#fff;
}

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

.btn-danger{
  flex:1;
  padding:14px 12px;
  border-radius:10px;
  border:2px solid #F44336;
  background:#fff;
  font-weight:900;
  cursor:pointer;
  color:#F44336;
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

/* ===== 모바일 최적화 (폰트 더 작게) ===== */
@media (max-width: 768px){
  .header-content{padding:0 16px}
  .logo{font-size:15px;letter-spacing:0.5px}
  .user-info{font-size:11px}

  .login-box{margin:60px auto;padding:24px}
  .main-content{padding:20px}

  .category-title{font-size:16px}

  .item-row{
    grid-template-columns:1fr;
    gap:10px;
    padding:16px;
  }

  .item-name{
    font-size:14px;
    line-height:1.25;
  }

  .date-btn{
    font-size:13px;
    padding:16px 14px;
    border-radius:12px;
  }

  .status-badge{
    font-size:11px;
    padding:6px 10px;
    justify-self:start;
    width:fit-content;
  }

  .modal-title{
    font-size:15px;
  }

  .quick-actions button{
    font-size:13px;
    padding:10px 6px;
  }

  .big-date-input{
    font-size:16px;
    padding:16px 12px;
  }

  .category-section{
    padding:16px;
  }
}
`,
    []
  );

  const API_BASE = "https://inventory-api-231876330057.asia-northeast3.run.app";

  const [storeCode, setStoreCode] = useState("");
  const [storeName, setStoreName] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const qCode = (searchParams.get("store_code") || "").trim();
    const qName = (searchParams.get("store_name") || "").trim();

    if (!qCode) return;

    const codeOk = /^1410\d{3}$/.test(qCode);
    if (!codeOk) return;

    setStoreCode(qCode);
    if (qName) setStoreName(qName);
    setLoggedIn(true);

    setError("");
    setSuccess("");
  }, [searchParams]);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const [categories, setCategories] = useState(null);
  const [dates, setDates] = useState({});
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [catError, setCatError] = useState("");

  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [searchText, setSearchText] = useState("");

  const [lastPickedDate, setLastPickedDate] = useState("");

  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeKey, setActiveKey] = useState("");
  const [activeLabel, setActiveLabel] = useState("");
  const [draftDate, setDraftDate] = useState("");

  const todayText = useMemo(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }, []);

  const storageKey = useMemo(() => {
    const code = storeCode.trim();
    return code ? `expiry_dates_${code}` : "";
  }, [storeCode]);

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

  useEffect(() => {
    if (!loggedIn) return;
    if (!storageKey) return;

    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;

      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        setDates(parsed.dates || {});
        setLastPickedDate(parsed.lastPickedDate || "");
      }
    } catch (e) {
      console.error("localStorage 로드 실패:", e);
    }
  }, [loggedIn, storageKey]);

  useEffect(() => {
    if (!loggedIn) return;
    if (!storageKey) return;

    try {
      localStorage.setItem(storageKey, JSON.stringify({ dates, lastPickedDate }));
    } catch (e) {
      console.error("localStorage 저장 실패:", e);
    }
  }, [dates, lastPickedDate, loggedIn, storageKey]);

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

  function onLogin(e) {
    e.preventDefault();

    const code = storeCode.trim();
    const name = storeName.trim();

    const codeOk = /^1410\d{3}$/.test(code);
    if (!codeOk) {
      setError("매장코드는 1410으로 시작하는 7자리 숫자만 가능합니다. (예: 1410760)");
      setSuccess("");
      return;
    }

    if (!name) {
      setError("매장명을 입력해주세요.");
      setSuccess("");
      return;
    }

    setError("");
    setSuccess("로그인에 성공하였습니다.");

    // ★★★★★ 여기부터 수정/추가 ★★★★★
    // localStorage에 매장 정보 저장 (입력페이지에서 로그인 성공 시)
    localStorage.setItem('kfc_store_info', JSON.stringify({
      storeCode: code,
      storeName: name,
      loggedIn: true,
      timestamp: new Date().toISOString()  // 나중에 오래된 정보 무시하려면 유용
    }));

    setTimeout(() => {
      setLoggedIn(true);
      setSuccess("");
    }, 600);
  }

  function updateStatusText(dateStr) {
    if (!dateStr) return { text: "입력 필요", cls: "status-ok" };

    const expiry = new Date(dateStr + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diff = Math.ceil((expiry - today) / 86400000);
    if (diff < 0) return { text: "기한 만료", cls: "status-danger" };
    if (diff <= 7) return { text: `${diff}일 남음`, cls: "status-warning" };
    return { text: `${diff}일 남음`, cls: "status-ok" };
  }

  const addDays = useCallback(
    (base, days) => {
      const d = new Date((base || todayText) + "T00:00:00");
      d.setDate(d.getDate() + days);
      return d.toISOString().slice(0, 10);
    },
    [todayText]
  );

  const openPicker = useCallback(
    (key, label) => {
      const current = dates[key] || "";
      const initial = current || lastPickedDate || todayText;

      setActiveKey(key);
      setActiveLabel(label);
      setDraftDate(initial);
      setPickerOpen(true);
    },
    [dates, lastPickedDate, todayText]
  );

  const closePicker = useCallback(() => {
    setPickerOpen(false);
    setActiveKey("");
    setActiveLabel("");
    setDraftDate("");
  }, []);

  const confirmPicker = useCallback(() => {
    if (!activeKey) return;

    const picked = draftDate || "";
    setDates((prev) => ({ ...prev, [activeKey]: picked }));

    if (picked) setLastPickedDate(picked);

    closePicker();
  }, [activeKey, draftDate, closePicker]);

  const clearPicker = useCallback(() => {
    if (!activeKey) return;

    setDates((prev) => {
      const next = { ...prev };
      delete next[activeKey];
      return next;
    });

    closePicker();
  }, [activeKey, closePicker]);

  const onSave = useCallback(async () => {
    try {
      setError("");
      setSuccess("");

      const store_code = storeCode.trim();
      if (!store_code) {
        setError("매장코드가 없습니다.");
        return;
      }

      const entries = Object.entries(dates)
        .filter(([_, v]) => Boolean(v))
        .map(([k, v]) => {
          const [category, item_name] = k.split("__");
          return { category, item_name, expiry_date: v };
        })
        .filter((e) => e.category && e.item_name && e.expiry_date);

      if (entries.length === 0) {
        setError("저장할 항목이 없습니다. 유효기간을 먼저 입력해주세요.");
        return;
      }

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

  return (
    <main>
      <style dangerouslySetInnerHTML={{ __html: styles }} />

      <div className="header">
        <div className="header-content">
          <div className="logo">KFC OPERATIONS - 자재유통기한 관리</div>

          <div className="user-info">
            {loggedIn ? (
              <>
                {todayText} | {storeCode.trim()} | {storeName.trim()}
              </>
            ) : (
              ""
            )}
          </div>
        </div>
      </div>

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

                {category.items.map((item) => {
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
                        <span className="value">
                          {val ? val : lastPickedDate ? `${lastPickedDate} (최근)` : "선택"}
                        </span>
                      </button>

                      <div className={`status-badge ${st.cls}`}>{st.text}</div>
                    </div>
                  );
                })}
              </div>
            ))}

            <div className="save-section" style={{ display: "flex", gap: 12, justifyContent: "center" }}>
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
                  router.push(`/dashboard?store_code=${storeCode.trim()}`);
                }}
              >
                결과조회
              </button>
            </div>
          </div>
        </div>
      )}

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
                <button type="button" onClick={() => setDraftDate(addDays(draftDate, 2))}>
                  +1일
                </button>
                <button type="button" onClick={() => setDraftDate(addDays(draftDate, -0))}>
                  -1일
                </button>
              </div>

              <input
                type="date"
                className="big-date-input"
                value={draftDate}
                onChange={(e) => setDraftDate(e.target.value)}
              />
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={closePicker}>
                취소
              </button>

              <button type="button" className="btn-danger" onClick={clearPicker}>
                삭제
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
