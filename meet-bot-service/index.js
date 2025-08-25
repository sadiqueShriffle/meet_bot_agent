const express = require("express");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

const app = express();
app.use(express.json());
const activeSessions = new Map();

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

app.post("/start-bot", async (req, res) => {
    const { meetingUrl, sessionId, participantName = "Interview Bot" } = req.body;
    console.log(`Starting bot for session ${sessionId} with meeting URL: ${meetingUrl}`);
    
    try {
        const browser = await puppeteer.launch({
            headless: false,
            args: [
                "--no-sandbox", 
                "--disable-setuid-sandbox",
                "--use-fake-ui-for-media-stream", 
                "--use-fake-device-for-media-stream",
                "--disable-blink-features=AutomationControlled",
                "--disable-web-security",
                "--allow-running-insecure-content",
                "--disable-features=VizDisplayCompositor",
                "--window-size=1280,800",
                "--lang=en-US,en"
            ],
            defaultViewport: { width: 1280, height: 800 }
        });

        const page = await browser.newPage();
        
        // Set user agent and language
        await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9'
        });
        
        // Grant permissions
        const context = browser.defaultBrowserContext();
        await context.overridePermissions('https://meet.google.com', ['microphone', 'camera']);
                
         const stealthPlugin = StealthPlugin(); stealthPlugin.enabledEvasions.delete("iframe.contentWindow"); stealthPlugin.enabledEvasions.delete("media.codecs"); puppeteer.use(stealthPlugin);

        
        console.log("Navigating to meeting URL...");
        
        // Navigate and wait for proper loading
        await page.goto(meetingUrl, { 
            waitUntil: 'networkidle2', 
            timeout: 60000 
        });
        
        // Wait longer for page to fully load
        await delay(8000);
        
        // Check if we're on a blocked page or error page
        const pageUrl = await page.url();
        console.log("Current URL:", pageUrl);
        
        // Check for common error pages
        const pageText = await page.evaluate(() => document.body.innerText);
        if (pageText.includes("You can't join this video call") || 
            pageText.includes("This meeting has ended") ||
            pageText.includes("Need permission") ||
            pageUrl.includes('accounts.google.com') ||
            pageUrl.includes('signin')) {
            
            console.log("Meeting access blocked. Page content:", pageText.substring(0, 500));
            await browser.close();
            
            return res.status(400).json({ 
                success: false, 
                error: "Meeting requires authentication or has ended. Please check the meeting URL and ensure it allows guest access.",
                sessionId 
            });
        }
        
        console.log("Attempting to join meeting...");
        
        // Take screenshot for debugging
        await page.screenshot({ path: `debug-${sessionId}.png` });
        
        // Strategy 1: Look for join buttons with multiple approaches
        let joinSuccess = false;


        try {
            // Look for the specific name input field with the exact selectors from your HTML
            const nameInput = await page.evaluate(() => {
                // Try the specific selectors from your HTML
                const selectors = [
                    'input[jsname="YPqjbf"]',
                    'input[aria-label="Your name"]',
                    'input[placeholder="Your name"]',
                    'input.qdOxv-fmcmS-wGMbrd',
                    'input[type="text"][autocomplete="name"]'
                ];
                
                for (const selector of selectors) {
                    const input = document.querySelector(selector);
                    if (input && input.offsetParent !== null) {
                        return true;
                    }
                }
                return false;
            });
            
            if (nameInput) {
                console.log("Found name input field, entering name...");
                
                // Clear any existing text and enter the participant name
                await page.evaluate((name) => {
                    const input = document.querySelector('input[jsname="YPqjbf"]') || 
                                 document.querySelector('input[aria-label="Your name"]') ||
                                 document.querySelector('input[placeholder="Your name"]') ||
                                 document.querySelector('input.qdOxv-fmcmS-wGMbrd');
                    if (input) {
                        input.value = '';
                        input.focus();
                        input.value = name;
                        // Trigger input event to notify Google Meet
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }, participantName);
                
                await delay(2000);
                
                // Now look for join button after entering name
                const joinClicked = await page.evaluate(() => {
                    const joinSelectors = [
                        'button[jsname="Qx7uuf"]',
                        'button.UywwFc-LgbsSe',
                        'div[role="button"][jsaction*="cOuCgd"]',
                        'button:has(span:has-text("Join now"))',
                        'button:has(span:has-text("Ask to join"))'
                    ];
                    
                    for (const selector of joinSelectors) {
                        const button = document.querySelector(selector);
                        if (button && button.offsetParent !== null) {
                            button.click();
                            return true;
                        }
                    }
                    
                    // Fallback: Find any button with join text
                    const buttons = document.querySelectorAll('button, div[role="button"]');
                    for (const button of buttons) {
                        if (button.offsetParent !== null) {
                            const text = button.textContent || button.innerText || '';
                            if (text.toLowerCase().includes('join') || text.toLowerCase().includes('ask to join')) {
                                button.click();
                                return true;
                            }
                        }
                    }
                    
                    return false;
                });
                
                if (joinClicked) {
                    console.log("Clicked join button after entering name");
                    joinSuccess = true;
                } else {
                    // Try pressing Enter as fallback
                    await page.keyboard.press('Enter');
                    console.log("Pressed Enter after name entry");
                    joinSuccess = true;
                }
            }
        } catch (e) {
            console.log("Name input and join attempt failed:", e.message);
        }
        
        // Try to find and click join button
        try {
            // Method 1: Using specific Google Meet selectors
            const joinButton = await page.evaluateHandle(() => {
                const selectors = [
                    'button[jsname="Qx7uuf"]',
                    'button.UywwFc-LgbsSe',
                    'button[data-tooltip*="join" i]',
                    'div[role="button"][aria-label*="join" i]',
                    'button:has(span:has-text("Join now"))',
                    'button:has(span:has-text("Ask to join"))'
                ];
                
                for (const selector of selectors) {
                    const button = document.querySelector(selector);
                    if (button && button.offsetParent !== null) {
                        return button;
                    }
                }
                
                // Fallback: Find any button with join text
                const buttons = document.querySelectorAll('button, div[role="button"]');
                for (const button of buttons) {
                    if (button.offsetParent !== null) {
                        const text = button.textContent || button.innerText || '';
                        if (text.toLowerCase().includes('join') || text.toLowerCase().includes('ask to join')) {
                            return button;
                        }
                    }
                }
                
                return null;
            });
            
            if (joinButton && joinButton.asElement()) {
                await joinButton.asElement().click();
                console.log("Clicked join button");
                joinSuccess = true;
            }
        } catch (e) {
            console.log("Join button click failed:", e.message);
        }
        
        // Strategy 2: If no button found, try keyboard shortcut or form submission
        if (!joinSuccess) {
            try {
                // Check if we're on a name entry page
                const nameInputs = await page.$$('input[type="text"], input[placeholder*="name" i]');
                if (nameInputs.length > 0) {
                    console.log("Found input field, entering name...");
                    await nameInputs[0].type(participantName);
                    await delay(1000);
                    
                    // Try to submit by pressing Enter
                    await page.keyboard.press('Enter');
                    console.log("Pressed Enter after name entry");
                    joinSuccess = true;
                }
            } catch (e) {
                console.log("Name entry attempt failed:", e.message);
            }
        }
        
        // Wait for meeting to load
        await delay(10000);
        
        // Check if we successfully joined
        const inMeeting = await page.evaluate(() => {
            // Check for meeting indicators
            const indicators = [
                document.querySelector('[data-participant-id]'),
                document.querySelector('.participants-pane'),
                document.querySelector('[data-self-name]'),
                document.querySelector('video'),
                document.querySelector('[aria-label*="turn off camera" i]'),
                document.querySelector('[aria-label*="mute microphone" i]')
            ];
            
            return indicators.some(indicator => indicator !== null);
        });
        
        if (inMeeting) {
            console.log("✅ Successfully joined the meeting");
            
            // Turn off camera and mic
            try {
                await delay(3000);
                
                // Turn off camera
                const cameraButton = await page.$('[aria-label*="camera" i], [data-tooltip*="camera" i]');
                if (cameraButton) {
                    await cameraButton.click();
                    console.log("Camera turned off");
                    await delay(1000);
                }
                
                // Turn off microphone
                const micButton = await page.$('[aria-label*="microphone" i], [data-tooltip*="microphone" i]');
                if (micButton) {
                    await micButton.click();
                    console.log("Microphone turned off");
                }
            } catch (e) {
                console.log("Could not disable media:", e.message);
            }
        }
        
        // Store session
        activeSessions.set(sessionId, { 
            browser, 
            page, 
            meetingUrl, 
            status: inMeeting ? 'joined' : 'failed',
            participantName 
        });
        
        res.json({ 
            success: inMeeting, 
            message: inMeeting ? "Bot successfully joined meeting" : "Failed to join meeting",
            sessionId,
            status: inMeeting ? 'joined' : 'failed'
        });
        
    } catch (err) {
        console.error("Bot join failed:", err.message);
        res.status(500).json({ 
            success: false, 
            error: err.message,
            sessionId 
        });
    }
});

// Add this endpoint to debug the current page
app.get("/debug-page/:sessionId", async (req, res) => {
    const { sessionId } = req.params;
    const session = activeSessions.get(sessionId);
    
    if (!session) {
        return res.status(404).json({ error: "Session not found" });
    }
    
    try {
        const pageContent = await session.page.content();
        const pageUrl = await session.page.url();
        const pageText = await session.page.evaluate(() => document.body.innerText);
        
        res.json({
            url: pageUrl,
            content: pageContent.substring(0, 2000),
            text: pageText.substring(0, 1000)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(4000, () => {
    console.log("Meet Bot Service running on port 4000");
    console.log("Available endpoints:");
    console.log("  POST /start-bot - Start a new bot session");
    console.log("  GET /session-status/:sessionId - Check session status");
    console.log("  POST /stop-bot - Stop a bot session");
});
