const socket = io();

// DOM Elements
const timeEl = document.getElementById('match-time');
const t1Name = document.getElementById('name-t1');
const t2Name = document.getElementById('name-t2');
const t1Score = document.getElementById('score-t1');
const t2Score = document.getElementById('score-t2');
const t1Flag = document.getElementById('flag-t1');
const t2Flag = document.getElementById('flag-t2');

const goalPopup = document.getElementById('goal-popup');
const goalScorerTeam = document.getElementById('goal-scorer-team');
const goalScorerName = document.getElementById('goal-scorer-name');

// Update UI based on state
socket.on('stateUpdate', (state) => {
    // Timer
    const min = String(state.timer.minutes).padStart(2, '0');
    const sec = String(state.timer.seconds).padStart(2, '0');
    timeEl.textContent = `${min}:${sec}`;

    // Team 1
    t1Name.textContent = state.team1.name;
    t1Score.textContent = state.team1.score;
    t1Flag.src = `https://flagcdn.com/w80/${state.team1.flag}.png`;

    // Team 2
    t2Name.textContent = state.team2.name;
    t2Score.textContent = state.team2.score;
    t2Flag.src = `https://flagcdn.com/w80/${state.team2.flag}.png`;
});

// Handle Goal Event
socket.on('goalEvent', (data) => {
    // data: { team: 'ARG', name: 'L. MESSI' }
    goalScorerTeam.textContent = data.team;
    goalScorerName.textContent = data.name;

    // Trigger Animation
    goalPopup.classList.remove('hidden');
    goalPopup.classList.remove('animate');
    
    // Force reflow
    void goalPopup.offsetWidth;
    
    goalPopup.classList.add('animate');

    // Hide after animation finishes (5s delay + 0.5s slideOut)
    setTimeout(() => {
        goalPopup.classList.add('hidden');
        goalPopup.classList.remove('animate');
    }, 5500);
});
