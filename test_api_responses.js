const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

const Route = require('./models/Route');
const Bus = require('./models/Bus');

async function testApiResponses() {
  try {
    console.log('=== Testing API Responses ===\n');

    // 1. Test getAllRoutes equivalent
    console.log('1. Routes API Response:');
    const routes = await Route.find({ isActive: true }).populate('bus');
    
    const routesResponse = routes.map(route => ({
      _id: route._id,
      name: route.name,
      source: route.source,
      destination: route.destination,
      baseFare: route.baseFare,
      distance: route.distance,
      departureTime: route.departureTime,
      arrivalTime: route.arrivalTime,
      bus: route.bus ? {
        _id: route.bus._id,
        busNumber: route.bus.busNumber,
        capacity: route.bus.capacity,
        type: route.bus.type,
        status: route.bus.status
      } : null
    }));

    console.log('Routes:', JSON.stringify(routesResponse, null, 2));

    // 2. Test getAllBuses equivalent
    console.log('\n2. Buses API Response:');
    const buses = await Bus.find({ status: 'Active' });
    
    const busesResponse = buses.map(bus => ({
      _id: bus._id,
      busNumber: bus.busNumber,
      capacity: bus.capacity,
      type: bus.type,
      status: bus.status,
      manufacturer: bus.manufacturer,
      model: bus.model
    }));

    console.log('Buses:', JSON.stringify(busesResponse, null, 2));

    // 3. Test specific route-bus combinations for Kaduna-Calabar
    console.log('\n3. Kaduna to Calabar Route-Bus Combinations:');
    const kadunaCalabharRoutes = await Route.find({
      source: 'Kaduna',
      destination: 'Calabar',
      isActive: true
    }).populate('bus');

    kadunaCalabharRoutes.forEach(route => {
      const expectedCost = route.baseFare * (route.bus ? route.bus.capacity : 0);
      console.log(`Route ${route._id}:`);
      console.log(`  - Base Fare: ₦${route.baseFare}`);
      console.log(`  - Bus: ${route.bus?.busNumber} (${route.bus?.capacity} seats)`);
      console.log(`  - Expected Hiring Cost: ₦${expectedCost}`);
      console.log('');
    });

    // 4. Test if there are any caching or data inconsistency issues
    console.log('4. Data Consistency Check:');
    
    // Check if all routes have valid buses assigned
    const routesWithInvalidBuses = await Route.find({
      isActive: true,
      bus: { $exists: true }
    }).populate('bus');

    const problemRoutes = routesWithInvalidBuses.filter(route => !route.bus);
    if (problemRoutes.length > 0) {
      console.log('❌ Routes with invalid bus references:');
      problemRoutes.forEach(route => {
        console.log(`  - Route ${route._id}: ${route.source} to ${route.destination}`);
      });
    } else {
      console.log('✅ All routes have valid bus references');
    }

  } catch (error) {
    console.error('Error testing API responses:', error);
  } finally {
    mongoose.disconnect();
  }
}

// Run the test
testApiResponses();
