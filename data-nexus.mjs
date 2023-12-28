/**
 * @fileOverview Script for pulling data from a paginated API and saving it to a file.
 * @module DataPullScript
 */

import axios from "axios";
import fs from "fs/promises";
import ora from "ora";
import dotenv from "dotenv";

dotenv.config();

// Constants for environment variables
const {
  GDS_BASE_URL = "",
  APPLICATION_ID = "",
  APP_URL = "",
  KEY = "",
  TRACE_ID = "",
  RESPONSE_KEY = "",
  FOLDER = "",
} = process.env;

// API configuration
const URL = `${GDS_BASE_URL}${APPLICATION_ID}${APP_URL}`;
const HEADERS = {
  "X-storageapi-key": KEY,
  "X-storageapi-date": Math.floor(Date.now() / 1000),
  "X-Storageapi-Trace-Id": TRACE_ID,
};

// Pagination configuration
const LIMIT = 100;
const PARAMS = {
  limit: LIMIT,
};

// File paths
const PATH = FOLDER;
const currentDate = new Date().toISOString().split('T')[0]; // Get current date in "YYYY-MM-DD" format
const DATA_FILE = `${PATH}/${RESPONSE_KEY}_${currentDate}.json`;
const PAGE_HISTORY_FILE = `${PATH}/${RESPONSE_KEY}_${currentDate}.txt`;

// Ensure folder exists
try {
  await fs.access(PATH);
} catch (error) {
  // Folder doesn't exist, create it
  await fs.mkdir(PATH, { recursive: true });
}

// Initialize variables
let lastPage = 1;
let data = [];
let numOfPages = 0;

// Read last processed page from history file
try {
  const historyData = await fs.readFile(`./${PAGE_HISTORY_FILE}`, { encoding: "utf8" });
  lastPage = Number(historyData) || 1;
} catch (error) {
  console.log("No history found. Begin pull from the beginning");
}

// Read previous data from file if resuming
if (lastPage > 1) {
  console.log("Loading data from file");
  const prevResp = await fs.readFile(`./${DATA_FILE}`, { encoding: "utf8" });
  data = JSON.parse(prevResp);
}

// Initialize loading spinner
const spinner = ora("").start();
console.log("\nBegin data pull");
console.log("\n", URL, JSON.stringify(PARAMS));

// Make initial request to API
try {
  const response = await axios.get(URL, { headers: HEADERS, params: PARAMS });
  const applicationData = response.data.applicationData;
  const appResponse = applicationData[APPLICATION_ID][0]["data"];
  numOfPages = appResponse["paging"]["num_pages"];

  if (lastPage === 1) {
    data.push(...appResponse[RESPONSE_KEY]);
    await writeData();
    await saveLastPage(1);
  } else {
    console.log("Page history found. Resuming data pull");
  }

  // Handle paginated calls
  if (numOfPages > 1) {
    console.log("\nBeginning paginated calls");
    for (let i = lastPage; i < numOfPages; i++) {
      const _params = { ...PARAMS, offset: i * LIMIT };
      const pageNumber = i + 1;
      console.log(`Page ${pageNumber} of ${numOfPages}`);
      console.log(URL, JSON.stringify(_params));

      const paginatedResponse = await axios.get(URL, { headers: HEADERS, params: _params });
      const appResponsePaginated = paginatedResponse.data.applicationData[APPLICATION_ID][0]["data"];
      data.push(...appResponsePaginated[RESPONSE_KEY]);
      await writeData();
      await saveLastPage(pageNumber);
    }
  }
} catch (error) {
  console.error("Error during data pull:", error.message);
}

/**
 * Save last processed page to history file
 * @param {number} pageNumber - The page number to be saved.
 */
async function saveLastPage(pageNumber) {
  try {
    await fs.writeFile(`./${PAGE_HISTORY_FILE}`, JSON.stringify(pageNumber));
  } catch (error) {
    console.error("Error saving last page:", error.message);
  }
}

/**
 * Write data to file
 */
async function writeData() {
  try {
    spinner.text = `Writing to file ${DATA_FILE}`;
    await fs.writeFile(`./${DATA_FILE}`, JSON.stringify(data));
    spinner.text = "";
  } catch (error) {
    console.error("Error writing data:", error.message);
  }
}

spinner.stop();
console.log("Completed!");

export {};