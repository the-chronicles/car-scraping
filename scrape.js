const puppeteer = require("puppeteer");
const fs = require("fs");
const XLSX = require("xlsx");

(async () => {
  const browser = await puppeteer.launch({ headless: false, timeout: 120000 });
  console.log("Browser launched");

  // console.log("Chromium executable path:", browser.process().spawnfile);
  const page = await browser.newPage();
  console.log("New page created");

  // Navigate to the auction page
  await page.goto("https://www.carstrucksandboats.com/events/3023", {
    waitUntil: "networkidle2",
  });

  // Log in with email and password
  await page.type("#form-login-email", "robertWoolard@gmail.com");
  await page.type("#form-login-password", "FreelanceFaxmail1");
  await page.click(".form__button-submit");

  await page.waitForNavigation({ waitUntil: "networkidle2" });
  console.log("Logged in and navigated to the main page!");

  // Function to scrape vehicle data
  async function scrapeVehicleData(vehiclePage) {
    await vehiclePage.waitForSelector(".vehicle__title");
    const vehicleData = await vehiclePage.evaluate(() => {
      const data = {};
      data.title = document.querySelector(".vehicle__title").innerText;
      data.reserve = document.querySelector(
        ".vehicle__options-bidding"
      ).innerText;
      data.vehiclebid = document.querySelector(
        ".vehicle__bids .vehicle__bid"
      ).innerText;
      data.info = document.querySelector(".vehicle__options-row").innerText;

      return data;
    });

    // Check for the final "Reserve Met" status
    let reserveStatus;
    let bidCount;
    for (let i = 0; i < 10; i++) {
      // Set the number of checks
      reserveStatus = await vehiclePage.evaluate(() => {
        return document.querySelector(".alert-danger strong")?.innerText;
      });
      bidCount = await vehiclePage.evaluate(() => {
        return document.querySelector(".alert-danger span")?.innerText;
      });

      if (reserveStatus === "Reserve Met") {
        vehicleData.reserve = `${reserveStatus} (${bidCount} bids/offers)`;
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds before next check
    }

    console.log(vehicleData);
    return vehicleData;
  }

  // Extract the list of vehicle links
  const vehicleLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll(".c-min__title a")).map(
      (link) => link.href
    );
  });

  console.log(`Found ${vehicleLinks.length} vehicle links`);

  const vehicles = [];
  console.log(vehicles);

  // Loop through each vehicle link
  for (const link of vehicleLinks) {
    try {
      const vehiclePage = await browser.newPage();
      await vehiclePage.goto(link, { waitUntil: "networkidle2" });
      console.log(`Scraping data for vehicle at ${link}`);

      const vehicleData = await scrapeVehicleData(vehiclePage);
      vehicles.push(vehicleData);
      console.log(`Data for vehicle at ${link} scraped successfully`);

      await vehiclePage.close();
    } catch (e) {
      console.log("Error scraping vehicle data:", e);
    }
  }

  console.log(vehicles);
  await browser.close();
  console.log("Browser closed");

  // Write the data to an Excel file
  const worksheet = XLSX.utils.json_to_sheet(vehicles);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Vehicles");
  XLSX.writeFile(workbook, "vehicles_final1.xlsx");
})();
