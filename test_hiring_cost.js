const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

const Route = require('./models/Route');
const Bus = require('./models/Bus');
const Hiring = require('./models/Hiring');

async function testHiringCostCalculation() {
  try {
    console.log('=== Testing Hiring Cost Calculation ===\n');

    // Find Kaduna to Calabar routes
    const routes = await Route.find({
      source: 'Kaduna',
      destination: 'Calabar'
    }).populate('bus');

    console.log(`Found ${routes.length} routes from Kaduna to Calabar:`);
    
    for (let i = 0; i < routes.length; i++) {
      const route = routes[i];
      console.log(`\nRoute ${i + 1}:`);
      console.log(`- Route ID: ${route._id}`);
      console.log(`- Base Fare: ₦${route.baseFare}`);
      console.log(`- Bus ID: ${route.bus ? route.bus._id : 'No bus assigned'}`);
      console.log(`- Bus Capacity: ${route.bus ? route.bus.capacity : 'N/A'}`);

      if (route.bus) {
        // Create a test hiring instance
        const testHiring = new Hiring({
          purpose: 'Test hiring',
          passengerCount: route.bus.capacity,
          route: route._id,
          startDate: new Date('2024-08-15T08:00:00Z'),
          endDate: new Date('2024-08-15T18:00:00Z'),
          tripType: 'One-Way',
          estimatedDistance: route.distance || 500,
          baseRate: route.baseFare,
          rateType: 'Route-Based',
          routePriceMultiplier: 1, // Should be 1 according to our fix
          totalCost: 0, // Will be calculated
          user: new mongoose.Types.ObjectId(), // Dummy user ID
          bus: route.bus._id
        });

        // Calculate the total cost
        const calculatedCost = await testHiring.calculateTotalCost();
        
        console.log(`\n--- Cost Calculation Details ---`);
        console.log(`Expected calculation: ${route.baseFare} (base fare) × ${route.bus.capacity} (bus capacity) × 1 (multiplier) = ₦${route.baseFare * route.bus.capacity}`);
        console.log(`Actual calculated cost: ₦${calculatedCost}`);
        
        // Test the route's calculateFare method as well
        const routeFare = route.calculateFare({
          date: new Date('2024-08-15T08:00:00Z')
        });
        console.log(`Route fare calculation result:`, routeFare);
        
        console.log(`\n--- Detailed Breakdown ---`);
        console.log(`Base fare per passenger: ₦${route.baseFare}`);
        console.log(`Bus capacity: ${route.bus.capacity} seats`);
        console.log(`Route price multiplier: ${testHiring.routePriceMultiplier}`);
        console.log(`Duration: 1 day (same day hire)`);
        console.log(`Trip type: ${testHiring.tripType}`);
        
        // Manual calculation
        const manualCalculation = route.baseFare * route.bus.capacity * testHiring.routePriceMultiplier;
        console.log(`Manual calculation: ₦${manualCalculation}`);
        
        if (calculatedCost !== manualCalculation) {
          console.log(`❌ MISMATCH! Expected ₦${manualCalculation}, got ₦${calculatedCost}`);
          console.log(`Difference: ₦${calculatedCost - manualCalculation}`);
        } else {
          console.log(`✅ Calculation matches expected result`);
        }
      }
    }

    // Test with different multipliers to see the effect
    console.log('\n=== Testing Different Multipliers ===');
    
    if (routes.length > 0 && routes[0].bus) {
      const route = routes[0];
      const multipliers = [1, 5, 10, 20, 30];
      
      for (const multiplier of multipliers) {
        const testHiring = new Hiring({
          purpose: 'Test hiring with multiplier',
          passengerCount: route.bus.capacity,
          route: route._id,
          startDate: new Date('2024-08-15T08:00:00Z'),
          endDate: new Date('2024-08-15T18:00:00Z'),
          tripType: 'One-Way',
          estimatedDistance: route.distance || 500,
          baseRate: route.baseFare,
          rateType: 'Route-Based',
          routePriceMultiplier: multiplier,
          totalCost: 0,
          user: new mongoose.Types.ObjectId(),
          bus: route.bus._id
        });

        const calculatedCost = await testHiring.calculateTotalCost();
        const expectedCost = route.baseFare * route.bus.capacity * multiplier;
        
        console.log(`Multiplier ${multiplier}: Expected ₦${expectedCost}, Got ₦${calculatedCost}`);
      }
    }

  } catch (error) {
    console.error('Error testing hiring cost calculation:', error);
  } finally {
    mongoose.disconnect();
  }
}

// Run the test
testHiringCostCalculation();
