import { db } from "../../lib/db";
import { format } from "date-fns";

export default async function handler(req, res) {
  switch (req.method) {
    case "GET":
      return await getEvents(req, res);
    case "POST":
      return await createEvents(req, res);
    default:
      return res.status(405).json({ error: "Method not allowed" });
  }
}

// Get events for a specific month
async function getEvents(req, res) {
  try {
    const { month } = req.query;

    if (!month) {
      return res.status(400).json({ error: "Month parameter is required" });
    }

    const [year, monthNum] = month.split("-");
    const startDate = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
    const endDate = new Date(parseInt(year), parseInt(monthNum), 0);

    const events = await db.EconomicCalendar.findMany({
      where: {
        eventDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        eventDate: "asc",
      },
    });

    return res.status(200).json(events);
  } catch (error) {
    console.error("Error fetching events:", error);
    return res.status(500).json({
      error: "Failed to fetch events",
      message: error.message,
    });
  }
}

// Create single or multiple events
async function createEvents(req, res) {
  try {
    const { events } = req.body;

    // Handle single event
    if (!Array.isArray(events)) {
      const event = events;
      if (!event.event_name || !event.event_date) {
        return res.status(400).json({
          error: "Missing required fields",
          required: ["event_name", "event_date"],
        });
      }

      const newEvent = await db.economic_events.create({
        data: {
          event_name: event.event_name,
          event_date: new Date(event.event_date),
          asset_impact: event.asset_impact || null,
          description: event.description || null,
          importance_level: event.importance_level || "medium",
        },
      });

      return res.status(201).json({
        success: true,
        message: "Event created successfully",
        event: newEvent,
      });
    }

    // Handle batch events
    if (events.length === 0) {
      return res.status(400).json({
        error: "Invalid request. Please provide at least one event",
      });
    }

    // Process and validate batch events
    const validEvents = events.map((event) => {
      if (!event.event_name || !event.event_date) {
        throw new Error(
          `Invalid event data: Each event must have event_name and event_date`,
        );
      }

      return {
        event_name: event.event_name,
        event_date: new Date(event.event_date),
        asset_impact: event.asset_impact || null,
        description: event.description || null,
        importance_level: event.importance_level || "medium",
      };
    });

    // Insert all events in a transaction
    const result = await db.$transaction(async (tx) => {
      return Promise.all(
        validEvents.map((event) => tx.economic_events.create({ data: event })),
      );
    });

    return res.status(201).json({
      success: true,
      message: `Successfully imported ${result.length} events`,
      events: result,
    });
  } catch (error) {
    console.error("Error creating events:", error);
    return res.status(500).json({
      error: "Failed to create events",
      message: error.message,
    });
  }
}
