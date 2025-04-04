// Script to periodically check for stop loss and take profit conditions
import axios from 'axios';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Base URL for API calls
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

async function checkTradeConditions() {
  try {
    console.log('Checking trade conditions at', new Date().toISOString());
    
    // Call the endpoint to check and update trades
    const response = await axios.post(`${API_BASE_URL}/api/trade/check-conditions`);
    
    if (response.status === 200) {
      const { message, closedTrades } = response.data;
      console.log(`Result: ${message}`);
      
      if (closedTrades && closedTrades.length > 0) {
        console.log(`Closed trades (${closedTrades.length}):`);
        closedTrades.forEach(trade => {
          console.log(`- Trade ID: ${trade.id}, Symbol: ${trade.symbol}, Type: ${trade.type}, Closed by: ${trade.closedBy}`);
        });
      }
    } else {
      console.log('Failed to check trade conditions');
    }
  } catch (error) {
    console.error('Error checking trade conditions:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run immediately on script start
checkTradeConditions();

// Then run every minute (60000 ms)
const INTERVAL_MS = 60000;
console.log(`Script will check trade conditions every ${INTERVAL_MS/1000} seconds`);
setInterval(checkTradeConditions, INTERVAL_MS);