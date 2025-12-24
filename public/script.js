let savedHoldings = [];
let savedGoals = [];
let savedAssignments = {};



// Local Storage Helper
const LocalStore = {
    getKeys: () => ({ 
        GOALS: 'kite_goals', 
        ASSIGNMENTS: 'kite_assignments',
        PERSONALITY: 'kite_personality',
        SUGGESTIONS: 'kite_suggestions', // Optional: if we want to persist unaccepted suggestions
        DEMO_MODE: 'kite_demo_mode'
    }),
    
    getGoals: () => JSON.parse(localStorage.getItem('kite_goals') || '[]'),
    setGoals: (goals) => localStorage.setItem('kite_goals', JSON.stringify(goals)),
    
    getAssignments: () => JSON.parse(localStorage.getItem('kite_assignments') || '{}'),
    setAssignments: (data) => localStorage.setItem('kite_assignments', JSON.stringify(data)),
    
    getPersonality: () => localStorage.getItem('kite_personality'),
    setPersonality: (text) => localStorage.setItem('kite_personality', text),
    
    isDemoMode: () => localStorage.getItem('kite_demo_mode') === 'true',
    setDemoMode: (val) => localStorage.setItem('kite_demo_mode', val),
    
    // Helper to generate simple ID
    generateId: () => Date.now().toString(36) + Math.random().toString(36).substr(2)
};

async function init() {
    const statusEl = document.getElementById('status-indicator');
    const loginSection = document.getElementById('login-section');
    
    // Auto-restore Demo Mode if active
    if (LocalStore.isDemoMode()) {
        try {
            await fetch('/api/demo-login', { method: 'POST' });
        } catch (e) {
            console.warn("Failed to auto-restore demo session");
        }
    }

    try {
        const statusRes = await fetch('/api/status');
        const status = await statusRes.json();
        
        if (status.isAuthenticated) {
            statusEl.textContent = 'Connected' + (LocalStore.isDemoMode() ? ' (Demo)' : '');
            statusEl.classList.remove('offline');
            statusEl.classList.add('connected');
            loginSection.classList.add('hidden');
            await loadData();
        } else {
            loginSection.classList.remove('hidden');
        }
    } catch (e) {
        console.error("Failed to check status", e);
    }
}

async function loadData() {
    const loading = document.getElementById('loading');
    loading.classList.remove('hidden');
    const dashboardSection = document.getElementById('dashboard-section');

    try {
        // Fetch only Holdings from server (API required for visual updates)
        const holdingsRes = await fetch('/api/holdings');
        
        // Load Goals & Assignments from LocalStorage
        savedGoals = LocalStore.getGoals();
        savedAssignments = LocalStore.getAssignments();
        
        const hData = await holdingsRes.json();
        savedHoldings = Array.isArray(hData) ? hData : (hData.data || []);

        renderGoals();
        renderAllocations();

        // Restore Personality Insight if available
        const personality = LocalStore.getPersonality();
        if (personality) {
             // We don't have a dedicated place on dashboard for it yet, 
             // but we can ensure it shows up in the modal or add a dashboard banner.
             // For now, let's inject it into the dashboard header if it exists
             // OR just keep it ready for the modal.
        }
        
        loading.classList.add('hidden');
        dashboardSection.classList.remove('hidden');
    } catch (e) {
        console.error(e);
        const errorEl = document.getElementById('error-message');
        errorEl.textContent = "Failed to load data: " + e.message;
        errorEl.classList.remove('hidden');
        loading.classList.add('hidden');
    }
}

function renderGoals() {
    const container = document.getElementById('goals-container');
    container.innerHTML = '';
    
    savedGoals.forEach(g => {
        // Calculate goal progress
        const assignedSymbols = Object.keys(savedAssignments).filter(k => savedAssignments[k] === g.id);
        const currentVal = savedHoldings
            .filter(h => assignedSymbols.includes(h.tradingsymbol))
            .reduce((sum, h) => sum + (h.last_price * h.quantity), 0);
        
        const progress = Math.min((currentVal / g.targetAmount) * 100, 100);
        
        const card = document.createElement('div');
        card.className = 'goal-card';
        card.style.setProperty('--goal-color', g.color);
        card.innerHTML = `
            <div class="goal-header">
                <div class="goal-title">${g.name}</div>
                <div class="goal-amount">Target: ${formatCurrency(g.targetAmount)}</div>
            </div>
            <div class="progress-container">
                <div class="progress-bar" style="width: ${progress}%"></div>
            </div>
            <div class="goal-stats">
                <span class="current-val">${formatCurrency(currentVal)}</span>
                <span class="percentage">${progress.toFixed(1)}%</span>
            </div>
            <button class="btn sm-btn" style="margin-top:1rem; width:100%" onclick="deleteGoal('${g.id}')">Delete</button>
        `;
        container.appendChild(card);
    });
}

function renderAllocations() {
    const unassignedList = document.getElementById('unassigned-list');
    const assignedList = document.getElementById('assigned-list');
    
    unassignedList.innerHTML = '';
    assignedList.innerHTML = '';
    
    savedHoldings.forEach(h => {
        const assignedGoalId = savedAssignments[h.tradingsymbol];
        const currentVal = h.last_price * h.quantity;
        
        const item = document.createElement('div');
        item.className = 'holding-item';
        
        // Context menu or simple click to assign/unassign
        item.onclick = () => openAssignmentMenu(h);
        
        item.innerHTML = `
            <div class="holding-info">
                <div>${h.tradingsymbol}</div>
                <div>${h.quantity} qty • ${formatCurrency(h.last_price)}</div>
            </div>
            <div class="holding-value">
                ${formatCurrency(currentVal)}
                ${assignedGoalId ? `<br><small style="color:${getGoalColor(assignedGoalId)}">● ${getGoalName(assignedGoalId)}</small>` : ''}
            </div>
        `;
        
        if (assignedGoalId) {
            assignedList.appendChild(item);
        } else {
            unassignedList.appendChild(item);
        }
    });
}

function getGoalName(id) {
    const g = savedGoals.find(x => x.id === id);
    return g ? g.name : 'Unknown';
}

function getGoalColor(id) {
    const g = savedGoals.find(x => x.id === id);
    return g ? g.color : '#fff';
}

function openAssignmentMenu(holding) {
    showAssignmentModal(holding);
}

function showAssignmentModal(holding) {
    // Remove existing if any
    const existing = document.getElementById('assign-modal');
    if (existing) existing.remove();
    
    const assignedGoalId = savedAssignments[holding.tradingsymbol];
    
    const div = document.createElement('div');
    div.id = 'assign-modal';
    div.className = 'modal';
    div.innerHTML = `
        <div class="modal-content card">
            <h2>Assign ${holding.tradingsymbol}</h2>
            <p>Select a goal to assign this stock to:</p>
            <div class="list">
                ${assignedGoalId ? `<button class="btn" style="width:100%; margin-bottom:0.5rem; border:1px solid #da3633; color:#da3633" onclick="confirmAssign('${holding.tradingsymbol}', null)">Unassign (Move to General)</button>` : ''}
                ${savedGoals.map(g => `
                    <button class="btn" style="width:100%; margin-bottom:0.5rem; text-align:left; border-left: 4px solid ${g.color}" 
                        onclick="confirmAssign('${holding.tradingsymbol}', '${g.id}')">
                        ${g.name}
                    </button>
                `).join('')}
            </div>
            <button class="btn" style="margin-top:1rem" onclick="document.getElementById('assign-modal').remove()">Cancel</button>
        </div>
    `;
    document.body.appendChild(div);
}

async function confirmAssign(symbol, goalId) {
    document.getElementById('assign-modal').remove();
    
    try {
        // No API call for assignment persistence now
        
        // Update local state and re-render
        if (goalId) {
            savedAssignments[symbol] = goalId;
        } else {
            delete savedAssignments[symbol];
        }
        
        // Save to LocalStorage
        LocalStore.setAssignments(savedAssignments);

        renderAllocations();
        renderGoals(); // Update progress
    } catch (e) {
        console.error(e);
        alert("Failed to assign");
    }
}

async function deleteGoal(id) {
    if (!confirm("Are you sure? This will unassign all stocks linked to this goal.")) return;
    
    // No API call for delete goal
    
    savedGoals = savedGoals.filter(g => g.id !== id);
    // Remove assignments locally
    for (const k in savedAssignments) {
        if (savedAssignments[k] === id) delete savedAssignments[k];
    }
    
    // Update LocalStorage
    LocalStore.setGoals(savedGoals);
    LocalStore.setAssignments(savedAssignments);
    
    renderGoals();
    renderAllocations();
}

// AI Suggestions Logic
let currentSuggestions = [];

function openSuggestionsModal() {
    const suggestionsModal = document.getElementById('suggestions-modal');
    suggestionsModal.classList.remove('hidden');
    
    // Reset view
    document.getElementById('ai-entry-view').classList.remove('hidden');
    document.getElementById('personality-summary').classList.add('hidden');
    document.getElementById('suggestions-loading').classList.add('hidden');
    document.getElementById('suggestions-container').classList.add('hidden');
    document.getElementById('suggestions-actions').classList.add('hidden');
    
    // Clear previous results
    document.getElementById('suggestions-container').innerHTML = '';
    const existingToken = document.getElementById('token-usage-info');
    if (existingToken) existingToken.remove();
}

async function startAIAnalysis() {
    const loading = document.getElementById('suggestions-loading');
    const container = document.getElementById('suggestions-container');
    const actions = document.getElementById('suggestions-actions');
    const entryView = document.getElementById('ai-entry-view');
    
    const provider = document.getElementById('ai-provider').value;

    entryView.classList.add('hidden');
    loading.classList.remove('hidden');
    
    // Update loading text
    const loadingText = document.querySelector('#suggestions-loading p');
    loadingText.textContent = 'Initializing AI agent...';

    // Rotating funny/engaging messages
    const messages = [
        "Analyzing your portfolio structure...",
        "Identifying optimal allocation strategies...",
        "Evaluating goal feasibility...",
        "Calculating risk-adjusted returns...",
        "Comparing assets against deadlines...",
        "Formulating the perfect plan...",
        "Almost there, finalizing insights..."
    ];
    
    let msgIndex = 0;
    const intervalId = setInterval(() => {
        msgIndex = (msgIndex + 1) % messages.length;
        loadingText.style.opacity = 0;
        setTimeout(() => {
            loadingText.textContent = messages[msgIndex];
            loadingText.style.opacity = 1;
        }, 200); // smooth fade
    }, 2000); // Change every 2 seconds

    // Clear any previous token info
    const existingTokenInfo = document.getElementById('token-usage-info');
    if (existingTokenInfo) existingTokenInfo.remove();

    try {
        const res = await fetch('/api/suggestions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                holdings: savedHoldings, 
                goals: savedGoals,
                provider: provider
            })
        });
        
        const data = await res.json();
        clearInterval(intervalId); // Stop loading messages

        if (data.error) throw new Error(data.error);
        
        currentSuggestions = data.suggestions || [];
        renderSuggestions();
        
        // Show personality summary if available
        if (data.personalitySummary) {
            LocalStore.setPersonality(data.personalitySummary);
            const pSummary = document.getElementById('personality-summary');
            document.getElementById('personality-text').textContent = `"${data.personalitySummary}"`;
            pSummary.classList.remove('hidden');
        }

        // Display Token Usage if available
        if (data.tokenUsage) {
            const usageDiv = document.createElement('div');
            usageDiv.id = 'token-usage-info';
            usageDiv.style.cssText = 'font-size: 0.8rem; color: var(--text-muted); padding: 0.5rem 1rem; text-align: right; border-top: 1px solid var(--card-border); margin-top: 1rem;';
            usageDiv.innerHTML = `
                <span>Token Usage: </span>
                <span title="Prompt Tokens">${data.tokenUsage.promptTokenCount} (In)</span> + 
                <span title="Response Tokens">${data.tokenUsage.candidatesTokenCount} (Out)</span> = 
                <strong>${data.tokenUsage.totalTokenCount} Total</strong>
            `;
            // Insert before the actions buttons
            document.querySelector('.modal-content.wide-modal').insertBefore(usageDiv, actions);
        }

        loading.classList.add('hidden');
        container.classList.remove('hidden');
        actions.classList.remove('hidden');
    } catch (e) {
        console.error(e);
        clearInterval(intervalId); // Stop loading messages
        loading.classList.add('hidden');
        container.classList.remove('hidden');
        container.innerHTML = `<p class="error-banner">Failed to get suggestions: ${e.message}</p>`;
    }
}

function renderSuggestions() {
    const container = document.getElementById('suggestions-container');
    container.innerHTML = '';

    if (currentSuggestions.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding: 2rem;">No suggestions found for current portfolio.</p>';
        return;
    }

    currentSuggestions.forEach((s, index) => {
        const goal = savedGoals.find(g => g.id === s.goalId || g.name === s.goal);
        if (!goal) return;

        const holding = savedHoldings.find(h => h.tradingsymbol === s.stock);
        const value = holding ? (holding.last_price * holding.quantity) : 0;

        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.id = `suggestion-${index}`;
        div.innerHTML = `
            <div class="suggestion-header">
                <div>
                    <span class="suggestion-stock">${s.stock}</span>
                    <span style="font-size:0.8rem; color:var(--text-muted); margin-left: 0.5rem;">${formatCurrency(value)}</span>
                </div>
                <span class="suggestion-goal" style="background:${goal.color}22; color:${goal.color}">
                    Assign to ${goal.name}
                </span>
            </div>
            <div class="suggestion-reason">${s.reason}</div>
            <div class="suggestion-footer">
                <span class="confidence-badge conf-${s.confidence.toLowerCase()}">${s.confidence} confidence</span>
                <div class="suggestion-actions">
                    <button class="btn btn-ghost" onclick="skipSuggestion(${index})">Skip</button>
                    <button class="btn btn-success-sm" onclick="acceptSuggestion(${index})">Accept</button>
                </div>
            </div>
        `;
        container.appendChild(div);
    });
}

function skipSuggestion(index) {
    const el = document.getElementById(`suggestion-${index}`);
    el.style.opacity = '0';
    el.style.transform = 'translateX(20px)';
    setTimeout(() => {
        el.remove();
        // Check if all suggestions are gone
        if (document.querySelectorAll('.suggestion-item').length === 0) {
            closeSuggestions();
        }
    }, 300);
}

async function acceptSuggestion(index) {
    const suggestion = currentSuggestions[index];
    const goal = savedGoals.find(g => g.id === suggestion.goalId || g.name === suggestion.goal);
    
    if (!goal) return;

    try {
        // No API call needed for assignment
        
        savedAssignments[suggestion.stock] = goal.id;
        LocalStore.setAssignments(savedAssignments);

        showToast(`Assigned ${suggestion.stock} to ${goal.name}`);
        skipSuggestion(index); // Remove from list
        renderAllocations();
        renderGoals();
    } catch (e) {
        console.error(e);
        alert("Failed to assign suggestion");
    }
}

async function acceptAllSuggestions() {
    const items = document.querySelectorAll('.suggestion-item');
    let count = 0;

    for (const item of items) {
        const id = item.id.split('-')[1];
        const suggestion = currentSuggestions[id];
        const goal = savedGoals.find(g => g.id === suggestion.goalId || g.name === suggestion.goal);
        
        if (goal) {
            savedAssignments[suggestion.stock] = goal.id;
            count++;
        }
    }
    
    LocalStore.setAssignments(savedAssignments);

    showToast(`Successfully assigned ${count} holdings! ✨`);
    setTimeout(closeSuggestions, 500);
    renderAllocations();
    renderGoals();
}

function closeSuggestions() {
    document.getElementById('suggestions-modal').classList.add('hidden');
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// Event Listeners
document.getElementById('login-btn').addEventListener('click', async () => {
    const res = await fetch('/api/login-url');
    const data = await res.json();
    window.location.href = data.url;
});

const modal = document.getElementById('goal-modal');
document.getElementById('open-goal-modal').addEventListener('click', () => {
    modal.classList.remove('hidden');
});
document.getElementById('close-modal').addEventListener('click', () => {
    modal.classList.add('hidden');
});

document.getElementById('goal-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    
    const newGoal = {
        id: LocalStore.generateId(),
        name: fd.get('name'),
        targetAmount: parseFloat(fd.get('targetAmount')),
        deadline: fd.get('deadline'),
        color: fd.get('color'),
        createdAt: new Date().toISOString()
    };
    
    try {
        // No API call
        savedGoals.push(newGoal);
        LocalStore.setGoals(savedGoals);
        
        renderGoals();
        modal.classList.add('hidden');
        e.target.reset();
    } catch (err) {
        console.error(err);
        alert("Failed to create goal");
    }
});

document.getElementById('get-ai-suggestions').addEventListener('click', openSuggestionsModal);
document.getElementById('start-analysis-btn').addEventListener('click', startAIAnalysis);
document.getElementById('close-suggestions').addEventListener('click', closeSuggestions);
document.getElementById('cancel-suggestions').addEventListener('click', closeSuggestions);
document.getElementById('accept-all-suggestions').addEventListener('click', acceptAllSuggestions);


// Demo Login Handler with Seeding
document.getElementById('demo-btn').addEventListener('click', async () => {
    try {
        await fetch('/api/demo-login', { method: 'POST' });
        LocalStore.setDemoMode('true');
        
        // Seed LocalStorage if empty
        const currentGoals = LocalStore.getGoals();
        if (currentGoals.length === 0) {
            const demoGoals = [
                { id: 'demo_g1', name: 'Dream Home', targetAmount: 5000000, deadline: '2030-12-31', color: '#388bfd', createdAt: new Date().toISOString() },
                { id: 'demo_g2', name: 'New Car', targetAmount: 1500000, deadline: '2026-06-30', color: '#2ea043', createdAt: new Date().toISOString() }
            ];
            LocalStore.setGoals(demoGoals);
        }
        
        window.location.reload();
    } catch (e) {
        alert("Failed to start demo mode");
    }
});

// Data Management: Export & Import
document.getElementById('export-data-btn').addEventListener('click', () => {
    const data = {
        goals: LocalStore.getGoals(),
        assignments: LocalStore.getAssignments(),
        personality: LocalStore.getPersonality(),
        timestamp: new Date().toISOString(),
        version: 1
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kite-goal-tracker-backup-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Configuration exported! ⬇️");
});

document.getElementById('import-data-btn').addEventListener('click', () => {
    document.getElementById('import-file-input').click();
});

document.getElementById('import-file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            
            // Basic validation
            if (Array.isArray(data.goals) && typeof data.assignments === 'object') {
                LocalStore.setGoals(data.goals);
                LocalStore.setAssignments(data.assignments);
                if (data.personality) LocalStore.setPersonality(data.personality);
                
                showToast("Configuration imported successfully! 🔄");
                setTimeout(() => window.location.reload(), 1000); // Reload to reflect changes
            } else {
                alert("Invalid configuration file format.");
            }
        } catch (err) {
            console.error(err);
            alert("Failed to parse JSON file.");
        }
    };
    reader.readAsText(file);
});

document.getElementById('logout-btn').addEventListener('click', async () => {
    try {
        await fetch('/api/logout', { method: 'POST' });
        LocalStore.setDemoMode('false');
        window.location.reload();
    } catch (e) {
        console.error("Logout failed", e);
    }
});

function formatCurrency(num) {
    return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}


// Expose functions to window for onclick handlers in HTML
window.deleteGoal = deleteGoal;
window.confirmAssign = confirmAssign;
window.openAssignmentMenu = openAssignmentMenu;
window.acceptSuggestion = acceptSuggestion;
window.skipSuggestion = skipSuggestion;

init();
