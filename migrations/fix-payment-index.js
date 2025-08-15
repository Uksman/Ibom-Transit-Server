const mongoose = require('mongoose');
require('dotenv').config();

async function fixPaymentIndex() {
  try {
    console.log('=== Fixing Payment Index Issue ===\n');
    
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const collection = db.collection('bookings');

    // 1. First, let's see what indexes exist
    console.log('Current indexes on bookings collection:');
    const indexes = await collection.indexes();
    indexes.forEach(index => {
      console.log('- Index:', JSON.stringify(index.key), index.name);
    });

    // 2. Check if the problematic index exists
    const problematicIndex = indexes.find(index => 
      index.key && index.key['payments.transactionId']
    );

    if (problematicIndex) {
      console.log('\nFound problematic index:', problematicIndex.name);
      
      // 3. Drop the problematic index
      console.log('Dropping the index...');
      await collection.dropIndex(problematicIndex.name);
      console.log('✅ Index dropped successfully');
      
      // 4. Create a new sparse index
      console.log('Creating new sparse index...');
      await collection.createIndex(
        { 'payments.transactionId': 1 }, 
        { unique: true, sparse: true, name: 'payments.transactionId_1' }
      );
      console.log('✅ New sparse index created successfully');
    } else {
      console.log('\nNo problematic index found. Creating sparse index...');
      
      // Just create the sparse index
      await collection.createIndex(
        { 'payments.transactionId': 1 }, 
        { unique: true, sparse: true, name: 'payments.transactionId_1' }
      );
      console.log('✅ Sparse index created successfully');
    }

    // 5. Show updated indexes
    console.log('\nUpdated indexes on bookings collection:');
    const updatedIndexes = await collection.indexes();
    updatedIndexes.forEach(index => {
      console.log('- Index:', JSON.stringify(index.key), index.name, index.sparse ? '(sparse)' : '');
    });

    console.log('\n✅ Payment index fix completed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing payment index:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the fix
fixPaymentIndex();
