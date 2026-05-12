const searchInput = document.querySelector("#searchInput");
const searchLog = document.querySelector("#searchLog");
const loadDashboard = document.querySelector("#loadDashboard");
const dashboardResult = document.querySelector("#dashboardResult");
const operatorPicker = document.querySelector("#operatorPicker");
const operatorTitle = document.querySelector("#operatorTitle");
const operatorDescription = document.querySelector("#operatorDescription");
const runOperator = document.querySelector("#runOperator");
const timeline = document.querySelector("#timeline");

let activeSearchTimer = null;
let requestId = 0;
let selectedOperator = "map";
let simulationTimers = [];

const operatorInfo = {
  map: {
    title: "map",
    description: "แปลงข้อมูลที่ไหลผ่าน stream โดยไม่เปลี่ยนจังหวะเวลา เหมาะกับการแปลง API response เป็น view model",
    events: [
      ["0ms", "API emit ProductDto[]", "waiting"],
      ["20ms", "map แปลง name + price ให้เป็น label", "shared"],
      ["40ms", "UI ได้ ProductViewModel[]", "done"],
    ],
  },
  filter: {
    title: "filter",
    description: "ส่งต่อเฉพาะค่าที่ผ่านเงื่อนไข เหมาะกับการกัน keyword ที่สั้นเกินไปหรือกรองค่า null",
    events: [
      ["0ms", "keyword: a", "ignored"],
      ["120ms", "keyword: an", "done"],
      ["240ms", "keyword: ''", "ignored"],
      ["360ms", "keyword: angular", "done"],
    ],
  },
  tap: {
    title: "tap",
    description: "ทำงานเสริมโดยไม่เปลี่ยนค่าหลักใน stream เช่น log, analytics หรือ set loading",
    events: [
      ["0ms", "request เริ่ม", "waiting"],
      ["20ms", "tap: loading = true", "shared"],
      ["640ms", "response ผ่าน stream เหมือนเดิม", "done"],
      ["660ms", "tap: log debug info", "shared"],
    ],
  },
  startWith: {
    title: "startWith",
    description: "กำหนดค่าเริ่มต้นให้ stream emit ก่อนค่าจริงจะมาถึง เหมาะกับ combineLatest และ initial UI state",
    events: [
      ["0ms", "startWith('all') emit ค่าเริ่มต้น", "done"],
      ["420ms", "user เลือก category books", "shared"],
      ["840ms", "user เลือก category courses", "shared"],
    ],
  },
  debounceTime: {
    title: "debounceTime",
    description: "รอให้ stream เงียบช่วงหนึ่งก่อนปล่อยค่าล่าสุด เหมาะกับช่องค้นหาที่ไม่ควรเรียก API ทุกครั้งที่พิมพ์",
    events: [
      ["0ms", "user typed: a", "waiting"],
      ["120ms", "user typed: an", "waiting"],
      ["260ms", "user typed: angular", "waiting"],
      ["560ms", "ปล่อยค่า angular หลังหยุดพิมพ์ 300ms", "done"],
    ],
  },
  switchMap: {
    title: "switchMap",
    description: "เมื่อมีค่าใหม่เข้ามา จะยกเลิก inner Observable เดิมแล้วเริ่มงานใหม่ เหมาะกับ search และ route detail",
    events: [
      ["0ms", "request A เริ่ม", "waiting"],
      ["180ms", "request A ถูก cancel เพราะมีคำใหม่", "cancelled"],
      ["180ms", "request B เริ่ม", "waiting"],
      ["360ms", "request B ถูก cancel เพราะมีคำใหม่", "cancelled"],
      ["360ms", "request C เริ่มและเป็นผลลัพธ์สุดท้าย", "done"],
    ],
  },
  mergeMap: {
    title: "mergeMap",
    description: "แปลงแต่ละค่าเป็น async task แล้วปล่อยให้ทำพร้อมกัน เหมาะกับ upload หลายไฟล์หรืองานที่เป็นอิสระต่อกัน",
    events: [
      ["0ms", "upload file A เริ่ม", "waiting"],
      ["80ms", "upload file B เริ่มพร้อมกัน", "waiting"],
      ["140ms", "upload file C เริ่มพร้อมกัน", "waiting"],
      ["520ms", "file B เสร็จก่อน", "done"],
      ["760ms", "file A เสร็จ", "done"],
      ["980ms", "file C เสร็จ", "done"],
    ],
  },
  concatMap: {
    title: "concatMap",
    description: "จัดคิว async task ให้ทำทีละงานตามลำดับ เหมาะกับ save queue หรือคำสั่งที่ห้ามสลับลำดับ",
    events: [
      ["0ms", "save A เริ่ม", "waiting"],
      ["120ms", "save B เข้าคิว", "waiting"],
      ["240ms", "save C เข้าคิว", "waiting"],
      ["620ms", "save A เสร็จ แล้วเริ่ม B", "done"],
      ["980ms", "save B เสร็จ แล้วเริ่ม C", "done"],
      ["1280ms", "save C เสร็จ", "done"],
    ],
  },
  exhaustMap: {
    title: "exhaustMap",
    description: "ถ้างานเดิมยังไม่เสร็จ ค่าใหม่จะถูกเมิน เหมาะกับปุ่ม submit หรือ login ที่ต้องกันการกดซ้ำ",
    events: [
      ["0ms", "click submit ครั้งที่ 1 เริ่ม request", "waiting"],
      ["120ms", "click ครั้งที่ 2 ถูก ignore", "ignored"],
      ["280ms", "click ครั้งที่ 3 ถูก ignore", "ignored"],
      ["880ms", "request แรกเสร็จ รับ click ถัดไปได้", "done"],
    ],
  },
  forkJoin: {
    title: "forkJoin",
    description: "เริ่ม Observable หลายตัวพร้อมกัน แล้ว emit ครั้งเดียวเมื่อทุกตัว complete เหมาะกับ dashboard ที่ต้องโหลดหลาย API",
    events: [
      ["0ms", "profile$, orders$, alerts$ เริ่มพร้อมกัน", "waiting"],
      ["480ms", "profile$ complete", "done"],
      ["760ms", "alerts$ complete", "done"],
      ["1120ms", "orders$ complete", "done"],
      ["1120ms", "forkJoin emit object รวมทั้งหมด", "shared"],
    ],
  },
  combineLatest: {
    title: "combineLatest",
    description: "รวมค่าล่าสุดจากหลาย stream และ emit ใหม่เมื่อ stream ใด stream หนึ่งเปลี่ยน เหมาะกับ filter, sort และ data",
    events: [
      ["0ms", "products$ emit รายการสินค้า", "waiting"],
      ["220ms", "category$ emit all", "waiting"],
      ["420ms", "sort$ emit popular แล้ว combineLatest emit รอบแรก", "done"],
      ["900ms", "category$ เปลี่ยนเป็น books แล้ว emit ใหม่", "shared"],
      ["1260ms", "sort$ เปลี่ยนเป็น price แล้ว emit ใหม่", "shared"],
    ],
  },
  catchError: {
    title: "catchError",
    description: "จับ error ใน stream แล้วเปลี่ยนเป็น fallback Observable เพื่อให้ UI ยังแสดงผลต่อได้",
    events: [
      ["0ms", "request เริ่ม", "waiting"],
      ["520ms", "API error 500", "error"],
      ["540ms", "catchError คืนค่า fallback []", "shared"],
      ["560ms", "UI render empty state แทนหน้าพัง", "done"],
    ],
  },
  shareReplay: {
    title: "shareReplay",
    description: "แชร์ผลลัพธ์ Observable และส่งค่าล่าสุดให้ subscriber ใหม่ เหมาะกับการ cache HTTP response",
    events: [
      ["0ms", "Component A subscribe แล้ว HTTP เริ่ม", "waiting"],
      ["700ms", "HTTP complete และ cache response", "done"],
      ["900ms", "Component B subscribe", "shared"],
      ["900ms", "ได้ค่า cached ทันที ไม่ยิง HTTP ซ้ำ", "done"],
    ],
  },
};

function clearSimulationTimers() {
  simulationTimers.forEach((timer) => clearTimeout(timer));
  simulationTimers = [];
}

function eventRow(time, text, className) {
  const row = document.createElement("div");
  row.className = `event-row ${className}`;
  row.innerHTML = `<span>${time}</span><strong>${text}</strong>`;
  return row;
}

function renderOperatorInfo() {
  const info = operatorInfo[selectedOperator];
  operatorTitle.textContent = info.title;
  operatorDescription.textContent = info.description;
}

function runOperatorSimulation() {
  clearSimulationTimers();
  timeline.replaceChildren();
  const info = operatorInfo[selectedOperator];

  info.events.forEach(([time, text, className], index) => {
    const delay = index * 420;
    const timer = setTimeout(() => {
      timeline.append(eventRow(time, text, className));
    }, delay);
    simulationTimers.push(timer);
  });
}

function addLogRow(label, status, className) {
  const row = document.createElement("div");
  row.className = `log-row ${className}`;
  row.innerHTML = `<span>${label}</span><strong>${status}</strong>`;
  searchLog.prepend(row);
  return row;
}

function simulateSwitchMap(keyword) {
  requestId += 1;
  const currentId = requestId;

  if (activeSearchTimer) {
    clearTimeout(activeSearchTimer.timer);
    activeSearchTimer.row.classList.remove("active");
    activeSearchTimer.row.classList.add("cancelled");
    activeSearchTimer.row.querySelector("strong").textContent = "cancelled";
  }

  if (keyword.trim().length < 2) {
    addLogRow("รอคำค้นหาอย่างน้อย 2 ตัวอักษร", "idle", "");
    return;
  }

  const row = addLogRow(`request #${currentId}: "${keyword}"`, "loading", "active");
  const delay = 700 + Math.round(Math.random() * 900);

  activeSearchTimer = {
    row,
    timer: setTimeout(() => {
      row.classList.remove("active");
      row.classList.add("done");
      row.querySelector("strong").textContent = `done in ${delay}ms`;
      activeSearchTimer = null;
    }, delay),
  };
}

function debounce(fn, delay) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function metric(name, status, className = "") {
  const row = document.createElement("div");
  row.className = `metric ${className}`;
  row.innerHTML = `<span>${name}</span><strong>${status}</strong>`;
  return row;
}

function simulateForkJoin() {
  dashboardResult.replaceChildren();
  loadDashboard.disabled = true;
  loadDashboard.textContent = "Loading...";

  const sources = [
    { name: "profile$", delay: 650 },
    { name: "orders$", delay: 1100 },
    { name: "alerts$", delay: 840 },
  ];

  let completed = 0;
  sources.forEach((source) => {
    const row = metric(source.name, "loading");
    dashboardResult.append(row);
    setTimeout(() => {
      row.classList.add("done");
      row.querySelector("strong").textContent = `done in ${source.delay}ms`;
      completed += 1;

      if (completed === sources.length) {
        dashboardResult.append(metric("forkJoin result", "render dashboard", "done"));
        loadDashboard.disabled = false;
        loadDashboard.textContent = "Load dashboard data";
      }
    }, source.delay);
  });
}

function initOperatorPicker() {
  operatorPicker.querySelectorAll(".chip").forEach((button) => {
    button.addEventListener("click", () => {
      operatorPicker.querySelectorAll(".chip").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      selectedOperator = button.dataset.operator;
      renderOperatorInfo();
      runOperatorSimulation();
    });
  });
}

function initTabs() {
  document.querySelectorAll(".tab-btn").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((item) => item.classList.remove("active"));
      document.querySelectorAll(".code-panel").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      document.querySelector(`#${button.dataset.tab}`).classList.add("active");
    });
  });
}

function initCopyButtons() {
  document.querySelectorAll(".copy-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const code = button.closest(".code-panel").querySelector("code")?.textContent;
      if (!code) return;
      await navigator.clipboard.writeText(code);
      const original = button.textContent;
      button.textContent = "Copied";
      setTimeout(() => {
        button.textContent = original;
      }, 1200);
    });
  });
}

searchInput.addEventListener(
  "input",
  debounce((event) => simulateSwitchMap(event.target.value), 250)
);

loadDashboard.addEventListener("click", simulateForkJoin);
runOperator.addEventListener("click", runOperatorSimulation);

initOperatorPicker();
initTabs();
initCopyButtons();
renderOperatorInfo();
runOperatorSimulation();
simulateSwitchMap(searchInput.value);
simulateForkJoin();
