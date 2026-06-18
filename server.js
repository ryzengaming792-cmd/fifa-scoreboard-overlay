const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { fetchLiveScoreFromGoogle } = require('./scraper');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Initial default state
let currentState = {
    team1: { name: 'USA', score: 0, flag: 'us' },
    team2: { name: 'MEX', score: 0, flag: 'mx' },
    timer: { minutes: 0, seconds: 0, isRunning: true }
};

io.on('connection', (socket) => {
    console.log('A user connected to the overlay:', socket.id);
    socket.emit('stateUpdate', currentState);
    
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Update timer locally every second so the overlay stays in sync between scrapes
setInterval(() => {
    if (currentState.timer.isRunning) {
        currentState.timer.seconds++;
        if (currentState.timer.seconds >= 60) {
            currentState.timer.seconds = 0;
            currentState.timer.minutes++;
        }
        io.emit('stateUpdate', currentState);
    }
}, 1000);

// Scrape Google every 30 seconds
async function pollGoogle() {
    console.log("Scraping Google for live scores...");
    const data = await fetchLiveScoreFromGoogle("live world cup match score today");
    
    if (data) {
        console.log("Found match data:", data);
        
        // Detect if a goal was scored
        let t1Goal = data.team1.score > currentState.team1.score;
        let t2Goal = data.team2.score > currentState.team2.score;

        if (t1Goal) {
            io.emit('goalEvent', { team: data.team1.name, name: 'GOAL' });
        } else if (t2Goal) {
            io.emit('goalEvent', { team: data.team2.name, name: 'GOAL' });
        }

        // Parse time if possible (e.g., "45'", "72'")
        let matchMin = currentState.timer.minutes;
        if (data.timeString && data.timeString.includes("'")) {
            matchMin = parseInt(data.timeString) || matchMin;
        }

        // Update state
        currentState = {
            ...currentState,
            team1: { ...currentState.team1, name: data.team1.name, score: data.team1.score },
            team2: { ...currentState.team2, name: data.team2.name, score: data.team2.score },
            timer: { ...currentState.timer, minutes: matchMin }
        };

        io.emit('stateUpdate', currentState);
    } else {
        console.log("No live match data found on Google or failed to parse widget.");
    }
}

// Start polling
pollGoogle();
setInterval(pollGoogle, 30000); // 30 seconds

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`OBS Overlay: http://localhost:${PORT}/overlay.html`);
});
