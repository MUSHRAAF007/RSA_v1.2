// Same endpoint to pull Agents, and soon to push Alerts
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwbBu5Lrc80uDr58TSZAKTpoiiHPJNiMrr2S4KgtbkV02-yCD4dglk8gj75aWMlfzxT/exec";

// ─── IMAGE MAPPING UTILITY ──────────────────────────────
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
  "Gopal": "Gopal.jpeg",
  "Sajan": "Sajan.jpeg",
  "Reshma": "Reshma.jpeg"
};

function getAgentPhoto(name) {
  if (NAME_PHOTO_MAP[name]) return `img/${NAME_PHOTO_MAP[name]}`;
  return `img/${name}.jpeg`;
}

// Fetch Live Agents
async function fetchSupervisorGrid() {
  try {
    const response = await fetch(APPS_SCRIPT_URL);
    if (!response.ok) throw new Error("Network response was not ok");
    const json = await response.json();

    // V7 structure is { agents: [...], alerts: [...] }
    const agentRawData = json.agents ? json.agents : json;

    const agents = agentRawData.map((row, index) => {
      return {
        id: index,
        name: row['Name'] || `Agent ${index + 1}`
      };
    });

    renderSupervisorGrid(agents);
  } catch (error) {
    console.error("Fetch Error:", error);
  }
}

// Render grid with 'Dispatch' buttons
function renderSupervisorGrid(agents) {
  const grid = document.getElementById('supervisor-grid');
  grid.innerHTML = agents.map(agent => `
    <div class="bg-white/80 border border-red-200/50 rounded-2xl p-4 shadow-xl shadow-red-900/5 flex flex-col items-center gap-3">
      <div class="w-16 h-16 rounded-full overflow-hidden border-4 border-white shadow-md bg-gradient-to-br from-theme-primary to-theme-secondary flex items-center justify-center">
         <img src="${getAgentPhoto(agent.name)}" alt="${agent.name}" class="w-full h-full object-cover" 
              onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
         <div class="hidden w-full h-full items-center justify-center">
            <span class="text-white font-heading font-bold text-2xl drop-shadow-sm">${agent.name.charAt(0).toUpperCase()}</span>
         </div>
      </div>
      <h3 class="text-slate-800 font-bold text-center leading-tight truncate w-full uppercase tracking-wide text-xs" title="${agent.name}">${agent.name}</h3>
      
      <button onclick="openDispatchModal('${agent.name}')" class="mt-2 w-full py-2 bg-slate-800 hover:bg-theme-primary text-white text-[0.6rem] font-heading font-bold tracking-[0.1em] rounded-lg transition-colors shadow-md flex justify-center items-center gap-2">
         🚨 DISPATCH
      </button>
    </div>
  `).join('');
}

// Modal Logic
function openDispatchModal(agentName) {
  document.getElementById('dispatch-agent').value = agentName;
  document.getElementById('dispatch-vehicle').value = '';
  document.getElementById('dispatch-req').selectedIndex = 0;
  document.getElementById('dispatch-modal').classList.remove('hidden');
}

function closeDispatchModal() {
  document.getElementById('dispatch-modal').classList.add('hidden');
}

// Form Submission -> Push to Apps Script
document.getElementById('dispatch-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const btn = document.getElementById('btn-submit-dispatch');
  const agentName = document.getElementById('dispatch-agent').value;
  const vehicleNo = document.getElementById('dispatch-vehicle').value;
  const reqType = document.getElementById('dispatch-req').value;

  btn.innerHTML = `<svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> SENDING...`;
  btn.disabled = true;

  try {
    // We send a POST request with the alert parameters
    // Note: Apps script handle POST requests natively
    await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors', // Opaque response for Cross-Origin standard bypassing
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'action': 'dispatchAlert',
        'agentName': agentName,
        'vehicleNumber': vehicleNo,
        'requirement': reqType
      })
    });

    Swal.fire({
      icon: 'success',
      title: 'Dispatched!',
      text: `Alert sent to ${agentName} dashboard.`,
      confirmButtonColor: '#E11D48'
    });
    
    closeDispatchModal();
  } catch(err) {
    Swal.fire({
      icon: 'error',
      title: 'Connection Failed',
      text: 'Could not send alert to Google.',
      confirmButtonColor: '#1F2937'
    });
  }

  btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg> SEND ALERT NOW`;
  btn.disabled = false;
});

fetchSupervisorGrid();
setInterval(fetchSupervisorGrid, 10000); // 10 second refresh for supervisor grid
