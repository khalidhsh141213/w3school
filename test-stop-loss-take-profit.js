// Test script for stop loss and take profit functionality
import axios from 'axios';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Base URL for API calls
const API_BASE_URL = process.env.API_BASE_URL || 'https://e90ebeb2-9e6f-4f59-9fa4-a91d31143877-00-2lpww91saph8p.kirk.replit.dev';

// Test user credentials (match with what exists in the database)
const TEST_USER = {
  username: 'admin',
  password: 'admin123'
};

// Get some forex symbols that exist in the system
const TEST_BUY_TRADE = {
  symbol: 'EURUSD',
  type: 'buy',
  amount: 10,
  stopLoss: 1.05, // Set a stop loss below the current price
  takeProfit: 1.10 // Set a take profit above the current price
};

const TEST_SELL_TRADE = {
  symbol: 'USDJPY',
  type: 'sell',
  amount: 5,
  stopLoss: 155.00, // Set a stop loss above the current price
  takeProfit: 145.00 // Set a take profit below the current price
};

// Main test function
async function runTest() {
  try {
    console.log('Starting stop loss and take profit test at', new Date().toISOString());
    
    // Step 1: Login to get session cookie
    console.log('Step 1: Logging in...');
    const loginResponse = await axios.post(`${API_BASE_URL}/api/auth/login`, TEST_USER, {
      withCredentials: true
    });
    
    if (loginResponse.status !== 200) {
      throw new Error(`Login failed: ${loginResponse.statusText}`);
    }
    
    const cookies = loginResponse.headers['set-cookie'];
    const axiosConfig = {
      headers: {
        Cookie: cookies
      },
      withCredentials: true
    };
    
    console.log('Login successful');
    
    // Step 2: Create a buy trade with stop loss and take profit
    console.log('\nStep 2: Creating buy trade with stop loss and take profit...');
    const buyTradeResponse = await axios.post(
      `${API_BASE_URL}/api/trade/open`,
      TEST_BUY_TRADE,
      axiosConfig
    );
    
    if (buyTradeResponse.status !== 200) {
      throw new Error(`Failed to create buy trade: ${buyTradeResponse.statusText}`);
    }
    
    const buyTrade = buyTradeResponse.data;
    console.log(`Buy trade created successfully:
    - Trade ID: ${buyTrade.id}
    - Symbol: ${buyTrade.symbol}
    - Type: ${buyTrade.type}
    - Amount: ${buyTrade.amount}
    - Price: ${buyTrade.price}
    - Stop Loss: ${buyTrade.stopLoss}
    - Take Profit: ${buyTrade.takeProfit}
    `);
    
    // Step 3: Create a sell trade with stop loss and take profit
    console.log('\nStep 3: Creating sell trade with stop loss and take profit...');
    const sellTradeResponse = await axios.post(
      `${API_BASE_URL}/api/trade/open`,
      TEST_SELL_TRADE,
      axiosConfig
    );
    
    if (sellTradeResponse.status !== 200) {
      throw new Error(`Failed to create sell trade: ${sellTradeResponse.statusText}`);
    }
    
    const sellTrade = sellTradeResponse.data;
    console.log(`Sell trade created successfully:
    - Trade ID: ${sellTrade.id}
    - Symbol: ${sellTrade.symbol}
    - Type: ${sellTrade.type}
    - Amount: ${sellTrade.amount}
    - Price: ${sellTrade.price}
    - Stop Loss: ${sellTrade.stopLoss}
    - Take Profit: ${sellTrade.takeProfit}
    `);
    
    // Step 4: Test the check-conditions endpoint
    console.log('\nStep 4: Testing check-conditions endpoint...');
    const checkResponse = await axios.post(
      `${API_BASE_URL}/api/trade/check-conditions`,
      {},
      axiosConfig
    );
    
    if (checkResponse.status !== 200) {
      throw new Error(`Failed to check trade conditions: ${checkResponse.statusText}`);
    }
    
    console.log('Check conditions response:', checkResponse.data);
    
    // Step 5: Manually close one of the trades
    console.log('\nStep 5: Manually closing the buy trade...');
    const closeResponse = await axios.post(
      `${API_BASE_URL}/api/trade/close`,
      { tradeId: buyTrade.id },
      axiosConfig
    );
    
    if (closeResponse.status !== 200) {
      throw new Error(`Failed to close trade: ${closeResponse.statusText}`);
    }
    
    const closedTrade = closeResponse.data;
    console.log(`Trade closed successfully:
    - Trade ID: ${closedTrade.id}
    - Symbol: ${closedTrade.symbol}
    - Close Price: ${closedTrade.closePrice}
    - Closed By: ${closedTrade.closedBy}
    - Closed At: ${closedTrade.closedAt}
    `);
    
    // Step 6: Fetch user trades to verify
    console.log('\nStep 6: Fetching user trades to verify status...');
    const userTradesResponse = await axios.get(
      `${API_BASE_URL}/api/trades/user/${buyTrade.userId}`,
      axiosConfig
    );
    
    if (userTradesResponse.status !== 200) {
      throw new Error(`Failed to fetch user trades: ${userTradesResponse.statusText}`);
    }
    
    const userTrades = userTradesResponse.data;
    console.log(`Retrieved ${userTrades.length} user trades:`);
    userTrades.forEach(trade => {
      console.log(`- Trade ID: ${trade.id}, Symbol: ${trade.symbol}, Type: ${trade.type}, Status: ${trade.status}, Closed By: ${trade.closedBy || 'N/A'}`);
    });
    
    console.log('\nTest completed successfully!');
    
  } catch (error) {
    console.error('Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
runTest();