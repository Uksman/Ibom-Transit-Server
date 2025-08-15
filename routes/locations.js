const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationContoller');

// GET /api/locations
router.get('/', locationController.getLocations);

module.exports = router;
