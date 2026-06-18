// DOM Elements
const timeEl = document.getElementById('match-time');
const t1Name = document.getElementById('name-t1');
const t2Name = document.getElementById('name-t2');
const t1Score = document.getElementById('score-t1');
const t2Score = document.getElementById('score-t2');
const matchStatus = document.getElementById('match-status');

const goalPopup = document.getElementById('goal-popup');
const goalScorerTeam = document.getElementById('goal-scorer-team');

let currentState = {
    team1: { name: 'USA', score: 0 },
    team2: { name: 'MEX', score: 0 },
    timer: { minutes: 0, seconds: 0, isRunning: true }
};

// Start local timer loop
setInterval(() => {
    if (currentState.timer.isRunning) {
        currentState.timer.seconds++;
        if (currentState.timer.seconds >= 60) {
            currentState.timer.seconds = 0;
            currentState.timer.minutes++;
        }
        updateDOM();
    }
}, 1000);

function updateDOM() {
    // Timer
    const min = String(currentState.timer.minutes).padStart(2, '0');
    const sec = String(currentState.timer.seconds).padStart(2, '0');
    timeEl.textContent = `${min}:${sec}`;

    // Team 1
    t1Name.textContent = currentState.team1.name;
    t1Score.textContent = currentState.team1.score;

    // Team 2
    t2Name.textContent = currentState.team2.name;
    t2Score.textContent = currentState.team2.score;
}

function triggerGoalAnimation(teamName) {
    goalScorerTeam.textContent = teamName;
    goalPopup.classList.remove('hidden');
    goalPopup.classList.remove('animate');
    
    // Force reflow
    void goalPopup.offsetWidth;
    
    goalPopup.classList.add('animate');

    // Hide after animation finishes (6s delay + 0.5s fadeOut)
    setTimeout(() => {
        goalPopup.classList.add('hidden');
        goalPopup.classList.remove('animate');
    }, 6500);
}

// Polling Google via CORS proxy
async function pollGoogle() {
    console.log("Fetching live scores...");
    try {
        const query = encodeURIComponent("https://www.google.com/search?q=live+football+scores+today");
        // Using corsproxy.io to bypass browser CORS limits
        const res = await fetch(`https://corsproxy.io/?${query}`);
        if (!res.ok) return;
        
        const html = await res.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        
        // Extract teams and scores from Google's Sports Widget (heuristic approach)
        const t1Node = doc.querySelector('.imso_mh__first-tn-ed, .imso_mh__tm-nm, [role="heading"]');
        const t2Nodes = doc.querySelectorAll('.imso_mh__second-tn-ed, .imso_mh__tm-nm, [role="heading"]');
        const t2Node = t2Nodes.length > 1 ? t2Nodes[1] : null;
        
        const score1Node = doc.querySelector('.imso_mh__l-tm-sc');
        const score2Node = doc.querySelector('.imso_mh__r-tm-sc');
        
        if (t1Node && t2Node && score1Node && score2Node) {
            const newT1Name = t1Node.textContent.trim().substring(0, 3).toUpperCase();
            const newT2Name = t2Node.textContent.trim().substring(0, 3).toUpperCase();
            const newT1Score = parseInt(score1Node.textContent) || 0;
            const newT2Score = parseInt(score2Node.textContent) || 0;
            
            // Goal Detection
            if (newT1Score > currentState.team1.score) triggerGoalAnimation(newT1Name);
            if (newT2Score > currentState.team2.score) triggerGoalAnimation(newT2Name);
            
            currentState.team1.name = newT1Name;
            currentState.team1.score = newT1Score;
            currentState.team2.name = newT2Name;
            currentState.team2.score = newT2Score;
        }
    } catch (e) {
        console.error("Failed to parse live scores", e);
    }
}

// Initial update and start polling every 30 seconds
updateDOM();
pollGoogle();
setInterval(pollGoogle, 30000);
