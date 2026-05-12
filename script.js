const searchInput = document.querySelector("#searchInput");
const searchLog = document.querySelector("#searchLog");
const loadDashboard = document.querySelector("#loadDashboard");
const dashboardResult = document.querySelector("#dashboardResult");
const operatorPicker = document.querySelector("#operatorPicker");
const operatorTitle = document.querySelector("#operatorTitle");
const operatorDescription = document.querySelector("#operatorDescription");
const runOperator = document.querySelector("#runOperator");
const timeline = document.querySelector("#timeline");
const demoPaywallButton = document.querySelector("#demoPaywallButton");
const paymentModal = document.querySelector("#paymentModal");
const fakePayButton = document.querySelector("#fakePayButton");
const checkoutForm = document.querySelector("#checkoutForm");
const paymentStatus = document.querySelector("#paymentStatus");

let activeSearchTimer = null;
let requestId = 0;
let selectedOperator = "map";
let simulationTimers = [];

const operatorInfo = {
  map: {
    title: "map",
    description: "ใช้แปลงค่าที่ได้จาก stream เป็นค่าใหม่ เช่น เลือกเฉพาะ field ที่ต้องใช้ หรือคำนวณค่าเพิ่มก่อนส่งต่อ",
    events: [
      ["ก่อน", "API ส่งรายการสินค้าแบบ raw data", "waiting"],
      ["map", "เลือก id, name และคำนวณ priceWithVat", "shared"],
      ["หลัง", "component ได้ object ใหม่ที่ใช้แสดงผลได้ตรงขึ้น", "done"],
    ],
  },
  filter: {
    title: "filter",
    description: "ใช้คัดค่าที่ไม่ต้องการออกจาก stream ถ้าเงื่อนไขเป็นจริงค่านั้นจะไปต่อ ถ้าไม่จริงจะถูกข้าม",
    events: [
      ["input", "พิมพ์ 'a' สั้นเกินไป ไม่ค้นหา", "ignored"],
      ["input", "พิมพ์ 'an' ผ่านเงื่อนไข length >= 2", "done"],
      ["input", "ค่าว่างถูกข้าม", "ignored"],
      ["input", "พิมพ์ 'angular' ส่งต่อไปเรียก API", "done"],
    ],
  },
  tap: {
    title: "tap",
    description: "ใช้ทำงานแทรกระหว่างทาง เช่น log หรือเปิด loading โดยไม่เปลี่ยนค่าที่ส่งต่อไปยัง operator ถัดไป",
    events: [
      ["เริ่ม", "เรียก API โหลดสินค้า", "waiting"],
      ["tap", "ตั้ง loading = true", "shared"],
      ["response", "ข้อมูลสินค้ายังเป็นชุดเดิม ไม่ถูกแก้", "done"],
      ["tap", "log จำนวนสินค้าที่โหลดได้", "shared"],
    ],
  },
  startWith: {
    title: "startWith",
    description: "ใช้ใส่ค่าเริ่มต้นให้ stream ทันที เช่น filter เริ่มต้นเป็น 'all' ก่อนผู้ใช้เลือกค่าเอง",
    events: [
      ["เริ่มหน้า", "ใช้ค่า category = 'all'", "done"],
      ["ผู้ใช้เลือก", "category เปลี่ยนเป็น 'books'", "shared"],
      ["ผู้ใช้เลือก", "category เปลี่ยนเป็น 'courses'", "shared"],
    ],
  },
  debounceTime: {
    title: "debounceTime",
    description: "ใช้รอให้ source หยุดส่งค่าช่วงหนึ่ง แล้วค่อยปล่อยค่าล่าสุด เหมาะกับ input ที่เปลี่ยนถี่",
    events: [
      ["พิมพ์", "a", "waiting"],
      ["พิมพ์ต่อ", "an", "waiting"],
      ["พิมพ์ต่อ", "angular", "waiting"],
      ["หยุดพิมพ์", "ส่งค่า 'angular' ไปค้นหา", "done"],
    ],
  },
  switchMap: {
    title: "switchMap",
    description: "ใช้เมื่อค่าใหม่ควรแทนงานเก่า เช่น search หรือ route detail ถ้ามีค่าใหม่เข้ามาจะยกเลิก request เดิม",
    events: [
      ["ค้นหา", "คำว่า 'a' เริ่ม request แรก", "waiting"],
      ["พิมพ์ใหม่", "request แรกถูกยกเลิก", "cancelled"],
      ["ค้นหา", "คำว่า 'an' เริ่ม request ใหม่", "waiting"],
      ["พิมพ์ใหม่", "request 'an' ถูกยกเลิก", "cancelled"],
      ["ล่าสุด", "ใช้ผลลัพธ์ของคำว่า 'angular'", "done"],
    ],
  },
  mergeMap: {
    title: "mergeMap",
    description: "ใช้เมื่อทุกค่าที่เข้ามาควรถูกนำไปทำงาน และงานเหล่านั้นทำพร้อมกันได้ เช่น upload หลายไฟล์",
    events: [
      ["เริ่ม", "upload file A", "waiting"],
      ["เริ่ม", "upload file B พร้อมกัน", "waiting"],
      ["เริ่ม", "upload file C พร้อมกัน", "waiting"],
      ["เสร็จ", "file B เสร็จก่อนก็ส่งผลลัพธ์ก่อนได้", "done"],
      ["เสร็จ", "file A เสร็จ", "done"],
      ["เสร็จ", "file C เสร็จ", "done"],
    ],
  },
  concatMap: {
    title: "concatMap",
    description: "ใช้เมื่อทุกค่าต้องถูกนำไปทำงานแบบเรียงลำดับ งานถัดไปจะรอให้งานก่อนหน้าเสร็จก่อน",
    events: [
      ["เริ่ม", "save A", "waiting"],
      ["รอคิว", "save B ยังไม่เริ่ม", "waiting"],
      ["รอคิว", "save C ยังไม่เริ่ม", "waiting"],
      ["ต่อคิว", "save A เสร็จ แล้วค่อยเริ่ม B", "done"],
      ["ต่อคิว", "save B เสร็จ แล้วค่อยเริ่ม C", "done"],
      ["จบ", "save C เสร็จ", "done"],
    ],
  },
  exhaustMap: {
    title: "exhaustMap",
    description: "ใช้เมื่อไม่ต้องการเริ่มงานใหม่ระหว่างที่งานเดิมยังไม่เสร็จ เช่นปุ่ม login หรือ submit",
    events: [
      ["click", "ครั้งที่ 1 เริ่ม login request", "waiting"],
      ["click", "ครั้งที่ 2 ถูกข้าม เพราะ request แรกยังไม่เสร็จ", "ignored"],
      ["click", "ครั้งที่ 3 ถูกข้ามเช่นกัน", "ignored"],
      ["เสร็จ", "request แรกจบแล้ว จึงรับ click ใหม่ได้", "done"],
    ],
  },
  forkJoin: {
    title: "forkJoin",
    description: "ใช้รวม Observable หลายตัวที่ต้อง complete ทั้งหมดก่อน จึงค่อยส่งผลลัพธ์รวมออกมา",
    events: [
      ["เริ่ม", "โหลด profile, orders และ alerts พร้อมกัน", "waiting"],
      ["เสร็จ", "profile โหลดเสร็จ", "done"],
      ["เสร็จ", "alerts โหลดเสร็จ", "done"],
      ["เสร็จ", "orders โหลดเสร็จ", "done"],
      ["รวมผล", "ได้ข้อมูลครบแล้วค่อย render dashboard", "shared"],
    ],
  },
  combineLatest: {
    title: "combineLatest",
    description: "ใช้รวมค่าล่าสุดจากหลาย stream แล้วคำนวณผลลัพธ์ใหม่ทุกครั้งที่ stream ใด stream หนึ่งเปลี่ยน",
    events: [
      ["data", "products โหลดเสร็จ", "waiting"],
      ["filter", "category เริ่มต้นเป็น all", "waiting"],
      ["sort", "sort เริ่มต้นเป็น popular แล้วแสดงรายการครั้งแรก", "done"],
      ["filter", "category เปลี่ยนเป็น books จึงคำนวณใหม่", "shared"],
      ["sort", "sort เปลี่ยนเป็น price จึงคำนวณใหม่", "shared"],
    ],
  },
  catchError: {
    title: "catchError",
    description: "ใช้ดัก error แล้วคืน Observable สำรอง เช่น of([]) หรือ of(null) เพื่อให้ flow ไปต่อได้",
    events: [
      ["เริ่ม", "เรียก API โหลดสินค้า", "waiting"],
      ["error", "API ตอบกลับ 500", "error"],
      ["fallback", "catchError คืนค่า []", "shared"],
      ["แสดงผล", "หน้าเว็บแสดง empty state แทนการล้ม", "done"],
    ],
  },
  shareReplay: {
    title: "shareReplay",
    description: "ใช้แชร์การ subscribe และส่งค่าล่าสุดให้ subscriber ใหม่ เหมาะกับข้อมูลที่หลาย component ใช้ร่วมกัน",
    events: [
      ["A", "Component A ขอข้อมูล user", "waiting"],
      ["API", "HTTP โหลดเสร็จ และจำค่าล่าสุดไว้", "done"],
      ["B", "Component B ขอข้อมูล user ทีหลัง", "shared"],
      ["cache", "Component B ได้ค่าเดิมทันที ไม่ต้องเรียก API ซ้ำ", "done"],
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

function openPaymentModal() {
  paymentModal.classList.add("open");
  paymentModal.setAttribute("aria-hidden", "false");
  paymentStatus.textContent = "";
  document.querySelector("#cardName").focus();
}

function closePaymentModal(scrollToDemo = true) {
  paymentModal.classList.remove("open");
  paymentModal.setAttribute("aria-hidden", "true");

  if (scrollToDemo) {
    document.querySelector("#playground").scrollIntoView({ behavior: "smooth" });
  }
}

function confirmFakePayment(event) {
  event.preventDefault();
  fakePayButton.disabled = true;
  fakePayButton.textContent = "กำลังยืนยัน...";
  paymentStatus.textContent = "กำลังตรวจสอบข้อมูล";

  setTimeout(() => {
    paymentStatus.textContent = "ยืนยันสำเร็จ";
    fakePayButton.textContent = "สำเร็จ กำลังพาไปต่อ";

    setTimeout(() => {
      fakePayButton.disabled = false;
      fakePayButton.textContent = "ยืนยันการชำระเงิน";
      closePaymentModal(true);
    }, 800);
  }, 850);
}

searchInput.addEventListener(
  "input",
  debounce((event) => simulateSwitchMap(event.target.value), 250)
);

loadDashboard.addEventListener("click", simulateForkJoin);
runOperator.addEventListener("click", runOperatorSimulation);
demoPaywallButton.addEventListener("click", (event) => {
  event.preventDefault();
  openPaymentModal();
});
checkoutForm.addEventListener("submit", confirmFakePayment);
document.querySelectorAll("[data-close-payment]").forEach((button) => {
  button.addEventListener("click", () => closePaymentModal(true));
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && paymentModal.classList.contains("open")) {
    closePaymentModal(false);
  }
});

initOperatorPicker();
initTabs();
initCopyButtons();
renderOperatorInfo();
runOperatorSimulation();
simulateSwitchMap(searchInput.value);
simulateForkJoin();
