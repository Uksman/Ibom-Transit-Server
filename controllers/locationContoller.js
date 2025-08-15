const Route = require('../models/Route');

exports.getLocations = async (req, res) => {
  try {
    const routes = await Route.find({}, 'source destination');
    const locationsSet = new Set();

    routes.forEach(route => {
      locationsSet.add(route.source);
      locationsSet.add(route.destination);
    });

    const locations = Array.from(locationsSet).map((loc, index) => ({
      id: index + 1,
      name: loc
    }));

    res.status(200).json({ success: true, data: locations });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
