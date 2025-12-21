const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '../data/db.json');

// Initialize DB if it doesn't exist
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ goals: [], assignments: {} }, null, 2));
}

function readDB() {
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error("Error reading DB", err);
        return { goals: [], assignments: {} };
    }
}

function writeDB(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("Error writing DB", err);
    }
}

module.exports = {
    getGoals: () => readDB().goals,
    saveGoal: (goal) => {
        const db = readDB();
        db.goals.push(goal);
        writeDB(db);
        return goal;
    },
    updateGoal: (id, updatedGoal) => {
        const db = readDB();
        const index = db.goals.findIndex(g => g.id === id);
        if (index !== -1) {
            db.goals[index] = { ...db.goals[index], ...updatedGoal };
            writeDB(db);
            return db.goals[index];
        }
        return null;
    },
    deleteGoal: (id) => {
        const db = readDB();
        const newGoals = db.goals.filter(g => g.id !== id);
        // Also remove assignments for this goal
        // assignments is a map: { "ISIN_OR_SYMBOL": "GOAL_ID" }
        for (const [symbol, goalId] of Object.entries(db.assignments)) {
            if (goalId === id) {
                delete db.assignments[symbol];
            }
        }
        db.goals = newGoals;
        writeDB(db);
    },
    getAssignments: () => readDB().assignments,
    saveAssignment: (scripSymbol, goalId) => {
        const db = readDB();
        if (goalId === null) {
            delete db.assignments[scripSymbol]; // Unassign
        } else {
            db.assignments[scripSymbol] = goalId;
        }
        writeDB(db);
    }
};
