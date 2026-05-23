const STORAGE_KEY = "family_voice_bills_v1";
const MEMBERS_KEY = "family_voice_members_v1";
const ACTIVE_MEMBER_KEY = "family_voice_active_member_v1";

const expenseCategories = ["吃饭", "娱乐", "出行", "日常生活"];
const incomeCategories = ["工资", "红包", "转账", "退款", "其他收入"];
const paymentMethods = ["微信", "支付宝", "现金", "银行卡", "信用卡", "其他"];
const defaultMembers = ["我", "家人"];

const categoryKeywords = {
  吃饭: ["吃饭", "早餐", "早饭", "午饭", "午餐", "晚饭", "晚餐", "外卖", "咖啡", "奶茶", "零食", "火锅", "烧烤", "面", "米饭", "餐"],
  娱乐: ["音乐", "会员", "视频", "电影", "游戏", "演唱会", "书", "小说", "直播", "软件", "续费"],
  出行: ["地铁", "公交", "打车", "出租车", "高铁", "火车", "飞机", "加油", "停车", "骑行"],
  日常生活: ["超市", "购物", "衣服", "房租", "水费", "电费", "燃气", "手机费", "话费", "快递", "药", "医院", "维修"],
  工资: ["工资", "薪水", "发薪", "奖金", "绩效"],
  红包: ["红包", "压岁钱"],
  转账: ["转账", "收款", "到账"],
  退款: ["退款", "退回", "报销"],
};

const samples = [
  "我用微信花了20元吃饭",
  "支付宝续费音乐会员15元",
  "刚刚打车35",
  "微信收到红包88",
  "今天工资到账5000",
  "超市买东西花了80",
];

let currentMode = "expense";
let recognition = null;
let isRecording = false;
let recognitionTimer = null;
let pendingBill = null;

const elements = {
  expenseMode: document.querySelector("#expenseMode"),
  incomeMode: document.querySelector("#incomeMode"),
  dateLine: document.querySelector("#dateLine"),
  membersButton: document.querySelector("#membersButton"),
  manageMembersButton: document.querySelector("#manageMembersButton"),
  memberTabs: document.querySelector("#memberTabs"),
  inputPanel: document.querySelector(".input-panel"),
  voiceText: document.querySelector("#voiceText"),
  micButton: document.querySelector("#micButton"),
  speechHint: document.querySelector("#speechHint"),
  parseButton: document.querySelector("#parseButton"),
  sampleButton: document.querySelector("#sampleButton"),
  confirmPanel: document.querySelector("#confirmPanel"),
  reviewMessage: document.querySelector("#reviewMessage"),
  amountInput: document.querySelector("#amountInput"),
  typeInput: document.querySelector("#typeInput"),
  categoryInput: document.querySelector("#categoryInput"),
  paymentInput: document.querySelector("#paymentInput"),
  memberInput: document.querySelector("#memberInput"),
  noteInput: document.querySelector("#noteInput"),
  saveButton: document.querySelector("#saveButton"),
  cancelButton: document.querySelector("#cancelButton"),
  clearButton: document.querySelector("#clearButton"),
  exportButton: document.querySelector("#exportButton"),
  todayExpense: document.querySelector("#todayExpense"),
  monthExpense: document.querySelector("#monthExpense"),
  monthIncome: document.querySelector("#monthIncome"),
  billList: document.querySelector("#billList"),
  emptyState: document.querySelector("#emptyState"),
  categoryBars: document.querySelector("#categoryBars"),
  memberBars: document.querySelector("#memberBars"),
  memberDialog: document.querySelector("#memberDialog"),
  closeMembersButton: document.querySelector("#closeMembersButton"),
  memberNameInput: document.querySelector("#memberNameInput"),
  addMemberButton: document.querySelector("#addMemberButton"),
  memberList: document.querySelector("#memberList"),
  memberNameInlineInput: document.querySelector("#memberNameInlineInput"),
  addMemberInlineButton: document.querySelector("#addMemberInlineButton"),
  memberListInline: document.querySelector("#memberListInline"),
  appViews: document.querySelectorAll(".app-view"),
  dockTabs: document.querySelectorAll(".dock-tab"),
};

function loadBills() {
  try {
    const bills = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    let changed = false;
    bills.forEach((bill) => {
      if (!bill.id) {
        bill.id = createId();
        changed = true;
      }
    });
    if (changed) saveBills(bills);
    return bills;
  } catch {
    return [];
  }
}

function saveBills(bills) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bills));
}

function loadMembers() {
  try {
    const members = JSON.parse(localStorage.getItem(MEMBERS_KEY));
    return Array.isArray(members) && members.length ? members : defaultMembers;
  } catch {
    return defaultMembers;
  }
}

function saveMembers(members) {
  localStorage.setItem(MEMBERS_KEY, JSON.stringify(members));
}

function getActiveMember() {
  const members = loadMembers();
  const saved = localStorage.getItem(ACTIVE_MEMBER_KEY);
  return members.includes(saved) ? saved : members[0];
}

function setActiveMember(member) {
  localStorage.setItem(ACTIVE_MEMBER_KEY, member);
  render();
}

function setView(view) {
  elements.appViews.forEach((node) => {
    node.classList.toggle("active", node.dataset.view === view);
  });
  elements.dockTabs.forEach((node) => {
    node.classList.toggle("active", node.dataset.targetView === view);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function createId() {
  return crypto.randomUUID ? crypto.randomUUID() : `bill_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatMoney(amount) {
  return `¥${Number(amount || 0).toFixed(2)}`;
}

function isSameDay(dateA, dateB) {
  return dateA.toDateString() === dateB.toDateString();
}

function isSameMonth(dateA, dateB) {
  return dateA.getFullYear() === dateB.getFullYear() && dateA.getMonth() === dateB.getMonth();
}

function setMode(mode) {
  currentMode = mode;
  elements.expenseMode.classList.toggle("active", mode === "expense");
  elements.incomeMode.classList.toggle("active", mode === "income");
  elements.voiceText.placeholder = mode === "expense" ? "例如：我用微信花了20元吃饭" : "例如：今天工资到账5000";
}

function setRecording(recording, message) {
  isRecording = recording;
  elements.micButton.classList.toggle("recording", recording);
  elements.micButton.setAttribute("aria-label", recording ? "停止语音输入" : "语音输入");
  elements.micButton.title = recording ? "停止语音输入" : "语音输入";
  if (message) elements.speechHint.textContent = message;

  if (!recording && recognitionTimer) {
    clearTimeout(recognitionTimer);
    recognitionTimer = null;
  }
}

function stopRecognition() {
  if (!recognition || !isRecording) return;
  try {
    recognition.stop();
  } catch {
    setRecording(false, "语音输入已停止。");
  }
}

function fillSelect(select, options, value) {
  select.innerHTML = "";
  options.forEach((option) => {
    const node = document.createElement("option");
    node.value = option;
    node.textContent = option;
    node.selected = option === value;
    select.appendChild(node);
  });
}

function detectMember(text) {
  const members = loadMembers();
  return members.find((member) => member !== "我" && text.includes(member)) || getActiveMember();
}

function normalizeChineseNumber(text) {
  const map = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (/^\d+(\.\d+)?$/.test(text)) return Number(text);
  if (text.includes("百")) {
    const [hundreds, rest = ""] = text.split("百");
    return (map[hundreds] || 1) * 100 + (rest ? normalizeChineseNumber(rest) : 0);
  }
  if (text.includes("十")) {
    const [tens, ones = ""] = text.split("十");
    return (tens ? map[tens] : 1) * 10 + (ones ? map[ones] || 0 : 0);
  }
  return map[text] ?? null;
}

function extractAmount(text) {
  const digitMatch = text.match(/(\d+(?:\.\d+)?)(?:\s)*(?:元|块|块钱|人民币)?/);
  if (digitMatch) return Number(digitMatch[1]);

  const chineseMatch = text.match(/([零一二两三四五六七八九十百]+)(?:元|块|块钱|人民币)/);
  if (chineseMatch) return normalizeChineseNumber(chineseMatch[1]);

  return null;
}

function detectType(text) {
  if (/(收入|收到|收款|到账|工资|红包|退款|报销)/.test(text)) return "income";
  if (/(花了|花|买|付|支付|消费|续费|打车|吃|支出)/.test(text)) return "expense";
  return currentMode;
}

function detectPayment(text) {
  return paymentMethods.find((method) => method !== "其他" && text.includes(method)) || "其他";
}

function detectCategory(text, type) {
  const categories = type === "income" ? incomeCategories : expenseCategories;
  for (const category of categories) {
    const words = categoryKeywords[category] || [];
    if (words.some((word) => text.includes(word))) return category;
  }
  return type === "income" ? "其他收入" : "日常生活";
}

function buildNote(text, amount, paymentMethod) {
  const memberPattern = loadMembers().map((member) => member.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  let note = text
    .replace(/我|今天|刚刚|用了|用|通过|支付|支付宝|微信|现金|银行卡|信用卡/g, "")
    .replace(/花了|花|买了|买|消费|支出|收到|收入|到账/g, "")
    .replace(/\d+(?:\.\d+)?\s*(元|块|块钱|人民币)?/g, "")
    .replace(/[零一二两三四五六七八九十百]+(元|块|块钱|人民币)/g, "")
    .trim();

  if (memberPattern) {
    note = note.replace(new RegExp(memberPattern, "g"), "").trim();
  }

  if (!note) {
    note = paymentMethod === "其他" ? "未填写备注" : `${paymentMethod}记账`;
  }
  return note;
}

function parseBill(text) {
  const cleanText = text.trim();
  const type = detectType(cleanText);
  const amount = extractAmount(cleanText);
  const paymentMethod = detectPayment(cleanText);
  const category = detectCategory(cleanText, type);
  const member = detectMember(cleanText);
  const note = buildNote(cleanText, amount, paymentMethod);
  const missingFields = [];

  if (!amount) missingFields.push("amount");
  if (paymentMethod === "其他") missingFields.push("paymentMethod");

  return {
    id: createId(),
    type,
    amount,
    category,
    paymentMethod,
    member,
    note,
    rawText: cleanText,
    date: new Date().toISOString(),
    needsReview: missingFields.length > 0,
    missingFields,
  };
}

function showConfirmation(bill) {
  pendingBill = bill;
  const categories = bill.type === "income" ? incomeCategories : expenseCategories;

  elements.amountInput.value = bill.amount ?? "";
  elements.typeInput.value = bill.type;
  fillSelect(elements.categoryInput, categories, bill.category);
  fillSelect(elements.paymentInput, paymentMethods, bill.paymentMethod);
  fillSelect(elements.memberInput, loadMembers(), bill.member || getActiveMember());
  elements.noteInput.value = bill.note;

  if (bill.missingFields.includes("amount")) {
    elements.reviewMessage.textContent = "这句话里没有识别到金额，请补上金额后再保存。";
  } else if (bill.needsReview) {
    elements.reviewMessage.textContent = "有些信息不太确定，请确认后保存。";
  } else {
    elements.reviewMessage.textContent = "识别完成，确认无误就可以保存。";
  }
  elements.confirmPanel.classList.remove("hidden");
}

function addBillFromForm() {
  const amount = Number(elements.amountInput.value);
  if (!amount || amount <= 0) {
    elements.reviewMessage.textContent = "金额需要大于 0。";
    return;
  }

  const bill = {
    ...pendingBill,
    amount,
    type: elements.typeInput.value,
    category: elements.categoryInput.value,
    paymentMethod: elements.paymentInput.value,
    member: elements.memberInput.value,
    note: elements.noteInput.value.trim() || elements.categoryInput.value,
    needsReview: false,
    missingFields: [],
  };

  const bills = loadBills();
  bills.unshift(bill);
  saveBills(bills);
  elements.confirmPanel.classList.add("hidden");
  elements.voiceText.value = "";
  pendingBill = null;
  render();
  setView("home");
}

function deleteBill(id) {
  const bills = loadBills();
  const target = bills.find((bill) => bill.id === id);
  if (!target) return;

  const label = `${target.note || target.category} ${formatMoney(target.amount)}`;
  if (!confirm(`确定删除这笔账单吗？\n${label}`)) return;

  saveBills(bills.filter((bill) => bill.id !== id));
  render();
}

function renderSummary(bills) {
  const now = new Date();
  const todayExpense = bills
    .filter((bill) => bill.type === "expense" && isSameDay(new Date(bill.date), now))
    .reduce((sum, bill) => sum + Number(bill.amount), 0);
  const monthExpense = bills
    .filter((bill) => bill.type === "expense" && isSameMonth(new Date(bill.date), now))
    .reduce((sum, bill) => sum + Number(bill.amount), 0);
  const monthIncome = bills
    .filter((bill) => bill.type === "income" && isSameMonth(new Date(bill.date), now))
    .reduce((sum, bill) => sum + Number(bill.amount), 0);

  elements.todayExpense.textContent = formatMoney(todayExpense);
  elements.monthExpense.textContent = formatMoney(monthExpense);
  elements.monthIncome.textContent = formatMoney(monthIncome);
}

function renderMembers() {
  const members = loadMembers();
  const activeMember = getActiveMember();
  elements.memberTabs.innerHTML = "";
  elements.memberList.innerHTML = "";
  elements.memberListInline.innerHTML = "";

  members.forEach((member) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = `member-chip${member === activeMember ? " active" : ""}`;
    tab.textContent = member;
    tab.addEventListener("click", () => setActiveMember(member));
    elements.memberTabs.appendChild(tab);

    const item = document.createElement("li");
    item.className = "member-list-item";
    item.innerHTML = `
      <span>${escapeHtml(member)}</span>
      <button class="text-button" type="button" ${members.length <= 1 ? "disabled" : ""}>删除</button>
    `;
    item.querySelector("button").addEventListener("click", () => deleteMember(member));
    elements.memberList.appendChild(item);

    const inlineItem = item.cloneNode(true);
    inlineItem.querySelector("button").addEventListener("click", () => deleteMember(member));
    elements.memberListInline.appendChild(inlineItem);
  });
}

function renderBills(bills) {
  elements.billList.innerHTML = "";
  elements.emptyState.style.display = bills.length ? "none" : "block";

  bills.slice(0, 30).forEach((bill) => {
    const item = document.createElement("li");
    item.className = "bill-item";

    const date = new Date(bill.date);
    const sign = bill.type === "income" ? "+" : "-";
    const member = bill.member || "未分配";
    item.innerHTML = `
      <div class="bill-main">
        <strong>${escapeHtml(bill.note)}</strong>
        <span>${escapeHtml(member)} · ${escapeHtml(bill.category)} · ${escapeHtml(bill.paymentMethod)} · ${date.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
      </div>
      <div class="bill-side">
        <div class="bill-amount ${bill.type}">${sign}${formatMoney(bill.amount)}</div>
        <button class="delete-bill" type="button" title="删除账单" aria-label="删除账单">×</button>
      </div>
    `;
    item.querySelector(".delete-bill").addEventListener("click", () => deleteBill(bill.id));
    elements.billList.appendChild(item);
  });
}

function renderMemberBars(bills) {
  const now = new Date();
  const members = loadMembers();
  const totals = Object.fromEntries(members.map((member) => [member, 0]));
  bills
    .filter((bill) => bill.type === "expense" && isSameMonth(new Date(bill.date), now))
    .forEach((bill) => {
      const member = bill.member || "未分配";
      totals[member] = (totals[member] || 0) + Number(bill.amount);
    });

  const entries = Object.entries(totals);
  const max = Math.max(...entries.map(([, total]) => total), 1);
  elements.memberBars.innerHTML = "";

  entries.forEach(([member, total]) => {
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML = `
      <div class="bar-label">
        <span>${escapeHtml(member)}</span>
        <strong>${formatMoney(total)}</strong>
      </div>
      <div class="bar-track">
        <div class="bar-fill member-fill" style="width: ${(total / max) * 100}%"></div>
      </div>
    `;
    elements.memberBars.appendChild(row);
  });
}

function renderCategoryBars(bills) {
  const now = new Date();
  const totals = Object.fromEntries(expenseCategories.map((category) => [category, 0]));
  bills
    .filter((bill) => bill.type === "expense" && isSameMonth(new Date(bill.date), now))
    .forEach((bill) => {
      totals[bill.category] = (totals[bill.category] || 0) + Number(bill.amount);
    });

  const max = Math.max(...Object.values(totals), 1);
  elements.categoryBars.innerHTML = "";

  Object.entries(totals).forEach(([category, total]) => {
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML = `
      <div class="bar-label">
        <span>${category}</span>
        <strong>${formatMoney(total)}</strong>
      </div>
      <div class="bar-track">
        <div class="bar-fill" style="width: ${(total / max) * 100}%"></div>
      </div>
    `;
    elements.categoryBars.appendChild(row);
  });
}

function render() {
  const bills = loadBills();
  elements.dateLine.textContent = new Date().toLocaleDateString("zh-CN", { weekday: "long", month: "long", day: "numeric" });
  renderMembers();
  renderSummary(bills);
  renderBills(bills);
  renderCategoryBars(bills);
  renderMemberBars(bills);
}

function openMemberDialog() {
  elements.memberDialog.classList.remove("hidden");
  elements.memberNameInput.focus();
}

function closeMemberDialog() {
  elements.memberDialog.classList.add("hidden");
  elements.memberNameInput.value = "";
}

function addMember() {
  const name = elements.memberNameInput.value.trim() || elements.memberNameInlineInput.value.trim();
  if (!name) return;

  const members = loadMembers();
  if (!members.includes(name)) {
    members.push(name);
    saveMembers(members);
    setActiveMember(name);
  }
  elements.memberNameInput.value = "";
  elements.memberNameInlineInput.value = "";
  render();
}

function deleteMember(member) {
  const members = loadMembers();
  if (members.length <= 1) return;

  const nextMembers = members.filter((item) => item !== member);
  saveMembers(nextMembers);
  if (getActiveMember() === member) {
    localStorage.setItem(ACTIVE_MEMBER_KEY, nextMembers[0]);
  }
  render();
}

function setupSpeech() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    elements.speechHint.textContent = "当前浏览器不支持网页语音识别，可以先手动输入。";
    elements.micButton.disabled = true;
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "zh-CN";
  recognition.interimResults = false;
  recognition.continuous = false;

  recognition.onstart = () => {
    setRecording(true, "正在听你说话，识别到一句后会自动停止。");
    recognitionTimer = setTimeout(() => {
      stopRecognition();
      elements.speechHint.textContent = "已自动停止，如果没识别到可以再点一次。";
    }, 10000);
  };

  recognition.onresult = (event) => {
    const text = event.results[0][0].transcript;
    elements.voiceText.value = text;
    elements.speechHint.textContent = "识别完成，可以解析账单。";
    stopRecognition();
  };

  recognition.onerror = () => {
    elements.speechHint.textContent = "语音识别失败，可以再试一次或直接打字。";
    setRecording(false);
  };

  recognition.onend = () => {
    setRecording(false);
  };
}

function exportBills() {
  const bills = loadBills();
  if (!bills.length) return;

  const header = ["时间", "成员", "类型", "金额", "分类", "支付方式", "备注", "原文"];
  const rows = bills.map((bill) => [
    new Date(bill.date).toLocaleString("zh-CN"),
    bill.member || "未分配",
    bill.type === "income" ? "收入" : "支出",
    bill.amount,
    bill.category,
    bill.paymentMethod,
    bill.note,
    bill.rawText,
  ]);
  const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "语音记账导出.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

elements.expenseMode.addEventListener("click", () => setMode("expense"));
elements.incomeMode.addEventListener("click", () => setMode("income"));
elements.membersButton.addEventListener("click", openMemberDialog);
elements.manageMembersButton.addEventListener("click", () => setView("members"));
elements.parseButton.addEventListener("click", () => {
  const text = elements.voiceText.value.trim();
  if (!text) {
    elements.speechHint.textContent = "先说一句或输入一句账单。";
    return;
  }
  showConfirmation(parseBill(text));
});
elements.sampleButton.addEventListener("click", () => {
  const sample = samples[Math.floor(Math.random() * samples.length)];
  elements.voiceText.value = sample;
  showConfirmation(parseBill(sample));
});
elements.micButton.addEventListener("click", () => {
  if (!recognition) return;
  if (isRecording) {
    stopRecognition();
    elements.speechHint.textContent = "语音输入已停止。";
    return;
  }
  try {
    recognition.start();
  } catch {
    elements.speechHint.textContent = "语音识别正在准备中，请稍后再试。";
  }
});
elements.typeInput.addEventListener("change", () => {
  const type = elements.typeInput.value;
  fillSelect(elements.categoryInput, type === "income" ? incomeCategories : expenseCategories, type === "income" ? "其他收入" : "日常生活");
});
elements.saveButton.addEventListener("click", addBillFromForm);
elements.cancelButton.addEventListener("click", () => elements.confirmPanel.classList.add("hidden"));
elements.closeMembersButton.addEventListener("click", closeMemberDialog);
elements.addMemberButton.addEventListener("click", addMember);
elements.addMemberInlineButton.addEventListener("click", addMember);
elements.memberNameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") addMember();
});
elements.memberNameInlineInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") addMember();
});
elements.dockTabs.forEach((button) => {
  button.addEventListener("click", () => {
    setView(button.dataset.targetView);
    if (button.dataset.targetView === "record") {
      setTimeout(() => elements.voiceText.focus(), 250);
    }
  });
});
elements.clearButton.addEventListener("click", () => {
  if (confirm("确定清空所有账单吗？")) {
    saveBills([]);
    render();
  }
});
elements.exportButton.addEventListener("click", exportBills);

setMode("expense");
setupSpeech();
render();

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopRecognition();
});
