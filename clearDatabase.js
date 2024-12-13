const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB Connected');

    // Clear all collections
    const collections = Object.keys(mongoose.connection.collections);
    for (const collection of collections) {
      await mongoose.connection.collections[collection].deleteMany({});
      console.log(`Cleared collection: ${collection}`);
    }

    await mongoose.disconnect();
    console.log('Database cleared successfully.');
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

connectDB();
