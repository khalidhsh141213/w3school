import {
  checkForEconomicEventNotifications,
  checkEconomicEventCorrelations,
  checkUpcomingVolatilityEvents,
} from "./server/services/notificationService.js";

// Helper function to wait for a specified time
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Main function to run all notification checks
async function runAllNotificationChecks() {
  try {
    console.log("Triggering economic event notification checks...");
    await checkForEconomicEventNotifications();

    // Wait a bit between checks to avoid overwhelming the system
    await wait(2000);

    console.log("Triggering economic event correlation checks...");
    await checkEconomicEventCorrelations();

    await wait(2000);

    console.log("Triggering upcoming volatility event checks...");
    await checkUpcomingVolatilityEvents();

    console.log("All notification checks completed.");
  } catch (error) {
    console.error("Error during notification checks:", error);
  }
}

// Execute all checks
runAllNotificationChecks();
