// ================== DATA ==================
const DATA_URL =
  "https://raw.githubusercontent.com/cederdorff/race/refs/heads/master/data/games.json";

// ================== DOM ===================
const els = {
  // top pills
  agePill: document.getElementById("age-pill"),
  playersPill: document.getElementById("players-pill"),
  durationPill: document.getElementById("duration-pill"),

  // search + list
  search: document.getElementById("search-input"),
  list: document.getElementById("game-list"),

  // “flere filtre”
  genre: document.getElementById("genre-select"),
  language: document.getElementById("language-select"),
  difficulty: document.getElementById("difficulty-select"),
  ratingFrom: document.getElementById("rating-from"),
  ratingTo: document.getElementById("rating-to"),
  playFrom: document.getElementById("playtime-from"),
  playTo: document.getElementById("playtime-to"),
  availableOnly: document.getElementById("available-only"),
  sort: document.getElementById("sort-select"),
  clear: document.getElementById("clear-filters"),

  // tabbar
  tabAll: document.getElementById("tab-all"),
  tabHome: document.getElementById("tab-home"),
  tabFav: document.getElementById("filter-favourites"),
  tabRes: document.getElementById("tab-reserve"),
};

// ================== STATE =================
let GAMES = [];
let SHOW_FAVS = false;

const STORAGE_KEY = "favs";
let FAVS = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));

// ================== INIT ==================
init();
async function init() {
  try {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error("Kunne ikke hente data");
    GAMES = await res.json();
    hydrateSelects(GAMES);
    bindEvents();
    render();
  } catch (err) {
    console.error(err);
    els.list.innerHTML = `<p>Kunne ikke indlæse spil.</p>`;
  }
}

// ================== UI WIRING =============
function hydrateSelects(games) {
  fillUniqueOptions(els.genre, unique(games.map((g) => g.genre)));
  fillUniqueOptions(els.language, unique(games.map((g) => g.language)));
  fillUniqueOptions(els.difficulty, unique(games.map((g) => g.difficulty)));

  const ratings = games.map((g) => g.rating).filter(Number.isFinite);
  if (ratings.length) {
    els.ratingFrom.placeholder = Math.min(...ratings).toFixed(1);
    els.ratingTo.placeholder = Math.max(...ratings).toFixed(1);
  }
  updateFavTabCounter();
}

function bindEvents() {
  // søg/filtre
  [
    els.search,
    els.genre,
    els.language,
    els.difficulty,
    els.ratingFrom,
    els.ratingTo,
    els.playFrom,
    els.playTo,
    els.availableOnly,
    els.sort,
    els.agePill,
    els.playersPill,
    els.durationPill,
  ].forEach((el) => el?.addEventListener("input", render));

  els.clear?.addEventListener("click", () => {
    els.search.value = "";
    ["genre", "language", "difficulty"].forEach((k) => (els[k].value = "all"));
    ["ratingFrom", "ratingTo", "playFrom", "playTo"].forEach(
      (k) => (els[k].value = "")
    );
    els.availableOnly.checked = false;
    els.sort.value = "none";
    els.agePill.value = "all";
    els.playersPill.value = "all";
    els.durationPill.value = "all";
    SHOW_FAVS = false;
    els.tabFav?.classList.remove("active");
    render();
  });

  // Grid: ❤️ eller åbn modal
  els.list.addEventListener("click", (e) => {
    // ❤️
    const favBtn = e.target.closest("button.fav[data-fav-id]");
    if (favBtn) {
      e.stopPropagation(); // undgå at åbne modal
      const id = String(favBtn.dataset.favId).trim();
      if (FAVS.has(id)) {
        FAVS.delete(id);
        favBtn.classList.remove("active");
      } else {
        FAVS.add(id);
        favBtn.classList.add("active");
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...FAVS]));
      updateFavTabCounter();
      if (SHOW_FAVS) render();
      return;
    }
    // Kort → modal
    const card = e.target.closest(".card[data-id]");
    if (card) openModalById(card.dataset.id);
  });

  // Tabbar
  els.tabAll?.addEventListener("click", () => {
    if (!bookingView?.hidden) closeBooking();
    SHOW_FAVS = false;
    setActiveTab(els.tabAll);
    render();
  });

  els.tabFav?.addEventListener("click", () => {
    SHOW_FAVS = true;
    setActiveTab(els.tabFav);
    render();
  });

  els.tabRes?.addEventListener("click", () => {
    setActiveTab(els.tabRes);
    openBooking();
  });

  els.tabHome?.addEventListener("click", () => {
    if (!bookingView?.hidden) closeBooking();
    SHOW_FAVS = false;
    setActiveTab(null); // midter-FAB er ikke .tab
    render();
  });

  // Topbar tilbage
  document.getElementById("go-back")?.addEventListener("click", () => {
    window.location.href = "https://spilcafeen.dk/";
  });
}

function setActiveTab(el) {
  document
    .querySelectorAll(".tabbar .tab")
    .forEach((t) => t.classList.remove("active"));
  if (el?.classList.contains("tab")) el.classList.add("active");
}

// ================== FILTER/SORT ===========
function getFilters() {
  const num = (v) => (v === "" || v == null ? null : Number(v));
  return {
    query: (els.search.value || "").trim().toLowerCase(),
    genre: valueOrAll(els.genre),
    language: valueOrAll(els.language),
    difficulty: valueOrAll(els.difficulty),
    ratingFrom: num(els.ratingFrom.value),
    ratingTo: num(els.ratingTo.value),
    playFrom: num(els.playFrom.value),
    playTo: num(els.playTo.value),
    availableOnly: els.availableOnly.checked,
    sort: valueOrAll(els.sort),
    agePill: valueOrAll(els.agePill),
    playersPill: valueOrAll(els.playersPill),
    durationPill: valueOrAll(els.durationPill),
  };
}
const valueOrAll = (el) => (el && el.value ? el.value : "all");

function applyFilters(arr, f) {
  return arr.filter((g) => {
    const text = (
      g.title +
      " " +
      (g.description || "") +
      " " +
      (g.rules || "")
    ).toLowerCase();
    if (f.query && !text.includes(f.query)) return false;

    if (f.genre !== "all" && g.genre !== f.genre) return false;
    if (f.language !== "all" && g.language !== f.language) return false;
    if (f.difficulty !== "all" && g.difficulty !== f.difficulty) return false;
    if (f.ratingFrom != null && g.rating < f.ratingFrom) return false;
    if (f.ratingTo != null && g.rating > f.ratingTo) return false;
    if (f.playFrom != null && g.playtime < f.playFrom) return false;
    if (f.playTo != null && g.playtime > f.playTo) return false;
    if (f.availableOnly && !g.available) return false;

    if (f.agePill !== "all" && g.age < Number(f.agePill)) return false;

    if (f.playersPill !== "all") {
      const [minStr, maxStr] = f.playersPill.split("-");
      const wantMin = Number(minStr);
      const wantMax = maxStr?.includes("+") ? 99 : Number(maxStr);
      const gMin = g.players?.min ?? 1;
      const gMax = g.players?.max ?? 99;
      if (gMax < wantMin || gMin > wantMax) return false;
    }

    if (f.durationPill !== "all") {
      const [a, b] = f.durationPill.split("-");
      const from = Number(a);
      const to = b?.includes("+") ? 10000 : Number(b);
      if (g.playtime < from || g.playtime > to) return false;
    }

    if (SHOW_FAVS && !FAVS.has(String(g.id))) return false;

    return true;
  });
}

function applySort(arr, key) {
  const out = [...arr];
  switch (key) {
    case "title":
      out.sort((a, b) => a.title.localeCompare(b.title, "da"));
      break;
    case "playtime":
      out.sort((a, b) => (a.playtime ?? 0) - (b.playtime ?? 0));
      break;
    case "rating":
      out.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
      break;
  }
  return out;
}

// ================== RENDER =================
function render() {
  const f = getFilters();
  const filtered = applyFilters(GAMES, f);
  const sorted = applySort(filtered, f.sort);

  if (!sorted.length) {
    els.list.innerHTML = `<p style="color:#7b5647">Ingen spil matcher dine filtre.</p>`;
    return;
  }
  els.list.innerHTML = sorted.map(gameCard).join("");
  updateFavTabCounter();
}

function gameCard(g) {
  const favActive = FAVS.has(String(g.id)) ? "active" : "";
  const players = g.players ? `${g.players.min}–${g.players.max}` : "—";
  const rating = Number.isFinite(g.rating) ? g.rating.toFixed(1) : "—";
  const badgeAvail = g.available ? `<span class="badge">Ledig</span>` : ``;

  return `
    <article class="card" data-id="${g.id}">
      <div class="thumb">
        <img src="${g.image}" alt="${escapeHtml(g.title)}">
        <div class="badges">${badgeAvail}</div>
        <button class="fav ${favActive}" data-fav-id="${
    g.id
  }" aria-label="Føj til favoritter">❤</button>
      </div>
      <h3>${escapeHtml(g.title)}</h3>
      <div class="meta">
        <span>👥 ${players}</span>
        <span>⭐ ${rating}</span>
      </div>
      <div class="extra">
        ${g.shelf ? `<span>Placering: ${escapeHtml(g.shelf)}</span>` : ""}
      </div>
    </article>
  `;
}

// ================== HELPERS ===============
function fillUniqueOptions(select, arr) {
  unique(arr).forEach((v) => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = v;
    select.appendChild(o);
  });
}
function unique(arr) {
  return [...new Set(arr.filter(Boolean))].sort((a, b) =>
    String(a).localeCompare(String(b), "da")
  );
}
function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
function updateFavTabCounter() {
  const s = els.tabFav?.querySelector("small");
  if (s) s.textContent = `Favoritter (${FAVS.size})`;
}

// ================== MODAL (mere info) =================
const modal = document.getElementById("game-modal");
const mImg = document.getElementById("modal-image");
const mTitle = document.getElementById("modal-title");
const mMeta = document.getElementById("modal-meta");
const mDesc = document.getElementById("modal-desc");
const mDetails = document.getElementById("modal-details");
const mRulesWrap = document.getElementById("modal-rules-wrap");
const mRules = document.getElementById("modal-rules");

function openModalById(id) {
  if (!modal) return;
  const g = GAMES.find((x) => String(x.id) === String(id));
  if (!g) return;

  mImg.src = g.image;
  mImg.alt = g.title;
  mTitle.textContent = g.title;
  mMeta.innerHTML = [
    Number.isFinite(g.rating) ? `⭐ ${g.rating.toFixed(1)}` : null,
    g.players ? `👥 ${g.players.min}–${g.players.max}` : null,
    Number.isFinite(g.playtime) ? `⏱️ ${g.playtime} min` : null,
    g.age ? `👶 ${g.age}+` : null,
  ]
    .filter(Boolean)
    .map((x) => `<span>${x}</span>`)
    .join("");

  mDesc.textContent = g.description || "";
  mDetails.innerHTML = [
    g.genre ? `<span>🎭 Kategori: ${escapeHtml(g.genre)}</span>` : "",
    g.language ? `<span>🗣️ Sprog: ${escapeHtml(g.language)}</span>` : "",
    g.difficulty ? `<span>🎯 Sværhed: ${escapeHtml(g.difficulty)}</span>` : "",
    g.shelf ? `<span>📍 Placering: ${escapeHtml(g.shelf)}</span>` : "",
    g.available != null
      ? `<span>${g.available ? "✅ Ledig" : "❌ Udlånt"}</span>`
      : "",
  ].join("");

  if (g.rules) {
    mRulesWrap.hidden = false;
    mRules.textContent = g.rules;
  } else {
    mRulesWrap.hidden = true;
    mRules.textContent = "";
  }

  modal.hidden = false;
  document.body.style.overflow = "hidden";
}
function closeModal() {
  if (!modal) return;
  modal.hidden = true;
  document.body.style.overflow = "";
}
modal?.addEventListener("click", (e) => {
  if (
    e.target.matches("[data-close]") ||
    e.target.classList.contains("modal-backdrop")
  )
    closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modal?.hidden) closeModal();
});

// ================== BOOKING FLOW =================
const reserveTab = document.getElementById("tab-reserve");
const bookingView = document.getElementById("booking-view");
const bookingStage = document.getElementById("booking-stage");
const bookingBack = document.getElementById("booking-back");

const CAFES = [
  {
    id: "aarhus-v",
    name: "Aarhus V",
    address: "Vesterbrogade 36, 8000",
    img: "https://images.unsplash.com/photo-1517701604599-bb29b565090c?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: "aarhus-c",
    name: "Aarhus C",
    address: "Søndergade 98, 8000",
    img: "https://images.unsplash.com/photo-1481833761820-0509d3217039?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: "aalborg",
    name: "Aalborg",
    address: "Nytorv 21, 9000",
    img: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: "odense",
    name: "Odense",
    address: "Kongensgade 11, 5000",
    img: "https://images.unsplash.com/photo-1498654200943-1088dd4438ae?q=80&w=800&auto=format&fit=crop",
  },
];

const booking = {
  step: 1,
  cafe: null,
  guests: null,
  date: null,
  time: null,
  type: null,
  name: "",
  phone: "",
  email: "",
  note: "",
};

reserveTab?.addEventListener("click", () => openBooking());
bookingBack?.addEventListener("click", () => closeBooking());

function openBooking() {
  if (!bookingView) return;
  document.querySelector("main.page").style.display = "none";
  bookingView.hidden = false;
  booking.step = 1;
  renderBooking();
  document
    .querySelectorAll(".tabbar .tab")
    .forEach((t) => t.classList.remove("active"));
  reserveTab?.classList.add("active");
}
function closeBooking() {
  if (!bookingView) return;
  bookingView.hidden = true;
  document.querySelector("main.page").style.display = "";
  document
    .querySelectorAll(".tabbar .tab")
    .forEach((t) => t.classList.remove("active"));
  document.getElementById("tab-home")?.classList.add("active");
}

function renderBooking() {
  switch (booking.step) {
    case 1:
      return renderStepCafe();
    case 2:
      return renderStepGuests();
    case 3:
      return renderStepDate();
    case 4:
      return renderStepTime();
    case 5:
      return renderStepType();
    case 6:
      return renderStepConfirm();
    case 7:
      return renderStepSuccess();
  }
}

/* STEP 1 – vælg café */
function renderStepCafe() {
  bookingStage.innerHTML = `
    <h2 class="booking-title">Vælg café</h2>
    <div class="booking-grid booking-cafes">
      ${CAFES.map(
        (c) => `
        <article class="booking-card" data-cafe="${c.id}">
          <img src="${c.img}" alt="${c.name}">
          <h4>${c.name}</h4>
          <p>${c.address}</p>
        </article>
      `
      ).join("")}
    </div>
  `;
  bookingStage.querySelectorAll("[data-cafe]").forEach((card) => {
    card.addEventListener("click", () => {
      const id = card.dataset.cafe;
      booking.cafe = CAFES.find((c) => c.id === id);
      booking.step = 2;
      renderBooking();
    });
  });
}

/* STEP 2 – antal gæster */
function renderStepGuests() {
  bookingStage.innerHTML = `
    <h2 class="booking-title">Hvor mange gæster er I?</h2>
    <div class="booking-bubbles">
      ${[2, 3, 4, 5, 6, 7, 8]
        .map((n) => `<button class="bubble" data-guests="${n}">${n}</button>`)
        .join("")}
    </div>
  `;
  bookingStage.querySelectorAll("[data-guests]").forEach((btn) => {
    btn.addEventListener("click", () => {
      booking.guests = Number(btn.dataset.guests);
      booking.step = 3;
      renderBooking();
    });
  });
}

/* STEP 3 – dato */
function renderStepDate() {
  const today = new Date().toISOString().slice(0, 10);
  bookingStage.innerHTML = `
    <h2 class="booking-title">Vælg dato</h2>
    <div class="booking-date">
      <input type="date" id="pick-date" min="${today}" />
      <p class="booking-muted">Vælg en dato for at fortsætte.</p>
    </div>
  `;
  const input = document.getElementById("pick-date");
  input.addEventListener("change", () => {
    if (!input.value) return;
    booking.date = input.value;
    booking.step = 4;
    renderBooking();
  });
}

/* STEP 4 – tidspunkt */
function renderStepTime() {
  const slots = [];
  for (let h = 11; h <= 22; h++) {
    ["00", "30"].forEach((m) =>
      slots.push(`${String(h).padStart(2, "0")}:${m}`)
    );
  }
  const busy = new Set(["11:30", "14:00", "16:30", "18:00", "19:30", "20:30"]); // demo

  bookingStage.innerHTML = `
    <h2 class="booking-title">${formatDateHuman(booking.date)}</h2>
    <div class="booking-time booking-grid" style="grid-template-columns: repeat(4,1fr);">
      ${slots
        .map(
          (t) =>
            `<button class="slot ${
              busy.has(t) ? "busy" : ""
            }" data-time="${t}">${t}</button>`
        )
        .join("")}
    </div>
    <div class="booking-muted" style="margin-top:6px;">Grøn = ledige tider, gennemstreget = reserveret</div>
  `;
  bookingStage.querySelectorAll("[data-time]").forEach((btn) => {
    if (btn.classList.contains("busy")) return;
    btn.addEventListener("click", () => {
      booking.time = btn.dataset.time;
      booking.step = 5;
      renderBooking();
    });
  });
}

/* STEP 5 – type */
function renderStepType() {
  bookingStage.innerHTML = `
    <h2 class="booking-title">Vælg type</h2>
    <div class="booking-type">
      <button class="slot primary" data-type="Vi spiller i 1 time">Vi spiller i 1 time</button>
      <button class="slot primary" data-type="Vi spiller i 2 timer">Vi spiller i 2 timer</button>
      <button class="slot primary" data-type="Vi spiller i 3 timer">Vi spiller i 3 timer</button>
    </div>
  `;
  bookingStage.querySelectorAll("[data-type]").forEach((btn) => {
    btn.addEventListener("click", () => {
      booking.type = btn.dataset.type;
      booking.step = 6;
      renderBooking();
    });
  });
}

/* STEP 6 – bekræft + kontakt */
function renderStepConfirm() {
  const place = booking.cafe
    ? `${booking.cafe.name} – ${booking.cafe.address}`
    : "";
  bookingStage.innerHTML = `
    <h2 class="booking-title">Bekræft</h2>
    <div class="booking-summary">
      <div><strong>Sted</strong><br>${place}</div>
      <div><strong>Tid</strong><br>${booking.time}</div>
      <div><strong>Antal gæster</strong><br>${booking.guests} person(er)</div>
      <div><strong>Dato</strong><br>${formatDateHuman(booking.date)}</div>
      <div><strong>Type</strong><br>${booking.type}</div>
    </div>

    <form class="booking-form" id="confirm-form">
      <input type="text"  name="name"  placeholder="Navn"   required />
      <input type="tel"   name="phone" placeholder="Mobil"  required />
      <input type="email" name="email" placeholder="E-mail" required />
      <textarea name="note" rows="3" placeholder="Kommentar"></textarea>
      <button class="booking-btn" type="submit">Bekræft booking</button>
    </form>
  `;
  document.getElementById("confirm-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    booking.name = fd.get("name");
    booking.phone = fd.get("phone");
    booking.email = fd.get("email");
    booking.note = fd.get("note");
    booking.step = 7;
    renderBooking();
  });
}

/* STEP 7 – bekræftelse */
function renderStepSuccess() {
  bookingStage.innerHTML = `
    <div class="booking-success">
      <div class="success-big">Tak for din booking 😊</div>
      <div class="booking-summary" style="text-align:left">
        <div><strong>Sted</strong><br>${booking.cafe.name} – ${
    booking.cafe.address
  }</div>
        <div><strong>Tid</strong><br>${booking.time}</div>
        <div><strong>Dato</strong><br>${formatDateHuman(booking.date)}</div>
        <div><strong>Antal gæster</strong><br>${booking.guests}</div>
        <div><strong>Type</strong><br>${booking.type}</div>
        <div><strong>Navn</strong><br>${booking.name}</div>
        <div><strong>Email</strong><br>${booking.email}</div>
        ${
          booking.note
            ? `<div><strong>Kommentar</strong><br>${escapeHtml(
                booking.note
              )}</div>`
            : ""
        }
      </div>
      <p class="booking-muted">Du vil modtage en bekræftelse på mail inden for 15 minutter.</p>
      <div style="display:flex; gap:8px; justify-content:center;">
        <button class="booking-btn" id="done-btn">Afslut</button>
      </div>
    </div>
  `;
  document.getElementById("done-btn").addEventListener("click", () => {
    closeBooking();
    booking.step = 1;
    booking.cafe = null;
    booking.guests = null;
    booking.date = null;
    booking.time = null;
    booking.type = null;
  });
}

/* ===== helpers ===== */
function formatDateHuman(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("da-DK", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
