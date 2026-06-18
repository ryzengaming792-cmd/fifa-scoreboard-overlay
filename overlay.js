// DOM Elements
const timeEl = document.getElementById('match-time');
const t1Name = document.getElementById('name-t1');
const t2Name = document.getElementById('name-t2');
const t1Score = document.getElementById('score-t1');
const t2Score = document.getElementById('score-t2');
const matchStatus = document.getElementById('match-status');
const scoreDivider = document.querySelector('.score-divider');

const t1Flag = document.getElementById('flag-t1');
const t2Flag = document.getElementById('flag-t2');

const goalPopup = document.getElementById('goal-popup');
const goalScorerTeam = document.getElementById('goal-scorer-team');

let currentState = {
    isLive: false,
    team1: { name: 'USA', score: 0 },
    team2: { name: 'MEX', score: 0 },
    timer: { minutes: 0, seconds: 0, isRunning: false }
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
    if (currentState.isLive) {
        // Show timer and set status to LIVE
        timeEl.style.display = 'block';
        const min = String(currentState.timer.minutes).padStart(2, '0');
        const sec = String(currentState.timer.seconds).padStart(2, '0');
        timeEl.textContent = `${min}:${sec}`;
        matchStatus.textContent = 'LIVE';

        // Show actual scores
        t1Score.style.display = 'inline';
        t2Score.style.display = 'inline';
        t1Score.textContent = currentState.team1.score;
        t2Score.textContent = currentState.team2.score;
        scoreDivider.textContent = '-';
    } else {
        // Upcoming State
        timeEl.style.display = 'none';
        matchStatus.textContent = 'UPCOMING MATCH';

        // Hide scores, show VS
        t1Score.style.display = 'none';
        t2Score.style.display = 'none';
        scoreDivider.textContent = 'VS';
    }

    // Teams
    t1Name.textContent = currentState.team1.name;
    t2Name.textContent = currentState.team2.name;
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

// Fetch real-time data from ESPN's public JSON API
async function pollESPN() {
    console.log("Fetching live scores from ESPN...");
    try {
        const res = await fetch("https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard");
        if (!res.ok) return;
        
        const data = await res.json();
        
        if (data.events && data.events.length > 0) {
            // Find a live match first, otherwise fallback to the first upcoming match
            let targetEvent = data.events.find(e => e.status.type.state === 'in') || data.events[0];
            
            const comp = targetEvent.competitions[0];
            const home = comp.competitors[0];
            const away = comp.competitors[1];

            const newT1Name = home.team.abbreviation.substring(0, 3).toUpperCase();
            const newT2Name = away.team.abbreviation.substring(0, 3).toUpperCase();
            const newT1Score = parseInt(home.score) || 0;
            const newT2Score = parseInt(away.score) || 0;
            
            // Check match state
            const isMatchLive = targetEvent.status.type.state === 'in';
            
            if (isMatchLive) {
                // Goal Detection
                if (currentState.isLive) {
                    if (newT1Score > currentState.team1.score) triggerGoalAnimation(newT1Name);
                    if (newT2Score > currentState.team2.score) triggerGoalAnimation(newT2Name);
                }
                
                currentState.isLive = true;
                currentState.timer.isRunning = true;
                
                // Parse exact minutes from ESPN display clock (e.g., "45'")
                let clockStr = targetEvent.status.displayClock || "0";
                currentState.timer.minutes = parseInt(clockStr.replace("'", "")) || currentState.timer.minutes;
            } else {
                console.log("Match found but hasn't started yet. Staying in upcoming mode.");
                currentState.isLive = false;
                currentState.timer.isRunning = false;
            }

            currentState.team1.name = newT1Name;
            currentState.team1.score = newT1Score;
            currentState.team2.name = newT2Name;
            currentState.team2.score = newT2Score;
            
            // Update flags if available
            if (home.team.logo) t1Flag.src = home.team.logo;
            if (away.team.logo) t2Flag.src = away.team.logo;

            updateDOM();
        } else {
            console.log("No World Cup events found.");
        }
    } catch (e) {
        console.error("Failed to parse live scores", e);
    }
}

// Initial update and start polling every 30 seconds
updateDOM();
pollESPN();
setInterval(pollESPN, 30000);
