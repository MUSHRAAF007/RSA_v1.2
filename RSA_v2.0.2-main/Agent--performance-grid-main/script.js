// ─── CONFIGURATION ───────────────────────────────────────
const CONFIG = {
  REFRESH_INTERVAL: 5000,
  // Replace with the NEW V7 APPS_SCRIPT_URL you just deployed
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbxAokyL2d1ssv0bn3hXf2wfwTt0jZ3l_VzjGawpJEChPilNswxgSFTgOqRwLA1I3uhE/exec",
};

// ─── IMAGE MAPPING UTILITY ──────────────────────────────
const AVAILABLE_IMAGES = [
  "Abhinav.jpeg", "Ankit Kumar Yadhav.jpeg", "Ansari.jpeg", "Anurag.jpeg",
  "Balram.jpeg", "Chandra Jyothi.jpeg", "Devanayagan.jpeg", "Gopal.jpeg",
  "Jabeena.jpeg", "Jaidev.jpeg", "Jayant.jpeg", "Lokesh.jpeg", "Loogaseelan.jpeg",
  "Manish.jpeg", "Mukesh Pandit.jpeg", "Navin.jpeg", "Pintu Verma.jpeg", 
  "Rasmita.jpeg", "Reshma.jpeg", "Roushan.jpeg", "SUNAYNA.jpeg", "Sajan.jpeg", 
  "Salma Nisha.jpeg", "Subhani.jpeg", "Tara.jpeg", "Thanveer.jpeg", "Vikash Kumar.jpeg", 
  "nilanjana.jpeg", "sri sai.jpeg"
];

// Map tricky names to their exact image filenames
const NAME_PHOTO_MAP = {
  "ankit": "Ankit Kumar Yadhav.jpeg",
  "abhinav": "Abhinav.jpeg",
  "sunayna": "SUNAYNA.jpeg",
  "logaseelan": "Loogaseelan.jpeg",
  "jai dev": "Jaidev.jpeg",
  "salma nisha": "Salma Nisha.jpeg",
  "tara sharma": "Tara.jpeg",
  "subhani shaik": "Subhani.jpeg",
  "tanveer": "Thanveer.jpeg",
  "sri sai": "sri sai.jpeg",
  "nilanjana": "nilanjana.jpeg",
  "mukesh": "Mukesh Pandit.jpeg",
  "pintu": "Pintu Verma.jpeg",
  "vikash": "Vikash Kumar.jpeg",
  "chandra": "Chandra Jyothi.jpeg"
};

function getAgentPhoto(name) {
  if (!name) return 'img/default.jpeg';

  let lowerName = name.toLowerCase().trim();

  // 1. Try explicit mapping first (catches mismatches like Tanveer -> Thanveer or Salma Nisha -> Salmaa)
  if (NAME_PHOTO_MAP[lowerName]) {
    return `img/${NAME_PHOTO_MAP[lowerName]}`;
  }

  let normalizedName = lowerName.replace(/[^a-z0-9]/g, '');

  // 2. Try exact match (without spaces/symbols)
  for (let img of AVAILABLE_IMAGES) {
    let normalizedImg = img.split('.')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normalizedImg === normalizedName) {
      return `img/${img}`;
    }
  }

  // 3. Try First-Name based match (safer than checking if one word contains another)
  let firstName = lowerName.split(' ')[0].replace(/[^a-z0-9]/g, '');
  if (firstName.length > 2) {
    for (let img of AVAILABLE_IMAGES) {
      let normalizedImg = img.split('.')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normalizedImg.startsWith(firstName) || firstName.startsWith(normalizedImg)) {
        return `img/${img}`;
      }
    }
  }

  // 4. Fallback to just the name.jpeg
  return `img/${name}.jpeg`;
}

// ─── MOCK DATA GENERATOR ─────────────────────────────────
// Simulating data that would come from Google Sheets
const AGENT_NAMES = [
  "Vikram Singh", "Priya Sharma", "Rahul Verma", "Anjali Gupta",
  "Amit Patel", "Sneha Reddy", "Karan Malhotra", "Riya Kapoor"
];

// Generate random stats for agents
function generateAgentData() {
  return AGENT_NAMES.map((name, index) => {
    // Randomize stats to simulate live changes
    const ros = Math.floor(Math.random() * 15) + 5;
    const towing = Math.floor(Math.random() * 8) + 2;
    const assigned = Math.floor(Math.random() * 5);
    const dealer = Math.floor(Math.random() * 4);
    const failed = Math.floor(Math.random() * 2);
    const total = ros + towing + assigned + dealer + failed;

    // Calculate efficiency
    const efficiency = Math.round((ros / total) * 100);

    // Determine status
    let status = 'online';
    if (assigned > 2) status = 'busy';
    if (total < 5) status = 'offline';

    return {
      id: index,
      name: name,
      stats: {
        total: total,
        ros: ros,
        towing: towing,
        assigned: assigned,
        dealer: dealer,
        failed: failed
      },
      efficiency: efficiency,
      status: status
    };
  }); // Removed sort to stop swapping of agent grid
}

let globalAgents = [];
let activeDisplayedAlerts = new Set(); // track timestamps so we don't duplicate rendering

// ─── GOOGLE SHEETS & ALERTS INTEGRATION ──────────────────
async function fetchData() {
  if (!CONFIG.APPS_SCRIPT_URL) {
    return { agents: generateAgentData(), alerts: [] };
  }

  try {
    const response = await fetch(CONFIG.APPS_SCRIPT_URL);
    if (!response.ok) throw new Error("Network error");

    // The new V7 script returns: { agents: [...], alerts: [...] }
    const json = await response.json();

    // Safety check just in case we hit an old cache version
    const agentRawData = json.agents ? json.agents : json;
    const alertsRawData = json.alerts ? json.alerts : [];

    const agents = agentRawData
      .filter(row => row['Name'] && row['Name'].trim().toLowerCase() !== 'name')
      .map((row, index) => {
        const ros = parseInt(row['ROS'] || 0, 10);
        const towing = parseInt(row['Towing'] || 0, 10);
        const assigned = parseInt(row['Assigned'] || 0, 10);
        const dealer = parseInt(row['Dealer'] || 0, 10);
        const failed = parseInt(row['Failed'] || 0, 10);
        
        const total = row['TotalCases'] !== undefined ? parseInt(row['TotalCases'], 10) : (ros + towing + assigned + dealer + failed);
        const efficiency = total > 0 ? Math.round((ros / total) * 100) : 0;
        
        let status = 'online';
        if (assigned > 2) status = 'busy';
        if (total < 5) status = 'offline';
        
        return {
          id: index,
          name: row['Name'] || `Agent ${index + 1}`,
          lastPickTime: row['Date'] || row['LastPickTime'] || null, 
          stats: {
            total: total,
            ros: ros,
            towing: towing,
            assigned: assigned,
            dealer: dealer,
            failed: failed,
            ongoing: parseInt(row['ON GOING'] || 0, 10),
            escalation: parseInt(row['possible escalation'] || 0, 10),
            cancelled: parseInt(row['CANCELLED'] || 0, 10),
            postponed: parseInt(row['POSTPONED'] || 0, 10),
            closed: parseInt(row['CLOSED'] || 0, 10),
            preclose: parseInt(row['PRECLOSE'] || 0, 10)
          },
          efficiency: efficiency,
          status: status
        };
      });

    return {
      agents: agents.length ? agents : generateAgentData(),
      alerts: alertsRawData
    };
  } catch (error) {
    console.error("Fetch Error:", error);
    return { agents: generateAgentData(), alerts: [] };
  }
}

let clearedLiveAlerts = new Map(); // store cleared LIVE_* alerts with timestamps
let alertQueue = []; // Queue for pending alerts
let activeVisibleAlertsCount = 0; // Track how many are physically on screen
const MAX_VISIBLE_ALERTS = 3; // limit simultaneous visible alerts to prevent scrolling issues

function processAlertQueue() {
    // Only pop new alerts if we have room on screen and items waiting
    while (activeVisibleAlertsCount < MAX_VISIBLE_ALERTS && alertQueue.length > 0) {
        const nextAlert = alertQueue.shift();
        displayAlertImmediately(nextAlert);
    }
}

// ─── ALERT DISPLAY LOGIC ─────────────────────────────────
function renderAlert(alertObj) {
  // Ignore if it's already actively processing or queued
  if (activeDisplayedAlerts.has(alertObj.timestamp)) return;
  
  // If it was cleared before, ensure it's been at least 5 minutes (300,000 ms) before popping it up again
  if (clearedLiveAlerts.has(alertObj.timestamp)) {
      const timeCleared = clearedLiveAlerts.get(alertObj.timestamp);
      if ((Date.now() - timeCleared) < 300000) {
          return; 
      } else {
          clearedLiveAlerts.delete(alertObj.timestamp);
      }
  }
  
  // Mark as actively handled so future polls don't double count it
  activeDisplayedAlerts.add(alertObj.timestamp); 
  
  // PRIORITY HANDLING:
  // 1. Escalations (Cross-matches)
  // 2. Manual Dispatches (TL/Supervisor alerts from 'Alerts' sheet - no 'LIVE_' prefix)
  const isManualDispatch = !String(alertObj.timestamp).startsWith('LIVE_');

  if (alertObj.isEscalation || isManualDispatch) {
    if (alertObj.isEscalation) {
        displayFullScreenEscalation(alertObj);
    } else {
        // Manual dispatches pop up instantly even if queue is full
        displayAlertImmediately(alertObj); 
    }
    return;
  }
  
  // Standard dynamic alerts go to the queue
  alertQueue.push(alertObj);
  processAlertQueue();
}

let escalationQueue = [];
let isEscalationShowing = false;

function displayFullScreenEscalation(alertObj) {
  if (isEscalationShowing) {
    escalationQueue.push(alertObj);
    return;
  }
  
  isEscalationShowing = true;
  
  const modalId = `esc-modal-${alertObj.timestamp}`;
  const modal = document.createElement('div');
  modal.id = modalId;
  modal.className = "fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-2xl p-4 transition-opacity duration-500 opacity-0 pointer-events-auto";
  
  modal.innerHTML = `
    <div class="bg-red-950/80 border border-red-600 rounded-[2.5rem] p-6 sm:p-10 max-w-2xl w-full text-center shadow-[0_0_100px_rgba(220,38,38,0.3)] transform scale-95 opacity-0 transition-all duration-500 relative overflow-hidden" id="esc-content-${alertObj.timestamp}">
      
      <!-- Blurry Red Glow Background -->
      <div class="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(220,38,38,0.2)_0%,transparent_70%)] pointer-events-none"></div>

      <div class="relative z-10 flex justify-center mb-6">
        <div class="w-20 h-20 sm:w-24 sm:h-24 bg-red-500/20 rounded-full flex items-center justify-center border-4 border-red-500 animate-pulse shadow-[0_0_30px_rgba(239,68,68,0.6)]">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-10 h-10 sm:w-12 sm:h-12 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
        </div>
      </div>

      <h2 class="relative z-10 text-3xl sm:text-4xl md:text-5xl font-heading font-black text-white tracking-wider mb-2 uppercase drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]">⚠️ ESCALATION ALERT</h2>
      <h3 class="relative z-10 text-xl sm:text-2xl font-heading font-bold text-red-400 tracking-widest mb-8 uppercase">HANDLE WITH CARE</h3>

      <div class="relative z-10 space-y-3 sm:space-y-4 mb-8 text-left bg-black/60 p-4 sm:p-6 rounded-2xl border border-red-500/30 shadow-[inset_0_1px_5px_rgba(0,0,0,0.5)]">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-red-500/20 pb-3 gap-1 sm:gap-0">
          <span class="text-red-300/80 font-heading tracking-widest text-xs sm:text-sm uppercase font-bold">Agent Name:</span>
          <span class="text-white font-bold text-lg sm:text-xl uppercase">${alertObj.agentName}</span>
        </div>
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-red-500/20 pb-3 gap-1 sm:gap-0">
          <span class="text-red-300/80 font-heading tracking-widest text-xs sm:text-sm uppercase font-bold">Vehicle Number:</span>
          <span class="text-white font-mono font-black text-xl sm:text-2xl drop-shadow-[0_0_10px_rgba(255,255,255,0.4)] bg-red-500/20 px-3 py-1 rounded-lg border border-red-500/30">${alertObj.vehicleNumber}</span>
        </div>
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center pt-1 gap-1 sm:gap-0">
          <span class="text-red-300/80 font-heading tracking-widest text-xs sm:text-sm uppercase font-bold">Escalation Level:</span>
          <span class="text-red-500 font-bold text-lg sm:text-xl uppercase drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]">${alertObj.requirement}</span>
        </div>
      </div>

      <div class="relative z-10 text-red-100/90 font-body text-sm sm:text-base mb-8 leading-relaxed max-w-xl mx-auto">
        <p class="mb-2 tracking-wide font-medium">This vehicle already has an escalation history.</p>
        <p class="mb-4 tracking-wide text-white/80">Agent <strong class="text-white font-bold underline decoration-red-500 underline-offset-4">${alertObj.agentName}</strong> must handle this case carefully.</p>
        <div class="inline-block px-4 py-2 bg-red-500/20 text-red-400 font-heading font-black tracking-widest rounded-lg border border-red-500/30">THIS IS A PRIORITY ESCALATION CASE</div>
      </div>

      <button onclick="closeEscalationModal('${alertObj.timestamp}')" class="relative z-10 w-full sm:w-auto px-10 py-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-heading font-black tracking-widest rounded-xl transition-all hover:scale-105 active:scale-95 shadow-[0_0_40px_rgba(239,68,68,0.5)] border border-red-400 inline-block focus:outline-none" id="esc-btn-${alertObj.timestamp}">
        ACKNOWLEDGE PRIORITY (30s)
      </button>

    </div>
  `;

  document.body.appendChild(modal);

  // Trigger animations
  requestAnimationFrame(() => {
    modal.classList.remove('opacity-0');
    const content = document.getElementById(`esc-content-${alertObj.timestamp}`);
    if (content) {
      content.classList.remove('scale-95', 'opacity-0');
      content.classList.add('scale-100');
    }
  });
  
  // Start internal countdown for the visual timer (30 seconds)
  let timeLeft = 30;
  const btnLabel = document.getElementById(`esc-btn-${alertObj.timestamp}`);
  const countdownInterval = setInterval(() => {
    timeLeft--;
    if (btnLabel) btnLabel.textContent = `ACKNOWLEDGE PRIORITY (${timeLeft}s)`;
    if (timeLeft <= 0) clearInterval(countdownInterval);
  }, 1000);

  // Auto-acknowledge after 30 seconds
  setTimeout(() => {
    clearInterval(countdownInterval);
    closeEscalationModal(alertObj.timestamp);
  }, 30000);
}

window.closeEscalationModal = function(timestampId) {
  const modal = document.getElementById(`esc-modal-${timestampId}`);
  if (modal) {
    modal.classList.add('opacity-0');
    const content = document.getElementById(`esc-content-${timestampId}`);
    if(content) content.classList.replace('scale-100', 'scale-95');
    
    // Throttle for 2 minutes just like standard LIVE_ alerts
    clearedLiveAlerts.set(timestampId, Date.now()); 
    
    setTimeout(() => {
      modal.remove();
      isEscalationShowing = false;
      if (escalationQueue.length > 0) {
         const nextEsc = escalationQueue.shift();
         // Small delay before next to allow smooth visual reset
         setTimeout(() => displayFullScreenEscalation(nextEsc), 500);
      }
    }, 500);
  }
}

// The actual DOM rendering function isolated from the basic checks
function displayAlertImmediately(alertObj) {
  activeVisibleAlertsCount++;

  // Dynamic SVG icons mapping to alert states
  const ICONS = {
    WRENCH: `<svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 sm:w-8 sm:h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>`,
    TRUCK: `<svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 sm:w-8 sm:h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>`,
    BUILDING: `<svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 sm:w-8 sm:h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`,
    SHIELD_ALERT: `<svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 sm:w-8 sm:h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`,
    ALERT_TRIANGLE: `<svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 sm:w-8 sm:h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`
  };

  const THEME_MAP = {
    "TECH UNASSIGNED": { icon: ICONS.WRENCH, border: "border-rose-500", glow: "shadow-[0_0_80px_rgba(244,63,94,0.4)]", gradFrom: "from-rose-600", gradVia: "via-rose-500", gradTo: "to-rose-600", textLight: "text-rose-100", reqSel: "selection:bg-rose-100", divider: "via-rose-500/20", reqText: "text-rose-600", reqBg: "bg-rose-50", reqBorder: "border-rose-100", btnHover: "hover:bg-rose-600", shadowHover: "hover:shadow-rose-500/30" },
    "TOWING UNASSIGNED": { icon: ICONS.TRUCK, border: "border-amber-500", glow: "shadow-[0_0_80px_rgba(245,158,11,0.4)]", gradFrom: "from-amber-600", gradVia: "via-amber-500", gradTo: "to-amber-600", textLight: "text-amber-100", reqSel: "selection:bg-amber-100", divider: "via-amber-500/20", reqText: "text-amber-600", reqBg: "bg-amber-50", reqBorder: "border-amber-100", btnHover: "hover:bg-amber-600", shadowHover: "hover:shadow-amber-500/30" },
    "REQUIRED DEALER SUPPORT": { icon: ICONS.BUILDING, border: "border-blue-500", glow: "shadow-[0_0_80px_rgba(59,130,246,0.4)]", gradFrom: "from-blue-600", gradVia: "via-blue-500", gradTo: "to-blue-600", textLight: "text-blue-100", reqSel: "selection:bg-blue-100", divider: "via-blue-500/20", reqText: "text-blue-600", reqBg: "bg-blue-50", reqBorder: "border-blue-100", btnHover: "hover:bg-blue-600", shadowHover: "hover:shadow-blue-500/30" },
    "ROS FAILED - UNABLE TO ASSIGN SERVICE": { icon: ICONS.SHIELD_ALERT, border: "border-fuchsia-500", glow: "shadow-[0_0_80px_rgba(217,70,239,0.4)]", gradFrom: "from-fuchsia-600", gradVia: "via-fuchsia-500", gradTo: "to-fuchsia-600", textLight: "text-fuchsia-100", reqSel: "selection:bg-fuchsia-100", divider: "via-fuchsia-500/20", reqText: "text-fuchsia-600", reqBg: "bg-fuchsia-50", reqBorder: "border-fuchsia-100", btnHover: "hover:bg-fuchsia-600", shadowHover: "hover:shadow-fuchsia-500/30" },
    "CUSTOMER WILL ESCALATE": { icon: ICONS.ALERT_TRIANGLE, border: "border-red-600", glow: "shadow-[0_0_80px_rgba(220,38,38,0.5)]", gradFrom: "from-red-700", gradVia: "via-red-600", gradTo: "to-red-700", textLight: "text-red-100", reqSel: "selection:bg-red-100", divider: "via-red-600/20", reqText: "text-red-700", reqBg: "bg-red-50", reqBorder: "border-red-200", btnHover: "hover:bg-red-700", shadowHover: "hover:shadow-red-600/30" }
  };
  // Default to Red if unrecognized
  const curTheme = THEME_MAP[alertObj.requirement] || THEME_MAP["CUSTOMER WILL ESCALATE"];

  const container = document.getElementById('alert-container');

  const alertEl = document.createElement('div');
  // Size increased to max-w-6xl for premium presence
  alertEl.className = `pointer-events-auto shrink-0 w-full max-w-6xl bg-white/95 border-b-8 ${curTheme.border} rounded-[3rem] ${curTheme.glow} shadow-[0_35px_100px_-15px_rgba(0,0,0,0.5)] backdrop-blur-3xl overflow-hidden transform scale-90 opacity-0 transition-all duration-700 flex flex-col relative z-50 mb-6`;
  alertEl.id = `alert-${alertObj.timestamp}`;

  // Extremely compact horizontal flex layout designed not to overflow off UI when stacked
  alertEl.innerHTML = `
    <!-- Top Header section -->
    <div class="bg-gradient-to-r ${curTheme.gradFrom} ${curTheme.gradVia} ${curTheme.gradTo} px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between shadow-sm">
      <div class="flex items-center gap-3">
        <div class="relative w-10 h-10 sm:w-12 sm:h-12 rounded-xl overflow-hidden border-2 border-white/30 shadow-md shrink-0">
          <img src="${getAgentPhoto(alertObj.agentName)}" alt="${alertObj.agentName}" class="w-full h-full object-cover" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22white%22%3E%3Cpath d=%22M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08s5.97 1.09 6 3.08c-1.29 1.94-3.5 3.22-6 3.22z%22/%3E%3C/svg%3E';">
        </div>
        <div>
          <div class="text-[0.6rem] sm:text-[0.65rem] ${curTheme.textLight} font-heading tracking-[0.2em] font-bold uppercase drop-shadow-sm leading-tight">EMERGENCY DISPATCH</div>
          <div class="text-white text-xl sm:text-2xl font-black font-heading uppercase tracking-wider drop-shadow-md leading-none">${alertObj.agentName}</div>
        </div>
      </div>
        <div class="text-[0.5rem] ${curTheme.textLight} font-heading tracking-widest uppercase leading-tight">AUTO-CLEARING IN</div>
        <div class="text-white font-heading font-bold text-2xl leading-none" id="timer-${alertObj.timestamp}">30s</div>
      </div>
    </div>
    
    <!-- Ultra-Wide Compact Data Content -->
    <div class="p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between text-center sm:text-left gap-4 sm:gap-6 w-full">
      <div class="flex-1 flex flex-col items-center sm:items-start min-w-[200px]">
        <span class="inline-block text-[0.6rem] sm:text-xs font-heading tracking-[0.2em] font-black text-slate-400 mb-1 uppercase">VEHICLE ID</span>
        <div class="text-2xl sm:text-3xl lg:text-4xl font-mono font-black text-slate-900 drop-shadow-sm ${curTheme.reqSel} whitespace-nowrap tracking-tighter truncate w-full" title="${alertObj.vehicleNumber || 'N/A'}">${alertObj.vehicleNumber || 'N/A'}</div>
      </div>
      
      <div class="hidden sm:block w-[2px] h-12 bg-slate-100 relative shrink-0">
        <div class="absolute inset-0 bg-gradient-to-b from-transparent ${curTheme.divider} to-transparent"></div>
      </div>
      <div class="sm:hidden w-full h-[2px] bg-slate-100 relative shrink-0">
         <div class="absolute inset-0 bg-gradient-to-r from-transparent ${curTheme.divider} to-transparent"></div>
      </div>

      <div class="flex-2 flex flex-col items-center sm:items-start w-full sm:w-auto">
        <span class="inline-block text-[0.6rem] sm:text-xs font-heading tracking-[0.2em] font-black text-slate-400 mb-1 uppercase text-center sm:text-left w-full">DISPATCH REQUIREMENT</span>
        <div class="flex items-center gap-3 w-full justify-center sm:justify-start">
           <div class="w-12 h-12 sm:w-16 sm:h-16 shrink-0 rounded-full ${curTheme.reqBg} flex items-center justify-center ${curTheme.reqText} drop-shadow-sm border border-black/5 p-2">${curTheme.icon}</div>
           <div class="text-lg sm:text-xl lg:text-2xl font-bold ${curTheme.reqText} px-4 py-1.5 sm:py-2 rounded-2xl border ${curTheme.reqBorder} ${curTheme.reqBg} shadow-sm leading-tight flex-1 sm:flex-auto text-left break-words max-w-[250px] sm:max-w-none">${alertObj.requirement || 'General Update'}</div>
        </div>
      </div>

      <!-- Compact Acknowledgement Button right in the row -->
      <button onclick="acknowledgeAlert('${alertObj.timestamp}')" class="mt-2 sm:mt-0 shrink-0 min-w-[120px] w-full sm:w-auto py-3 sm:py-0 sm:h-16 px-6 bg-slate-900 ${curTheme.btnHover} text-white font-heading font-black rounded-xl transition-all hover:scale-105 active:scale-95 text-sm sm:text-base tracking-[0.1em] shadow-lg ${curTheme.shadowHover} flex items-center justify-center gap-2">
         <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
         ACKNOWLEDGE
      </button>
    </div>
  `;

  container.prepend(alertEl);

  // Trigger entry animation
  requestAnimationFrame(() => {
    alertEl.classList.remove('scale-90', 'opacity-0');
    alertEl.classList.add('scale-100');
  });

  // Start internal countdown for the visual timer (Updated to 30s)
  let timeLeft = 30;
  const timerLabel = document.getElementById(`timer-${alertObj.timestamp}`);
  const countdownInterval = setInterval(() => {
    timeLeft--;
    if (timerLabel) timerLabel.textContent = timeLeft + 's';
    if (timeLeft <= 0) clearInterval(countdownInterval);
  }, 1000);
  
  // Auto-acknowledge after 30 seconds
  setTimeout(() => {
    clearInterval(countdownInterval);
    acknowledgeAlert(alertObj.timestamp);
  }, 30000);
}

// Supervisor Alert Clear Routine
async function acknowledgeAlert(timestampId) {
  // 1. Immediately remove from UI for responsiveness
  const alertEl = document.getElementById(`alert-${timestampId}`);
  if (alertEl) {
    alertEl.classList.add('opacity-0', 'scale-95');
    setTimeout(() => {
        alertEl.remove();
        activeVisibleAlertsCount = Math.max(0, activeVisibleAlertsCount - 1);
        processAlertQueue(); // Pull next from queue if any wait!
    }, 300);
  } else {
    // If it was somehow acknowledged while still in the queue, just remove it from the queue
    const idx = alertQueue.findIndex(a => a.timestamp === timestampId);
    if(idx !== -1) alertQueue.splice(idx, 1);
  }
  
  activeDisplayedAlerts.delete(timestampId);
  clearedLiveAlerts.set(timestampId, Date.now()); // Mark as cleared with current time to throttle for 2 minutes

  // 2. Only send clear request if it's from the Alerts sheet (not a dynamically generated FAST LIVE alert)
  if (!String(timestampId).startsWith('LIVE_')) {
    try {
      await fetch(CONFIG.APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          'action': 'clearAlert',
          'timestamp': timestampId
        })
      });
    } catch (e) {
      console.error("Failed to clear alert on server", e);
    }
  }
}

// ─── UTILITIES ───────────────────────────────────────
function parseDateRobust(dateStr) {
  if (!dateStr) return null;
  let d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    let now = new Date();
    // if future and contains a slash, DD/MM might be flipped with MM/DD
    if (d.getTime() > now.getTime() && String(dateStr).includes('/')) {
        let parts = String(dateStr).trim().split(/[ \/,:-]+/);
        if (parts.length >= 3) {
           let swapped = parts[1] + '/' + parts[0] + '/' + parts[2];
           let splitTime = String(dateStr).split(' ');
           let t = splitTime.length > 1 ? splitTime[1] : '';
           let ds = new Date(swapped + (t ? ' ' + t : ''));
           if (!isNaN(ds.getTime()) && ds.getTime() < now.getTime()) return ds;
        }
    }
    return d;
  }
  // Fallback structural parsing mapping
  let parts = String(dateStr).trim().split(/[ \/,:-]+/);
  if (parts.length >= 3) {
     let f1 = parseInt(parts[0], 10);
     let f2 = parseInt(parts[1], 10);
     let y = parseInt(parts[2], 10);
     let m1 = new Date().getMonth() + 1; // current month as best guess resolving
     let d_val, m_val;
     if (f1 > 12) { d_val = f1; m_val = f2; }
     else if (f2 > 12) { m_val = f1; d_val = f2; }
     else { m_val = f1 === m1 ? f1 : (f2 === m1 ? f2 : f1); d_val = m_val === f1 ? f2 : f1; }
     
     let hh = parseInt(parts[3] || 0, 10);
     let mm = parseInt(parts[4] || 0, 10);
     let ss = parseInt(parts[5] || 0, 10);
     return new Date(y, m_val - 1, d_val, hh, mm, ss);
  }
  return new Date(NaN);
}

function getRelativeTime(timestamp) {
  if (!timestamp) return 'No data';
  const pickTime = parseDateRobust(timestamp);
  if (isNaN(pickTime.getTime())) return 'Invalid date';

  const now = new Date();
  let diffMs = now.getTime() - pickTime.getTime();
  if (diffMs < 0) diffMs = 0; // protect against clock sync drifting
  
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;

  return pickTime.toLocaleDateString();
}

function getCaseColor(count, allAgents) {
  if (allAgents.length < 2) return '#a5f3fc'; // Default cyan-200

  const totals = allAgents.map(a => a.stats.total);
  const min = Math.min(...totals);
  const max = Math.max(...totals);

  if (max === min) return '#a5f3fc';

  // Normalize value between 0 and 1
  const ratio = (count - min) / (max - min);

  // Hue 0-140 (Red to Green-ish)
  const hue = ratio * 140;
  return `hsl(${hue}, 100%, 70%)`;
}

// ─── RENDER GRID FUNCTIONS ────────────────────────────────────

function renderAgentCard(agent, allAgents) {
  const caseColor = getCaseColor(agent.stats.total, allAgents);
  const relativeTime = getRelativeTime(agent.lastPickTime);
  const isRecent = agent.lastPickTime && (new Date() - new Date(agent.lastPickTime) < 300000); // 5 mins

  return `
    <div class="agent-card p-2 sm:p-3 flex flex-col gap-1.5 cursor-pointer shadow-lg hover:shadow-2xl transition-all border-l-4 text-center items-center" style="border-left-color: ${caseColor}" onclick="openAgentModal('${agent.name}')">
      
      <!-- TOP SECTION: NAME & TIME -->
      <div class="w-full flex flex-col items-center justify-center mb-0.5">
          <h3 class="text-white font-bold text-[0.7rem] sm:text-[0.75rem] leading-tight whitespace-normal break-words uppercase tracking-tighter text-center" title="${agent.name}">${agent.name}</h3>
          <div class="flex items-center justify-center gap-1 mt-0.5">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-2.5 h-2.5 text-white/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            <span class="text-[0.6rem] sm:text-[0.65rem] text-white/60 font-medium tracking-tight truncate">${relativeTime}</span>
          </div>
      </div>

      <!-- CENTER SECTION: IMAGE -->
      <div class="relative shrink-0 w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-full bg-white/20 overflow-hidden border-2 border-white/40 shadow-lg z-10 mb-0.5">
        <img src="${getAgentPhoto(agent.name)}" alt="${agent.name}" class="w-full h-full object-cover" 
             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
        <div class="hidden w-full h-full items-center justify-center bg-gradient-to-br from-theme-primary to-theme-secondary">
           <span class="text-white font-heading font-bold text-2xl sm:text-3xl drop-shadow-md">${agent.name.charAt(0).toUpperCase()}</span>
        </div>
        ${isRecent ? '<div class="absolute bottom-1 right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>' : ''}
      </div>

      <!-- BOTTOM SECTION: METRICS (HERO + GRID) -->
      <div class="w-full bg-black/20 rounded-xl p-1.5 border border-white/10 flex items-center justify-between shadow-[inset_0_1px_3px_rgba(0,0,0,0.2)]">
        <div class="text-[0.55rem] sm:text-[0.6rem] text-white/70 font-heading font-black tracking-[0.15em] uppercase">CASES</div>
        <div class="text-lg sm:text-xl font-heading font-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]" style="color: ${caseColor}">${agent.stats.total}</div>
      </div>

      <div class="w-full grid grid-cols-2 gap-1.5 mt-[-0.1rem]">
        <!-- ROS -->
        <div class="metric-box p-1 bg-white/5 border border-white/10 rounded-lg flex flex-col items-center justify-center text-center">
          <div class="text-sm sm:text-base font-black text-emerald-400 font-heading drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]">${agent.stats.ros}</div>
          <div class="text-[0.5rem] sm:text-[0.55rem] text-white/80 font-heading font-black tracking-widest uppercase">ROS</div>
        </div>

        <!-- TOWING -->
        <div class="metric-box p-1 bg-white/5 border border-white/10 rounded-lg flex flex-col items-center justify-center text-center">
          <div class="text-sm sm:text-base font-black text-amber-400 font-heading drop-shadow-[0_0_8px_rgba(251,191,36,0.3)]">${agent.stats.towing}</div>
          <div class="text-[0.5rem] sm:text-[0.55rem] text-white/80 font-heading font-black tracking-widest uppercase">TOW</div>
        </div>
      </div>

    </div>
  `;
}

async function updateDashboard() {
  const dataPayload = await fetchData();
  globalAgents = dataPayload.agents;
  const alerts = dataPayload.alerts;

  // 1. Process Alerts
  if (alerts && alerts.length > 0) {
    alerts.forEach(alertObj => renderAlert(alertObj));
  }

  // 2. Render Agent Grid
  const grid = document.getElementById('agent-grid');
  // Sort agents: Low Cases First, High Cases Last (Ascending)
  globalAgents.sort((a, b) => a.stats.total - b.stats.total);

  grid.innerHTML = globalAgents.map(agent => renderAgentCard(agent, globalAgents)).join('');

  // 3. Update Global KPIs
  const totals = globalAgents.reduce((acc, agent) => {
    acc.total += agent.stats.total;
    acc.ros += agent.stats.ros;
    acc.towing += agent.stats.towing;
    acc.dealer += agent.stats.dealer;
    acc.failed += agent.stats.failed;
    
    // Sum up pre-aggregated counts from each agent
    acc.ongoing += (agent.stats.ongoing || 0);
    acc.escalation += (agent.stats.escalation || 0);
    acc.cancelled += (agent.stats.cancelled || 0);
    acc.postponed += (agent.stats.postponed || 0);
    acc.closed += (agent.stats.closed || 0);
    acc.preclose += (agent.stats.preclose || 0);
    
    return acc;
  }, { total: 0, ros: 0, towing: 0, dealer: 0, failed: 0, ongoing: 0, escalation: 0, cancelled: 0, postponed: 0, closed: 0, preclose: 0 });

  // Update UI Elements
  document.getElementById('kpi-total').textContent = totals.total;
  document.getElementById('kpi-ros').textContent = totals.ros;
  document.getElementById('kpi-towing').textContent = totals.towing;
  document.getElementById('kpi-dealer').textContent = totals.dealer;

  // Additional Ticket Status KPIs
  const ongoingEl = document.getElementById('kpi-ongoing');
  if (ongoingEl) ongoingEl.textContent = totals.ongoing;

  const escalationEl = document.getElementById('kpi-escalation');
  if (escalationEl) escalationEl.textContent = totals.escalation;

  const cancelledEl = document.getElementById('kpi-cancelled');
  if (cancelledEl) cancelledEl.textContent = totals.cancelled;

  const postponedEl = document.getElementById('kpi-postponed');
  if (postponedEl) postponedEl.textContent = totals.postponed;

  const closedEl = document.getElementById('kpi-closed');
  if (closedEl) closedEl.textContent = totals.closed;

  const precloseEl = document.getElementById('kpi-preclose');
  if (precloseEl) precloseEl.textContent = totals.preclose;

  document.getElementById('header-agent-count').textContent = globalAgents.length;
}

// ─── CLOCK ───────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  const clockEl = document.getElementById('clock');
  if (clockEl) clockEl.textContent = now.toLocaleTimeString('en-US', { hour12: false });
}

// ─── INITIALIZATION ──────────────────────────────────────
setInterval(updateClock, 1000);
updateClock();
updateDashboard();
// We poll every CONFIG.REFRESH_INTERVAL specifically to catch Google Sheet/Alert changes instantly
setInterval(updateDashboard, CONFIG.REFRESH_INTERVAL);

// ─── MODAL LOGIC ─────────────────────────────────────────
function openAgentModal(agentName) {
  const agent = globalAgents.find(a => a.name === agentName);
  if (!agent) return;

  document.getElementById('modal-agent-name').textContent = agent.name;
  document.getElementById('modal-agent-id').textContent = `ID: RSA-00${agent.id + 1}`;
  const totalEl = document.getElementById('modal-total');
  if (totalEl) totalEl.textContent = agent.stats.total;
  const rosEl = document.getElementById('modal-ros');
  if (rosEl) rosEl.textContent = agent.stats.ros;
  const towingEl = document.getElementById('modal-towing');
  if (towingEl) towingEl.textContent = agent.stats.towing;
  const dealerEl = document.getElementById('modal-dealer');
  if (dealerEl) dealerEl.textContent = agent.stats.dealer;
  
  const ongoingEl = document.getElementById('modal-ongoing');
  if (ongoingEl) ongoingEl.textContent = agent.stats.ongoing || 0;
  
  const cancelledEl = document.getElementById('modal-cancelled');
  if (cancelledEl) cancelledEl.textContent = agent.stats.cancelled || 0;
  
  const closedEl = document.getElementById('modal-closed');
  if (closedEl) closedEl.textContent = agent.stats.closed || 0;
  
  const precloseEl = document.getElementById('modal-preclose');
  if (precloseEl) precloseEl.textContent = agent.stats.preclose || 0;

  // Handing Image Logic for Modal - TARGET DEDICATED CONTAINER
  const container = document.getElementById('modal-image-container');
  const imgUrl = getAgentPhoto(agent.name);

  // Clear and Rebuild to prevent "image sticking"
  container.innerHTML = `
    <img src="${imgUrl}" class="w-full h-full object-cover" 
         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
    <div class="hidden w-full h-full items-center justify-center bg-gradient-to-br from-theme-primary to-theme-secondary">
       <span id="modal-agent-initial" class="text-[8rem] font-heading font-bold text-white drop-shadow-lg">${agent.name.charAt(0).toUpperCase()}</span>
    </div>
  `;

  const modal = document.getElementById('agent-modal');
  modal.classList.remove('hidden');
}

function closeModal() {
  const modal = document.getElementById('agent-modal');
  modal.classList.add('hidden');
}

// Close modal when clicking outside the content
document.getElementById('agent-modal').addEventListener('click', function (e) {
  if (e.target === this) closeModal();
});
