const express = require("express");
const puppeteer = require("puppeteer");
const axios = require("axios");

const app = express();
app.use(express.json());

// Start bot session
app.post("/start-bot", async (req, res) => {
  const { meetingUrl, sessionId } = req.body;

  try {
    const browser = await puppeteer.launch({
      headless: false, 
      args: [
        "--use-fake-ui-for-media-stream", 
        "--use-fake-device-for-media-stream", 
        "--no-sandbox"
      ]
    });

    const page = await browser.newPage();

    // Join Google Meet
    await page.goto(meetingUrl, { waitUntil: "networkidle2" });

    // Simulate joining meeting (this may require login flow handling with cookies)
    // For demo, assume guest access allowed
    await page.waitForSelector("button[jsname='UywwFc-RLmnJb']", { timeout: 60000 });
    await page.click("button[jsname='UywwFc-RLmnJb']");

    console.log(`Bot joined meeting: ${meetingUrl}`);

    // Fetch first question from Rails
    const response = await axios.get(`http://localhost:4000/interviews/${sessionId}/next_question`);
    console.log("First Question:", response.data);

    res.json({ success: true, question: response.data.question });
  } catch (err) {
    console.error("Bot join failed:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(4000, () => {
  console.log("Meet Bot Service running on port 4000");
});
