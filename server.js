require('dotenv').config();
const express = require('express');
const { KiteConnect } = require('kiteconnect');
const app = express();
const cors = require('cors');
const { getGeminiSuggestions } = require('./util/gemini');
const { getOllamaSuggestions } = require('./util/ollama');
const morgan = require('morgan');
const PORT = 3001;

app.use(morgan('dev'));
app.use(express.static('public'));
app.use(express.json());
app.use(cors());

const apiKey = process.env.KITE_API_KEY;
const apiSecret = process.env.KITE_API_SECRET;

// We'll store the access token in memory for this minimal app.
// In a production app, you'd store this in a database or session.
let savedAccessToken = null;
let isDemoMode = false;

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

// --- GOAL TRACKING API ---
// Goals and Assignments are now handled on the client-side (LocalStorage)
// The backend only proxies AI requests and authenticated KiteConnect calls.

// Endpoint to fetch holdings (Authenticated)
app.get('/api/holdings', async (req, res) => {
    if (!savedAccessToken && !isDemoMode) {
        return res.status(401).json({ error: "Not authenticated" });
    }
    
    // Ensure the token is set (redundant if set in callback, but good for safety if we restart kc instance logic)
    if (savedAccessToken) kc.setAccessToken(savedAccessToken);

    try {
        if (isDemoMode) {
            // Return fake holdings
            const demoHoldings = [
                { tradingsymbol: 'INFY', quantity: 50, last_price: 1450.50 },
                { tradingsymbol: 'RELIANCE', quantity: 20, last_price: 2400.00 },
                { tradingsymbol: 'TCS', quantity: 15, last_price: 3500.25 },
                { tradingsymbol: 'HDFCBANK', quantity: 100, last_price: 1600.00 },
                { tradingsymbol: 'NIFTYBEES', quantity: 500, last_price: 210.50 }
            ];
            return res.json(demoHoldings);
        }

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
    res.json({ isAuthenticated: !!savedAccessToken || isDemoMode });
});

app.post('/api/demo-login', (req, res) => {
    isDemoMode = true;
    savedAccessToken = "DEMO_TOKEN"; // Fake token to pass checks
    res.json({ success: true });
});

app.post('/api/logout', (req, res) => {
    savedAccessToken = null;
    isDemoMode = false;
    res.json({ success: true });
});
app.post('/api/suggestions', async (req, res) => {
    const { holdings, goals, provider } = req.body;
    
    // Default to gemini if not specified
    const selectedProvider = provider || 'gemini';

    console.log(`Generating suggestions using provider: ${selectedProvider}`);

    try {
        let result;
        if (selectedProvider === 'ollama') {
            result = await getOllamaSuggestions(holdings, goals, false);
        } else if (selectedProvider === 'ollama-cloud') {
            result = await getOllamaSuggestions(holdings, goals, true);
        } else {
            result = await getGeminiSuggestions(holdings, goals);
        }
        res.json(result);
    } catch (err) {
        console.error("Suggestions Error:", err);
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server started on http://localhost:${PORT}`);
});
