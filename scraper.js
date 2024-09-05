const puppeteer = require("puppeteer");
const fs = require("fs");
const XLSX = require("xlsx");

(async () => {
  const browser = await puppeteer.launch({ headless: false, timeout: 120000 });
  const page = await browser.newPage();

  // Navigate to the auction page
  await page.goto("https://www.carstrucksandboats.com/events/3045", {
    waitUntil: "networkidle2",
  });

  // Log in with email and password
  await page.type("#form-login-email", "robertWoolard@gmail.com");
  await page.type("#form-login-password", "FreelanceFaxmail1");
  await page.click(".form__button-submit");

  await page.waitForNavigation({ waitUntil: "networkidle2" });

  // Function to scrape vehicle data
  async function scrapeVehicleData(vehiclePage) {
    // await vehiclePage.waitForSelector(".vehicle__title");
    // const vehicleData = await vehiclePage.evaluate(() => {
    //   const data = {};
    //   data.title = document.querySelector(".vehicle__title").innerText;
    //   data.reserve = document.querySelector(".vehicle__options-bidding").innerText;
    //   data.vehiclebid = document.querySelector(".vehicle__bids .vehicle__bid").innerText;
    //   data.info = document.querySelector(".vehicle__options-row").innerText;
    //   return data;
    // });


    const vehicleData = await vehiclePage.evaluate(() => {
      const data = {};
      
      // Extract title
      data.title = document.querySelector(".vehicle__title").innerText;
      
      // Extract reserve and bid information
      const reserveStatus = document.querySelector(".vehicle__options-bidding strong")?.innerText || "No Reserve Info";
      const bidCountElement = document.querySelector(".vehicle__options-bidding span span")?.innerText || "0";
      const bids = parseInt(bidCountElement.trim(), 10); // Get the number of bids
  
      // Check if there are any bids
      if (bids === 0) {
        data.reserve = "No Bids";
      } else {
        data.reserve = reserveStatus.includes("Reserve Not Met") ? "Reserve Not Met" : "Reserve Met";
      }
  
      // Extract bid amount
      data.vehiclebid = document.querySelector(".vehicle__bids .vehicle__bid")?.innerText || "No Bid Info";
      data.info = document.querySelector(".vehicle__options-row")?.innerText || "No Vehicle Info";
  
      return data;
    });

    let isAuctionCompleted = false;
    let reserveStatus;
    let bidCount;

    while (!isAuctionCompleted) {
      reserveStatus = await vehiclePage.evaluate(() => {
        return document.querySelector(".alert-danger strong")?.innerText || "";
      });
      bidCount = await vehiclePage.evaluate(() => {
        return document.querySelector(".alert-danger span")?.innerText || "0";
      });

      if (reserveStatus === "Reserve Met") {
        vehicleData.reserve = `${reserveStatus} (${bidCount} bids/offers)`;
      }

      // Checks if auction has ended 
      const auctionEnded = await vehiclePage.evaluate(() => {
        const soldElement = document.querySelector(".auction-closed-indicator"); // Change this to the actual class/selector for the auction end
        return soldElement ? soldElement.innerText.includes("Sold") || soldElement.innerText.includes("Closed") : false;
      });

      if (auctionEnded) {
        console.log(`Auction ended for vehicle: ${vehicleData.title}`);
        isAuctionCompleted = true;
      } else {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    return vehicleData;
  }

  // Extract the list of vehicle links
  const vehicleLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll(".c-min__title a")).map(link => link.href);
  });

  const vehicles = [];

  // Loop through each vehicle link
  for (const link of vehicleLinks) {
    try {
      const vehiclePage = await browser.newPage();
      await vehiclePage.goto(link, { waitUntil: "networkidle2" });

      const vehicleData = await scrapeVehicleData(vehiclePage);
      vehicles.push(vehicleData);

      await vehiclePage.close();
    } catch (e) {
      console.log("Error scraping vehicle data:", e);
    }
  }

  await browser.close();

  // Write the data to an Excel file
  const worksheet = XLSX.utils.json_to_sheet(vehicles);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Vehicles");
  XLSX.writeFile(workbook, "vehicles_final.xlsx");
})();
