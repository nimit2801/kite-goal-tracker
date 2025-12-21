require('dotenv').config();
const express = require('express');
const { KiteConnect } = require('kiteconnect');
const app = express();
const cors = require('cors');
const PORT = 3001;

app.use(express.static('public'));
app.use(express.json());
app.use(cors());

const apiKey = process.env.KITE_API_KEY;
const apiSecret = process.env.KITE_API_SECRET;

// We'll store the access token in memory for this minimal app.
// In a production app, you'd store this in a database or session.
let savedAccessToken = null;

const kc = new KiteConnect({
    api_key: apiKey
});

// Endpoint to get the login URL
app.get('/api/login-url', (req, res) => {
    if (!apiKey) {
        return res.status(500).json({ error: "API Key is not configured in .env" });
    }
    const loginUrl = kc.getLoginURL();
    res.json({ url: loginUrl });
});

// Callback endpoint for Kite Connect to redirect to
app.get('/callback', async (req, res) => {
    const requestToken = req.query.request_token;
    if (!requestToken) {
        return res.status(400).send("Error: No request token provided in callback.");
    }

    if (!apiSecret) {
        return res.status(500).send("Error: API Secret is not configured in .env");
    }

    try {
        console.log("Generating session with request token:", requestToken);
        const response = await kc.generateSession(requestToken, apiSecret);
        
        savedAccessToken = response.access_token;
        kc.setAccessToken(savedAccessToken);
        
        console.log("Session generated successfully.");
        // Redirect back to the main page
        res.redirect('/');
    } catch (err) {
        console.error("Error generating session:", err);
        res.status(500).send(`Error generating session: ${err.message}`);
    }
});

// Endpoint to fetch holdings
app.get('/api/holdings', async (req, res) => {
    if (!savedAccessToken) {
        return res.status(401).json({ error: "Not authenticated" });
    }
    
    // Ensure the token is set (redundant if set in callback, but good for safety if we restart kc instance logic)
    kc.setAccessToken(savedAccessToken);

    try {
        const holdings = await kc.getHoldings();
        res.json(holdings);
    } catch (err) {
        console.error("Error fetching holdings:", err);
        // If the token is invalid (e.g. expired), clearing it might be good, 
        // but let's just return the error for now.
        res.status(500).json({ error: "Failed to fetch holdings: " + err.message });
    }
});

// Endpoint to check auth status
app.get('/api/status', (req, res) => {
    res.json({ isAuthenticated: !!savedAccessToken });
});

// --- GOAL TRACKING API ---
const store = require('./util/store'); 
// Actually, let's just use a simple random ID generator to avoid installing more deps if possible, 
// OR just assume we can restart the server to install. I'll just use Date.now().toString(36) + Math.random().toString(36).substr(2)

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

app.get('/api/goals', (req, res) => {
    res.json(store.getGoals());
});

app.post('/api/goals', (req, res) => {
    const { name, targetAmount, deadline, color } = req.body;
    if (!name || !targetAmount) {
        return res.status(400).json({ error: "Name and Target Amount are required" });
    }
    const newGoal = {
        id: generateId(),
        name,
        targetAmount: parseFloat(targetAmount),
        deadline,
        color: color || '#388bfd',
        createdAt: new Date().toISOString()
    };
    store.saveGoal(newGoal);
    res.json(newGoal);
});

app.delete('/api/goals/:id', (req, res) => {
    store.deleteGoal(req.params.id);
    res.json({ success: true });
});

app.get('/api/assignments', (req, res) => {
    res.json(store.getAssignments());
});

app.post('/api/assign', (req, res) => {
    // tradingSymbol (from Kite) -> goalId
    const { symbol, goalId } = req.body;
    if (!symbol) {
        return res.status(400).json({ error: "Symbol is required" });
    }
    store.saveAssignment(symbol, goalId); // goalId can be null to unassign
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`Server started on http://localhost:${PORT}`);
});
