import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  doc,
  onSnapshot,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const DOC_PATH = { collection: "weddingChecklist", id: "main" };

const STARTER_DATA = [
  {
    id: "cat-1",
    name: "Attire",
    items: [
      { id: "i-1", name: "Wedding dress", purchased: false },
      { id: "i-2", name: "Groom's suit", purchased: false },
    ],
  },
  {
    id: "cat-2",
    name: "Decor",
    items: [
      { id: "i-3", name: "Table centerpieces", purchased: false },
      { id: "i-4", name: "Fairy lights", purchased: false },
    ],
  },
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const connStatus = document.getElementById("connStatus");
const errorBanner = document.getElementById("errorBanner");
const emptyState = document.getElementById("emptyState");
const categoryListEl = document.getElementById("categoryList");
const newCategoryInput = document.getElementById("newCategoryInput");
const addCategoryBtn = document.getElementById("addCategoryBtn");
const overallFill = document.getElementById("overallProgressFill");
const overallLabel = document.getElementById("overallProgressLabel");
const overallPct = document.getElementById("overallProgressPct");

let state = [];
let collapsedMap = {};
let docRef = null;
let db = null;
let usingFallback = false;
let hasAttemptedSeed = false;

function showError(msg) {
  errorBanner.textContent = msg;
  errorBanner.hidden = false;
}
function clearError() {
  errorBanner.hidden = true;
}

// --- Firebase setup ---
try {
  const isPlaceholder = firebaseConfig.apiKey === "YOUR_API_KEY";
  if (isPlaceholder) {
    usingFallback = true;
    connStatus.textContent = "no Firebase config yet — using this browser only";
    loadFallback();
  } else {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    docRef = doc(db, DOC_PATH.collection, DOC_PATH.id);
    connStatus.textContent = "synced live — everyone sees the same list";
    onSnapshot(
      docRef,
      (snap) => {
        clearError();
        if (snap.exists()) {
          state = snap.data().categories || [];
          render();
        } else if (!hasAttemptedSeed) {
          hasAttemptedSeed = true;
          state = STARTER_DATA;
          render();
          setDoc(docRef, { categories: STARTER_DATA }).catch((e) => {
            showError("Couldn't create the shared list. Check your Firestore rules.");
            console.error(e);
          });
        }
      },
      (err) => {
        showError("Couldn't connect to the shared list. Check your Firebase setup.");
        console.error(err);
      }
    );
  }
} catch (e) {
  usingFallback = true;
  connStatus.textContent = "no Firebase config yet — using this browser only";
  loadFallback();
  console.error(e);
}

// --- Fallback: localStorage only (single browser, no Firebase configured) ---
function loadFallback() {
  try {
    const raw = localStorage.getItem("wedding-checklist-data");
    state = raw ? JSON.parse(raw) : STARTER_DATA;
  } catch (e) {
    state = STARTER_DATA;
  }
  render();
}

async function persist() {
  if (usingFallback) {
    try {
      localStorage.setItem("wedding-checklist-data", JSON.stringify(state));
      clearError();
    } catch (e) {
      showError("Couldn't save in this browser.");
    }
    render();
    return;
  }
  try {
    await setDoc(docRef, { categories: state });
    clearError();
  } catch (e) {
    showError("Couldn't save your change. Check your connection.");
    console.error(e);
  }
  // onSnapshot will re-render with the confirmed server state
}

// --- Mutations ---
function addCategory(name) {
  if (!name.trim()) return;
  state = [...state, { id: uid(), name: name.trim(), items: [] }];
  persist();
}

function removeCategory(catId) {
  state = state.filter((c) => c.id !== catId);
  persist();
}

function addItem(catId, name) {
  if (!name.trim()) return;
  state = state.map((c) =>
    c.id === catId
      ? { ...c, items: [...c.items, { id: uid(), name: name.trim(), purchased: false }] }
      : c
  );
  persist();
}

function removeItem(catId, itemId) {
  state = state.map((c) =>
    c.id === catId ? { ...c, items: c.items.filter((i) => i.id !== itemId) } : c
  );
  persist();
}

function toggleItem(catId, itemId, sourceEl) {
  let becamePurchased = false;
  state = state.map((c) =>
    c.id === catId
      ? {
          ...c,
          items: c.items.map((i) => {
            if (i.id !== itemId) return i;
            becamePurchased = !i.purchased;
            return { ...i, purchased: !i.purchased };
          }),
        }
      : c
  );
  if (becamePurchased && sourceEl) burstConfetti(sourceEl);
  persist();
}

// --- Rendering ---
function render() {
  categoryListEl.innerHTML = "";

  const totalItems = state.reduce((sum, c) => sum + c.items.length, 0);
  const purchasedItems = state.reduce(
    (sum, c) => sum + c.items.filter((i) => i.purchased).length,
    0
  );
  const pct = totalItems === 0 ? 0 : Math.round((purchasedItems / totalItems) * 100);
  overallFill.style.width = pct + "%";
  overallLabel.textContent = `${purchasedItems} of ${totalItems} sorted`;
  overallPct.textContent = pct + "%";

  emptyState.hidden = state.length !== 0;

  state.forEach((cat) => {
    categoryListEl.appendChild(renderCategoryCard(cat));
  });
}

function renderCategoryCard(cat) {
  const catTotal = cat.items.length;
  const catDone = cat.items.filter((i) => i.purchased).length;
  const catPct = catTotal === 0 ? 0 : Math.round((catDone / catTotal) * 100);
  const isCollapsed = !!collapsedMap[cat.id];

  const card = document.createElement("div");
  card.className = "category-card";

  const header = document.createElement("div");
  header.className = "category-header";

  const titleBtn = document.createElement("button");
  titleBtn.className = "category-title-btn";
  titleBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 16 16" style="flex-shrink:0">
      <path d="M4 ${isCollapsed ? "6l4 4 4-4" : "10l4-4 4 4"}" stroke="#8A7A85" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <span class="category-name"></span>
    <span class="category-count">${catDone}/${catTotal}</span>
  `;
  titleBtn.querySelector(".category-name").textContent = cat.name;
  titleBtn.onclick = () => {
    collapsedMap[cat.id] = !collapsedMap[cat.id];
    render();
  };

  const removeBtn = document.createElement("button");
  removeBtn.className = "cat-remove-btn";
  removeBtn.setAttribute("aria-label", `Remove ${cat.name} category`);
  removeBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 15 15"><path d="M3 4h9M6 4V2.5h3V4M4 4l.6 8.5a1 1 0 001 .9h4.8a1 1 0 001-.9L12 4" stroke="#B98A97" stroke-width="1.3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  removeBtn.onclick = () => {
    if (confirm(`Remove "${cat.name}" and all its items?`)) removeCategory(cat.id);
  };

  header.appendChild(titleBtn);
  header.appendChild(removeBtn);
  card.appendChild(header);

  const miniBg = document.createElement("div");
  miniBg.className = "mini-progress-bg";
  const miniFill = document.createElement("div");
  miniFill.className = "mini-progress-fill";
  miniFill.style.width = catPct + "%";
  miniBg.appendChild(miniFill);
  card.appendChild(miniBg);

  if (!isCollapsed) {
    const itemList = document.createElement("div");
    itemList.className = "item-list";

    if (cat.items.length === 0) {
      const p = document.createElement("p");
      p.className = "no-items-text";
      p.textContent = "Nothing added yet";
      itemList.appendChild(p);
    }

    cat.items.forEach((item) => {
      itemList.appendChild(renderItemRow(cat.id, item));
    });
    card.appendChild(itemList);

    const addWrap = document.createElement("div");
    addWrap.className = "add-item-wrap";
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Add an item…";
    input.maxLength = 80;
    const btn = document.createElement("button");
    btn.setAttribute("aria-label", `Add item to ${cat.name}`);
    btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 15 15"><path d="M7.5 2v11M2 7.5h11" stroke="#7B5C6B" stroke-width="1.8" stroke-linecap="round"/></svg>`;
    const submit = () => {
      addItem(cat.id, input.value);
      input.value = "";
      input.focus();
    };
    btn.onclick = submit;
    input.onkeydown = (e) => e.key === "Enter" && submit();
    addWrap.appendChild(input);
    addWrap.appendChild(btn);
    card.appendChild(addWrap);
  }

  return card;
}

function renderItemRow(catId, item) {
  const row = document.createElement("div");
  row.className = "item-row";

  const checkBtn = document.createElement("button");
  checkBtn.className = "check-btn";
  checkBtn.setAttribute(
    "aria-label",
    item.purchased ? "Mark as not purchased" : "Mark as purchased"
  );
  const wax = document.createElement("span");
  wax.className = "wax" + (item.purchased ? " done" : "");
  if (item.purchased) {
    wax.innerHTML = `<svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M1 5L4.5 8.5L11 1.5" stroke="#FBF7F2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  checkBtn.appendChild(wax);
  checkBtn.onclick = () => toggleItem(catId, item.id, checkBtn);

  const name = document.createElement("span");
  name.className = "item-name" + (item.purchased ? " done" : "");
  name.textContent = item.name;

  const removeBtn = document.createElement("button");
  removeBtn.className = "item-remove-btn";
  removeBtn.setAttribute("aria-label", `Remove ${item.name}`);
  removeBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 13 13"><path d="M2.5 3.5h8M5.2 3.5V2.2h2.6v1.3M3.5 3.5l.5 7.3a.9.9 0 00.9.8h4.2a.9.9 0 00.9-.8l.5-7.3" stroke="#C9B8C0" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  removeBtn.onclick = () => removeItem(catId, item.id);

  row.appendChild(checkBtn);
  row.appendChild(name);
  row.appendChild(removeBtn);
  return row;
}

// --- Confetti burst on marking purchased ---
function burstConfetti(sourceEl) {
  const layer = document.getElementById("confettiLayer");
  const rect = sourceEl.getBoundingClientRect();
  const colors = ["#C08497", "#C9A227", "#93A67F"];
  for (let i = 0; i < 8; i++) {
    const heart = document.createElement("div");
    heart.className = "confetti-heart";
    const size = 6 + Math.random() * 5;
    const color = colors[i % colors.length];
    heart.style.left = rect.left + rect.width / 2 + (Math.random() * 40 - 20) + "px";
    heart.style.top = rect.top + rect.height / 2 + "px";
    heart.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 10 9"><path d="M5 8.5S1 5.6 1 3a2 2 0 013.7-1.1A2 2 0 019 3c0 2.6-4 5.5-4 5.5z" fill="${color}"/></svg>`;
    layer.appendChild(heart);
    setTimeout(() => heart.remove(), 950);
  }
}

// --- Floating background hearts ---
function spawnFloatingHearts() {
  const container = document.getElementById("floatingHearts");
  const colors = ["#E4B8C4", "#EAD9A8", "#C7D4BC"];
  for (let i = 0; i < 10; i++) {
    const heart = document.createElement("div");
    heart.className = "floating-heart";
    const size = 10 + Math.random() * 14;
    const color = colors[i % colors.length];
    heart.style.left = Math.random() * 100 + "%";
    heart.style.animationDuration = 16 + Math.random() * 14 + "s";
    heart.style.animationDelay = Math.random() * 14 + "s";
    heart.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 10 9"><path d="M5 8.5S1 5.6 1 3a2 2 0 013.7-1.1A2 2 0 019 3c0 2.6-4 5.5-4 5.5z" fill="${color}"/></svg>`;
    container.appendChild(heart);
  }
}
spawnFloatingHearts();

// --- Add category controls ---
addCategoryBtn.onclick = () => {
  addCategory(newCategoryInput.value);
  newCategoryInput.value = "";
  newCategoryInput.focus();
};
newCategoryInput.onkeydown = (e) => {
  if (e.key === "Enter") {
    addCategory(newCategoryInput.value);
    newCategoryInput.value = "";
  }
};