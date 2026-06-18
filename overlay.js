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
const latestGoalBanner = document.getElementById('latest-goal');
const latestGoalText = document.getElementById('latest-goal-text');

let currentState = {
    isLive: false,
    team1: { name: 'USA', score: 0 },
    team2: { name: 'MEX', score: 0 },
    timer: { minutes: 0, seconds: 0, isRunning: false }
};

let completedMatches = new Set();
let latestMatchEndTimestamp = null;
const FIVE_MINUTES = 5 * 60 * 1000;

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
        timeEl.style.display = 'block';
        const min = String(currentState.timer.minutes).padStart(2, '0');
        const sec = String(currentState.timer.seconds).padStart(2, '0');
        timeEl.textContent = `${min}:${sec}`;

        t1Score.style.display = 'inline';
        t2Score.style.display = 'inline';
        t1Score.textContent = currentState.team1.score;
        t2Score.textContent = currentState.team2.score;
        scoreDivider.textContent = '-';
    } else {
        timeEl.style.display = 'none';
        t1Score.style.display = 'none';
        t2Score.style.display = 'none';
        scoreDivider.textContent = 'VS';
    }

    t1Name.textContent = currentState.team1.name;
    t2Name.textContent = currentState.team2.name;
}

function triggerGoalAnimation(teamName, scorerText) {
    goalScorerTeam.textContent = teamName;
    goalPopup.classList.remove('hidden');
    goalPopup.classList.remove('animate');
    
    // Force reflow
    void goalPopup.offsetWidth;
    
    goalPopup.classList.add('animate');
    
    // Update the latest goal banner below scoreboard
    latestGoalText.textContent = scorerText || `${teamName} Scored!`;
    latestGoalBanner.classList.remove('hidden');

    // Add celebration glow to the main overlay itself
    const scoreboardContainer = document.querySelector('.scoreboard-container');
    scoreboardContainer.classList.add('goal-celebration');

    // Hide popup and remove main overlay glow after animation
    setTimeout(() => {
        goalPopup.classList.add('hidden');
        goalPopup.classList.remove('animate');
        scoreboardContainer.classList.remove('goal-celebration');
    }, 8500);
    
    // Note: The latestGoalBanner is NO LONGER hidden after 30 seconds.
    // It remains visible until the match ends or switches state.
}

// Fetch real-time data with AbortController to prevent OBS crashes
async function fetchWithTimeout(resource, options = {}) {
    const { timeout = 5000 } = options;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    const response = await fetch(resource, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
}

async function pollESPN() {
    try {
        const res = await fetchWithTimeout("https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard", { timeout: 5000 });
        if (!res.ok) return;
        
        const data = await res.json();
        
        if (data.events && data.events.length > 0) {
            
            // Filter out completed matches that have expired their 5-minute cooldown
            const validEvents = data.events.filter(e => !completedMatches.has(e.id));
            if (validEvents.length === 0) return; // All matches completed and expired
            
            // Priority: 1. In-progress 2. Just finished (within 5 mins) 3. Next upcoming
            let targetEvent = validEvents.find(e => e.status.type.state === 'in') 
                           || validEvents.find(e => e.status.type.state === 'post')
                           || validEvents[0];
                           
            const comp = targetEvent.competitions[0];
            const home = comp.competitors[0];
            const away = comp.competitors[1];

            const newT1Name = home.team.abbreviation.substring(0, 3).toUpperCase();
            const newT2Name = away.team.abbreviation.substring(0, 3).toUpperCase();
            const newT1Score = parseInt(home.score) || 0;
            const newT2Score = parseInt(away.score) || 0;
            
            // Match Status Logic
            const state = targetEvent.status.type.state;
            const stateName = targetEvent.status.type.name;
            
            if (state === 'in') {
                currentState.isLive = true;
                if (stateName === 'STATUS_HALFTIME') {
                    currentState.timer.isRunning = false;
                    matchStatus.textContent = 'HALF TIME';
                } else {
                    currentState.timer.isRunning = true;
                    matchStatus.textContent = 'LIVE';
                }
                
                // Parse exact minutes
                let clockStr = targetEvent.status.displayClock || "0";
                currentState.timer.minutes = parseInt(clockStr.replace("'", "")) || currentState.timer.minutes;
                
            } else if (state === 'post') {
                currentState.isLive = true;
                currentState.timer.isRunning = false;
                matchStatus.textContent = 'MATCH ENDED';
                
                // Hide goal banner since match is over
                latestGoalBanner.classList.add('hidden');
                
                // Handle 5-minute cooldown
                if (!latestMatchEndTimestamp) {
                    latestMatchEndTimestamp = Date.now();
                } else if (Date.now() - latestMatchEndTimestamp > FIVE_MINUTES) {
                    // Match has been over for 5 minutes, blacklist it so we switch to next upcoming
                    completedMatches.add(targetEvent.id);
                    latestMatchEndTimestamp = null; // Reset for next match
                    return pollESPN(); // Instantly poll again to grab the next match
                }
                
            } else {
                // Upcoming
                currentState.isLive = false;
                currentState.timer.isRunning = false;
                matchStatus.textContent = 'UPCOMING MATCH';
                
                // Ensure goal banner is hidden for upcoming matches
                latestGoalBanner.classList.add('hidden');
            }
            
            // Goal Detection
            if (currentState.isLive && state === 'in' && stateName !== 'STATUS_HALFTIME') {
                let scorerText = null;
                
                // Try to find the latest scoring play details
                if (comp.details && comp.details.length > 0) {
                    const latestGoal = comp.details[comp.details.length - 1];
                    const clock = latestGoal.clock ? latestGoal.clock.displayValue : '';
                    const player = latestGoal.participants && latestGoal.participants[0] ? latestGoal.participants[0].athlete.displayName : 'Player';
                    scorerText = `${player} (${clock})`;
                }

                if (newT1Score > currentState.team1.score) triggerGoalAnimation(newT1Name, scorerText);
                if (newT2Score > currentState.team2.score) triggerGoalAnimation(newT2Name, scorerText);
            }

            currentState.team1.name = newT1Name;
            currentState.team1.score = newT1Score;
            currentState.team2.name = newT2Name;
            currentState.team2.score = newT2Score;
            
            // Update flags if available
            if (home.team.logo) t1Flag.src = home.team.logo;
            if (away.team.logo) t2Flag.src = away.team.logo;

            updateDOM();
        }
    } catch (e) {
        // AbortController throws an AbortError if it times out
        if (e.name === 'AbortError') {
            console.warn("Fetch aborted due to timeout to prevent OBS crash.");
        } else {
            console.error("Failed to fetch live scores", e);
        }
    }
}

// Initial update and start polling every 15 seconds
updateDOM();
pollESPN();
setInterval(pollESPN, 15000);
