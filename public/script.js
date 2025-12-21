let savedHoldings = [];
let savedGoals = [];
let savedAssignments = {};

async function init() {
    const statusEl = document.getElementById('status-indicator');
    const loginSection = document.getElementById('login-section');
    
    try {
        const statusRes = await fetch('/api/status');
        const status = await statusRes.json();
        
        if (status.isAuthenticated) {
            statusEl.textContent = 'Connected';
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
        // Fetch Goals, Assignments, and Holdings in parallel
        const [goalsRes, assignRes, holdingsRes] = await Promise.all([
            fetch('/api/goals'),
            fetch('/api/assignments'),
            fetch('/api/holdings')
        ]);

        savedGoals = await goalsRes.json();
        savedAssignments = await assignRes.json();
        
        const hData = await holdingsRes.json();
        savedHoldings = Array.isArray(hData) ? hData : (hData.data || []);

        renderGoals();
        renderAllocations();
        
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
    // For MVP, just a simple prompt or confirm. 
    // Ideally, a nice modal. Let's reuse a simple browser prompt for "Goal ID" 
    // or build a quick selection modal.
    // Let's do a simple prompt for now to prove concept, or better:
    // toggle between "Unassigned" and "Goal 1", "Goal 2"...
    
    // Better UX: Show a dynamic list of goals to click
    
    // Quick and dirty: user types name or we create a proper modal.
    // Let's create a dynamic selection modal on the fly
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
        await fetch('/api/assign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbol, goalId })
        });
        // Update local state and re-render
        if (goalId) {
            savedAssignments[symbol] = goalId;
        } else {
            delete savedAssignments[symbol];
        }
        renderAllocations();
        renderGoals(); // Update progress
    } catch (e) {
        console.error(e);
        alert("Failed to assign");
    }
}

async function deleteGoal(id) {
    if (!confirm("Are you sure? This will unassign all stocks linked to this goal.")) return;
    
    await fetch('/api/goals/' + id, { method: 'DELETE' });
    savedGoals = savedGoals.filter(g => g.id !== id);
    // Remove assignments locally
    for (const k in savedAssignments) {
        if (savedAssignments[k] === id) delete savedAssignments[k];
    }
    renderGoals();
    renderAllocations();
}

// AI Suggestions Logic
let currentSuggestions = [];

async function getAISuggestions() {
    const suggestionsModal = document.getElementById('suggestions-modal');
    const loading = document.getElementById('suggestions-loading');
    const container = document.getElementById('suggestions-container');
    const actions = document.getElementById('suggestions-actions');
    
    // Clear any previous token info
    const existingTokenInfo = document.getElementById('token-usage-info');
    if (existingTokenInfo) existingTokenInfo.remove();
    
    suggestionsModal.classList.remove('hidden');
    loading.classList.remove('hidden');
    container.innerHTML = '';
    actions.classList.add('hidden');

    try {
        const res = await fetch('/api/suggestions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                holdings: savedHoldings, 
                goals: savedGoals 
            })
        });
        
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        
        currentSuggestions = data.suggestions || [];
        renderSuggestions();
        
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
        actions.classList.remove('hidden');
    } catch (e) {
        console.error(e);
        loading.classList.add('hidden');
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
        await fetch('/api/assign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbol: suggestion.stock, goalId: goal.id })
        });
        
        savedAssignments[suggestion.stock] = goal.id;
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
            try {
                await fetch('/api/assign', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ symbol: suggestion.stock, goalId: goal.id })
                });
                savedAssignments[suggestion.stock] = goal.id;
                count++;
            } catch (e) { console.error(e); }
        }
    }

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
    const goalData = {
        name: fd.get('name'),
        targetAmount: fd.get('targetAmount'),
        deadline: fd.get('deadline'),
        color: fd.get('color')
    };
    
    try {
        const res = await fetch('/api/goals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(goalData)
        });
        const newGoal = await res.json();
        savedGoals.push(newGoal);
        renderGoals();
        modal.classList.add('hidden');
        e.target.reset();
    } catch (err) {
        console.error(err);
        alert("Failed to create goal");
    }
});

document.getElementById('get-ai-suggestions').addEventListener('click', getAISuggestions);
document.getElementById('close-suggestions').addEventListener('click', closeSuggestions);
document.getElementById('cancel-suggestions').addEventListener('click', closeSuggestions);
document.getElementById('accept-all-suggestions').addEventListener('click', acceptAllSuggestions);

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

