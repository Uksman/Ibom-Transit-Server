const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

const Route = require('./models/Route');
const Bus = require('./models/Bus');
const Hiring = require('./models/Hiring');

async function simulateAppScenario() {
  try {
    console.log('=== Simulating App Scenario ===\n');

    // Get all routes from Kaduna to Calabar
    const routes = await Route.find({
      source: 'Kaduna',
      destination: 'Calabar'
    }).populate('bus');

    console.log('Available Routes:');
    routes.forEach((route, index) => {
      console.log(`${index + 1}. Route ${route._id}: ₦${route.baseFare} per seat, Bus ${route.bus.busNumber} (${route.bus.capacity} seats)`);
    });

    // Test scenario 1: User selects 5-seat bus route
    console.log('\n=== Scenario 1: User selects 5-seat bus (AKTC-001) ===');
    const fiveSeatRoute = routes.find(r => r.bus.capacity === 5);
    if (fiveSeatRoute) {
      const hiring1 = new Hiring({
        purpose: 'Wedding event',
        passengerCount: 20, // User wants to transport 20 people
        route: fiveSeatRoute._id,
        startDate: new Date('2024-08-15T08:00:00Z'),
        endDate: new Date('2024-08-15T18:00:00Z'),
        tripType: 'One-Way',
        estimatedDistance: 500,
        baseRate: fiveSeatRoute.baseFare,
        rateType: 'Route-Based',
        routePriceMultiplier: 1,
        totalCost: 0,
        user: new mongoose.Types.ObjectId(),
        bus: fiveSeatRoute.bus._id
      });

      const cost1 = await hiring1.calculateTotalCost();
      console.log(`Route fare: ₦${fiveSeatRoute.baseFare} per seat`);
      console.log(`Bus capacity: ${fiveSeatRoute.bus.capacity} seats`);
      console.log(`Expected cost: ₦${fiveSeatRoute.baseFare * fiveSeatRoute.bus.capacity}`);
      console.log(`Calculated cost: ₦${cost1}`);
      console.log(`❌ Problem: User wants 20 people but bus only has 5 seats!`);
    }

    // Test scenario 2: User selects 25-seat bus route  
    console.log('\n=== Scenario 2: User selects 25-seat bus (AKTC-123) ===');
    const twentyFiveSeatRoute = routes.find(r => r.bus.capacity === 25);
    if (twentyFiveSeatRoute) {
      const hiring2 = new Hiring({
        purpose: 'Wedding event',
        passengerCount: 20, // User wants to transport 20 people
        route: twentyFiveSeatRoute._id,
        startDate: new Date('2024-08-15T08:00:00Z'),
        endDate: new Date('2024-08-15T18:00:00Z'),
        tripType: 'One-Way',
        estimatedDistance: 500,
        baseRate: twentyFiveSeatRoute.baseFare,
        rateType: 'Route-Based',
        routePriceMultiplier: 1,
        totalCost: 0,
        user: new mongoose.Types.ObjectId(),
        bus: twentyFiveSeatRoute.bus._id
      });

      const cost2 = await hiring2.calculateTotalCost();
      console.log(`Route fare: ₦${twentyFiveSeatRoute.baseFare} per seat`);
      console.log(`Bus capacity: ${twentyFiveSeatRoute.bus.capacity} seats`);
      console.log(`Expected cost: ₦${twentyFiveSeatRoute.baseFare * twentyFiveSeatRoute.bus.capacity}`);
      console.log(`Calculated cost: ₦${cost2}`);
      console.log(`✅ This bus can accommodate 20 people`);
    }

    // Test scenario 3: What if buses got swapped?
    console.log('\n=== Scenario 3: Testing if buses got swapped ===');
    
    if (fiveSeatRoute && twentyFiveSeatRoute) {
      // Test using 25-seat bus with 15k route
      const swappedHiring1 = new Hiring({
        purpose: 'Test swap',
        passengerCount: 20,
        route: fiveSeatRoute._id, // 15k route
        startDate: new Date('2024-08-15T08:00:00Z'),
        endDate: new Date('2024-08-15T18:00:00Z'),
        tripType: 'One-Way',
        estimatedDistance: 500,
        baseRate: fiveSeatRoute.baseFare,
        rateType: 'Route-Based',
        routePriceMultiplier: 1,
        totalCost: 0,
        user: new mongoose.Types.ObjectId(),
        bus: twentyFiveSeatRoute.bus._id // But using 25-seat bus
      });

      const swappedCost1 = await swappedHiring1.calculateTotalCost();
      console.log(`15K route with 25-seat bus: ₦${swappedCost1} (Expected: ₦${15000 * 25})`);
      
      // Test using 5-seat bus with 12k route
      const swappedHiring2 = new Hiring({
        purpose: 'Test swap',
        passengerCount: 20,
        route: twentyFiveSeatRoute._id, // 12k route
        startDate: new Date('2024-08-15T08:00:00Z'),
        endDate: new Date('2024-08-15T18:00:00Z'),
        tripType: 'One-Way',
        estimatedDistance: 500,
        baseRate: twentyFiveSeatRoute.baseFare,
        rateType: 'Route-Based',
        routePriceMultiplier: 1,
        totalCost: 0,
        user: new mongoose.Types.ObjectId(),
        bus: fiveSeatRoute.bus._id // But using 5-seat bus
      });

      const swappedCost2 = await swappedHiring2.calculateTotalCost();
      console.log(`12K route with 5-seat bus: ₦${swappedCost2} (Expected: ₦${12000 * 5})`);
    }

    // Test scenario 4: Check what might cause 240k
    console.log('\n=== Scenario 4: Finding the 240k scenario ===');
    const possibleCombinations = [
      { fare: 15000, capacity: 16 }, // 240k
      { fare: 12000, capacity: 20 }, // 240k
      { fare: 8000, capacity: 30 },  // 240k
      { fare: 6000, capacity: 40 },  // 240k
    ];

    possibleCombinations.forEach(combo => {
      console.log(`₦${combo.fare} × ${combo.capacity} seats = ₦${combo.fare * combo.capacity}`);
    });

  } catch (error) {
    console.error('Error in simulation:', error);
  } finally {
    mongoose.disconnect();
  }
}

// Run the simulation
simulateAppScenario();
