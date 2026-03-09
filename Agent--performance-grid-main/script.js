// ─── CONFIGURATION ───────────────────────────────────────
const CONFIG = {
  REFRESH_INTERVAL: 5000,
  // Replace with the NEW V7 APPS_SCRIPT_URL you just deployed
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbzjE9EF0tndtILoeXM-L1FBNjdpBS4mGYv-yGO71AVMkSnyrQsGvFbFcAewNksizKBK/exec",
};

// ─── IMAGE MAPPING UTILITY ──────────────────────────────
// This maps Dashboard names (from Sheet) to exact Filenames (in img/ folder)
const NAME_PHOTO_MAP = {
  "Ankit": "Ankit Kumar Yadhav.jpeg",
  "Abhinav": "Abinav.jpeg",
  "Sunayna": "SUNAYNA.jpeg",
  "Logaseelan": "Loogaseelan.jpeg",
  "Jai Dev": "Jaidev.jpeg",
  "Salma Nisha": "Salmaa.jpeg",
  "Tara Sharma": "Tara.jpeg",
  "Subhani Shaik": "Subhani.jpeg",
  "Tanveer": "Thanveer.jpeg",
  "Sri Sai": "sri sai.jpeg",
  "Nilanjana": "nilanjana.jpeg",
  // Fallbacks (if name matches exactly, we don't need it here, but it helps for clarity)
  "Gopal": "Gopal.jpeg",
  "Sajan": "Sajan.jpeg",
  "Reshma": "Reshma.jpeg"
};

function getAgentPhoto(name) {
  // 1. Check direct map
  if (NAME_PHOTO_MAP[name]) return `img/${NAME_PHOTO_MAP[name]}`;

  // 2. Try Exact Name + extension (Case insensitive)
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

// ─── ALERT DISPLAY LOGIC ─────────────────────────────────
function renderAlert(alertObj) {
  // Only render if we haven't already actively painted this exact timestamp
  if (activeDisplayedAlerts.has(alertObj.timestamp)) return;
  activeDisplayedAlerts.add(alertObj.timestamp);

  const container = document.getElementById('alert-container');

  const alertEl = document.createElement('div');
  // High-priority center modal style alert
  alertEl.className = "pointer-events-auto w-full max-w-3xl bg-white/95 border-4 border-red-500 rounded-[2.5rem] shadow-[0_0_80px_rgba(225,29,72,0.4)] backdrop-blur-2xl overflow-hidden transform scale-90 opacity-0 transition-all duration-500 flex flex-col";
  alertEl.id = `alert-${alertObj.timestamp}`;

  alertEl.innerHTML = `
    <!-- Top Header section -->
    <div class="bg-gradient-to-r from-red-600 via-red-500 to-red-600 px-8 py-6 flex items-center justify-between border-b-4 border-white/20">
      <div class="flex items-center gap-4">
        <div class="relative w-16 h-16 rounded-2xl overflow-hidden border-2 border-white/30 shadow-lg shrink-0">
          <img src="${getAgentPhoto(alertObj.agentName)}" alt="${alertObj.agentName}" class="w-full h-full object-cover" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22white%22%3E%3Cpath d=%22M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08s5.97 1.09 6 3.08c-1.29 1.94-3.5 3.22-6 3.22z%22/%3E%3C/svg%3E';">
        </div>
        <div>
          <div class="text-[0.75rem] text-red-100 font-heading tracking-[0.2em] font-bold uppercase drop-shadow-sm">EMERGENCY DISPATCH</div>
          <div class="text-white text-3xl font-black font-heading uppercase tracking-wider drop-shadow-md">${alertObj.agentName}</div>
        </div>
      </div>
      <div class="hidden sm:block text-right">
        <div class="text-[0.6rem] text-red-100 font-heading tracking-widest uppercase mb-1">AUTO-CLEARING IN</div>
        <div class="text-white font-heading font-bold text-xl" id="timer-${alertObj.timestamp}">15s</div>
      </div>
    </div>
    
    <!-- Large Content details -->
    <div class="p-8 sm:p-12 flex flex-col items-center text-center">
      <div class="mb-8">
        <span class="inline-block text-sm font-heading tracking-[0.3em] font-black text-slate-400 mb-2 uppercase">VEHICLE NUMBER</span>
        <div class="text-5xl sm:text-7xl font-mono font-black text-slate-900 drop-shadow-sm selection:bg-red-100">${alertObj.vehicleNumber || 'N/A'}</div>
      </div>
      
      <div class="w-full h-[2px] bg-slate-100 mb-8 relative">
        <div class="absolute inset-0 bg-gradient-to-r from-transparent via-red-500/20 to-transparent"></div>
      </div>

      <div class="mb-4">
        <span class="inline-block text-sm font-heading tracking-[0.3em] font-black text-slate-400 mb-2 uppercase">DISPATCH REQUIREMENT</span>
        <div class="text-3xl sm:text-4xl font-bold text-red-600 bg-red-50 px-6 py-2 rounded-2xl border border-red-100">${alertObj.requirement || 'General Update'}</div>
      </div>
    </div>

    <!-- Actions Footer -->
    <div class="px-8 pb-8 flex items-center justify-center gap-4">
       <button onclick="acknowledgeAlert('${alertObj.timestamp}')" class="w-full max-w-sm py-5 bg-slate-900 hover:bg-red-600 text-white font-heading font-black rounded-2xl transition-all hover:scale-105 active:scale-95 text-lg tracking-[0.2em] shadow-2xl hover:shadow-red-500/30 flex items-center justify-center gap-3">
         <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
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

  // Start internal countdown for the visual timer
  let timeLeft = 15;
  const timerLabel = document.getElementById(`timer-${alertObj.timestamp}`);
  const countdownInterval = setInterval(() => {
    timeLeft--;
    if (timerLabel) timerLabel.textContent = timeLeft + 's';
    if (timeLeft <= 0) clearInterval(countdownInterval);
  }, 1000);

  // Auto-acknowledge after 15 seconds
  setTimeout(() => {
    clearInterval(countdownInterval);
    acknowledgeAlert(alertObj.timestamp);
  }, 15000);
}

// Supervisor Alert Clear Routine
async function acknowledgeAlert(timestampId) {
  // 1. Immediately remove from UI for responsiveness
  const alertEl = document.getElementById(`alert-${timestampId}`);
  if (alertEl) {
    alertEl.classList.add('opacity-0', 'scale-95');
    setTimeout(() => alertEl.remove(), 300);
  }
  activeDisplayedAlerts.delete(timestampId);

  // 2. Send request to Apps script to delete this alert from the database permanently
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

// ─── UTILITIES ───────────────────────────────────────
function getRelativeTime(timestamp) {
  if (!timestamp) return 'No data';
  const now = new Date();
  const pickTime = new Date(timestamp);
  if (isNaN(pickTime.getTime())) return 'Invalid date';

  const diffMs = now - pickTime;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}min ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

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
    <div class="agent-card p-3 sm:p-4 flex flex-col gap-3 sm:gap-4 cursor-pointer shadow-lg hover:shadow-2xl transition-all border-l-4" style="border-left-color: ${caseColor}" onclick="openAgentModal('${agent.name}')">
      
      <!-- TOP SECTION: PROFILE -->
      <div class="flex items-center gap-2 sm:gap-3">
        <div class="relative shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/20 overflow-hidden border-2 border-white/40 shadow-md">
          <img src="${getAgentPhoto(agent.name)}" alt="${agent.name}" class="w-full h-full object-cover" 
               onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
          <div class="hidden w-full h-full items-center justify-center bg-gradient-to-br from-theme-primary to-theme-secondary">
             <span class="text-white font-heading font-bold text-2xl sm:text-3xl drop-shadow-md">${agent.name.charAt(0).toUpperCase()}</span>
          </div>
          ${isRecent ? '<div class="absolute bottom-1 right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>' : ''}
        </div>
        <div class="flex-1 min-w-0">
          <h3 class="text-white font-bold text-[0.7rem] sm:text-sm leading-tight truncate uppercase tracking-tighter" title="${agent.name}">${agent.name}</h3>
          <div class="flex items-center gap-1 mt-0.5">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-white/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            <span class="text-[0.7rem] sm:text-[0.75rem] text-white/60 font-medium tracking-tight truncate">${relativeTime}</span>
          </div>
        </div>
      </div>

      <!-- MIDDLE SECTION: TOTAL CASES (HERO METRIC) -->
      <div class="bg-black/20 rounded-xl p-2 border border-white/10 flex items-center justify-between shadow-[inset_0_1px_3px_rgba(0,0,0,0.2)]">
        <div class="text-[0.65rem] sm:text-[0.75rem] text-white/70 font-heading font-black tracking-[0.15em] uppercase">CASES</div>
        <div class="text-xl sm:text-2xl font-heading font-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]" style="color: ${caseColor}">${agent.stats.total}</div>
      </div>

      <!-- BOTTOM SECTION: METRICS GRID -->
      <div class="grid grid-cols-2 gap-2">
        
        <!-- ROS -->
        <div class="metric-box p-1.5 bg-white/5 border border-white/10 rounded-lg flex flex-col items-center justify-center text-center">
          <div class="text-base sm:text-lg font-black text-emerald-400 font-heading drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]">${agent.stats.ros}</div>
          <div class="text-[0.55rem] sm:text-[0.65rem] text-white/80 font-heading font-black tracking-widest uppercase">ROS</div>
        </div>

        <!-- TOWING -->
        <div class="metric-box p-1.5 bg-white/5 border border-white/10 rounded-lg flex flex-col items-center justify-center text-center">
          <div class="text-base sm:text-lg font-black text-amber-400 font-heading drop-shadow-[0_0_8px_rgba(251,191,36,0.3)]">${agent.stats.towing}</div>
          <div class="text-[0.55rem] sm:text-[0.65rem] text-white/80 font-heading font-black tracking-widest uppercase">TOW</div>
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
  document.getElementById('modal-total').textContent = agent.stats.total;
  document.getElementById('modal-ros').textContent = agent.stats.ros;
  document.getElementById('modal-towing').textContent = agent.stats.towing;
  document.getElementById('modal-dealer').textContent = agent.stats.dealer;

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
