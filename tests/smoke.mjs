import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

const errors = [];
page.on("pageerror", e => errors.push("pageerror: " + e.message));
page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });

await page.goto("http://127.0.0.1:4173/?v=smoke", { waitUntil: "domcontentloaded" });
await page.waitForSelector(".board .sq");
if (await page.locator(".board .sq").count() !== 64) throw new Error("Board does not contain 64 squares");

await page.locator('[data-mode="training"]').click();
await page.waitForSelector("#trainingView:not([hidden])");
const frame = page.locator("#trainingFrame");
if (!(await frame.getAttribute("src")).includes("youtube-nocookie.com/embed/GTJmUt8oyH8")) throw new Error("Training video did not load the expected embedded source");

await page.locator('.training-video-item[data-video="ebfzL_GwiIE"]').click();
if (!(await frame.getAttribute("src")).includes("youtube-nocookie.com/embed/ebfzL_GwiIE")) throw new Error("Training video switcher failed");

await page.locator('[data-mode="play"]').click();
await page.waitForSelector(".content:not([hidden]) .board .sq");
const squares = page.locator(".content:not([hidden]) .board .sq");
if (await squares.count() !== 64) throw new Error("Play board is not 8x8");

const before = await page.locator("#moves .move").count();
const e2 = page.locator('.sq').nth(52);
const e4 = page.locator('.sq').nth(36);
await e2.click();
await e4.click();
await page.waitForTimeout(100);
const after = await page.locator("#moves .move").count();
if (after <= before) throw new Error("Basic e2-e4 move did not register");

if (errors.length) throw new Error(errors.join("\n"));

await browser.close();
console.log("SMOKE TEST PASSED: board, Training page, video switching, and e2-e4 interaction.");
