const axios = require("axios");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function syncEconomicData(type = "all") {
  try {
    const API_KEY = process.env.ECONOMIC_API_KEY;
    if (!API_KEY) {
      throw new Error("Economic API key not found in environment variables");
    }

    if (type === "calendar" || type === "all") {
      await syncCalendarData(API_KEY);
    }

    if (type === "events" || type === "all") {
      await syncEventsData(API_KEY);
    }

    return { success: true, message: `Successfully synced ${type} data` };
  } catch (error) {
    console.error("Error syncing economic data:", error);
    return { success: false, error: error.message };
  }
}

async function syncCalendarData(apiKey) {
  const url = `https://api.economicdata.com/calendar?apikey=${apiKey}`;
  const response = await axios.get(url);

  for (const event of response.data) {
    await prisma.economicCalendar.upsert({
      where: {
        eventId: event.id,
      },
      update: {
        date: new Date(event.date),
        country: event.country,
        event: event.event,
        impact: event.impact,
        forecast: event.forecast,
        previous: event.previous,
      },
      create: {
        eventId: event.id,
        date: new Date(event.date),
        country: event.country,
        event: event.event,
        impact: event.impact,
        forecast: event.forecast,
        previous: event.previous,
      },
    });
  }
}

async function syncEventsData(apiKey) {
  const url = `https://api.economicdata.com/events?apikey=${apiKey}`;
  const response = await axios.get(url);

  for (const event of response.data) {
    await prisma.economicEvents.upsert({
      where: {
        eventId: event.id,
      },
      update: {
        timestamp: new Date(event.timestamp),
        type: event.type,
        description: event.description,
        impact: event.impact,
        region: event.region,
      },
      create: {
        eventId: event.id,
        timestamp: new Date(event.timestamp),
        type: event.type,
        description: event.description,
        impact: event.impact,
        region: event.region,
      },
    });
  }
}

module.exports = {
  syncEconomicData,
};
