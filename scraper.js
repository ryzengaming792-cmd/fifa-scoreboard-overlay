const puppeteer = require('puppeteer');

async function fetchLiveScoreFromGoogle(searchQuery = "live world cup football match") {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new', // Use the new Headless mode
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        
        // Set a realistic user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36');
        
        // Navigate to Google Search
        const url = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&hl=en`;
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        
        // Wait for the sports widget to appear. The class names change, but 'imso_mh' or 'imso' is often used.
        // We will try a robust evaluation that looks for typical score structures.
        const matchData = await page.evaluate(() => {
            try {
                // Heuristic extraction for Google Sports widget
                // Look for team names
                const teamElements = Array.from(document.querySelectorAll('.imso_mh__scr-it, .imso-hide-overflow, .imso_mh__tm-nm, [role="heading"]'));
                
                // If we can't find specific classes, we fallback to a generic search or return a mock if it fails
                // For a real match, Google usually uses `imso_mh__tm-nm` or similar for teams
                const t1Node = document.querySelector('.imso_mh__first-tn-ed, .imso_mh__tm-nm');
                const t2Node = document.querySelectorAll('.imso_mh__second-tn-ed, .imso_mh__tm-nm')[1];
                
                const score1Node = document.querySelector('.imso_mh__l-tm-sc');
                const score2Node = document.querySelector('.imso_mh__r-tm-sc');
                
                const timeNode = document.querySelector('.imso_mh__lv-m-stts-cont');
                
                if (t1Node && t2Node && score1Node && score2Node) {
                    return {
                        team1: { name: t1Node.textContent.trim().substring(0, 3).toUpperCase(), score: parseInt(score1Node.textContent) || 0 },
                        team2: { name: t2Node.textContent.trim().substring(0, 3).toUpperCase(), score: parseInt(score2Node.textContent) || 0 },
                        timeString: timeNode ? timeNode.textContent.trim() : "LIVE"
                    };
                }
                
                return null;
            } catch (e) {
                return null;
            }
        });

        await browser.close();
        return matchData;
        
    } catch (error) {
        console.error("Scraper Error:", error.message);
        if (browser) await browser.close();
        return null;
    }
}

module.exports = { fetchLiveScoreFromGoogle };
