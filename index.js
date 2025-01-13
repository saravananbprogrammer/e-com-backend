// Import required modules and dependencies
const express = require("express"); // Express for routing and server setup
const mongoose = require("mongoose"); // Mongoose for MongoDB interaction
const multer = require("multer"); // Multer for handling file uploads
const path = require("path"); // Path module for file path operations
const cors = require("cors"); // CORS middleware for cross-origin requests
const fs = require("fs"); // File System module for file operations
const jwt = require("jsonwebtoken"); // JWT for user authentication

// Set the port for the server (use environment variable if available)
const port = process.env.PORT || 4000;

// Initialize Express app
const app = express();

// Middleware to parse JSON requests and enable CORS
app.use(express.json()); // Automatically parses incoming JSON data
app.use(cors()); // Enables Cross-Origin Resource Sharing

// MongoDB connection string (replace credentials for production)
const MONGO_URI =
  "mongodb+srv://saravanantamilan:saravanan6@cluster0.ud0rb.mongodb.net/e-commerce";

// Connect to MongoDB using Mongoose
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Error connecting to MongoDB: ", err));

// Ensure the upload directory exists; create it if not
const uploadDir = "./upload/images";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true }); // Create directory if it doesn't exist
}

// Default route for testing server status
app.get("/", (req, res) => {
  res.send("Express App Is Running!!!"); // Test route
});

// Configure Multer storage engine for handling file uploads
const storage = multer.diskStorage({
  destination: uploadDir, // Directory to store the uploaded files
  filename: (req, file, cb) => {
    const timestamp = Date.now(); // Add timestamp for unique file names
    const extname = path.extname(file.originalname); // Extract file extension
    const baseName = path.basename(file.originalname, extname); // File name without extension
    const newFileName = `${baseName}_${timestamp}${extname}`; // New file name
    cb(null, newFileName); // Set the new file name
  },
});

// Initialize Multer with the storage configuration
const upload = multer({ storage: storage });

// Serve static files from the upload directory
app.use("/images", express.static("upload/images")); // Serve uploaded images

// POST endpoint for uploading images
app.post("/upload", upload.single("product"), (req, res) => {
  if (req.file) {
    // Respond with the file URL if upload is successful
    res.json({
      success: 1,
      image_url: `${req.protocol}://${req.get("host")}/images/${
        req.file.filename
      }`,
    });
  } else {
    // Respond with an error if no file is uploaded
    res.status(400).json({ success: 0, message: "No file uploaded!" });
  }
});

// Define the Product schema for MongoDB
const Product = mongoose.model("Product", {
  id: { type: Number, required: true }, // Unique product ID
  name: { type: String, required: true }, // Product name
  image: { type: String, required: true }, // Product image URL
  category: { type: String, required: true }, // Product category
  new_prices: { type: Number, required: true }, // New price
  old_price: { type: Number, required: true }, // Old price
  date: { type: Date, default: Date.now }, // Date added (default is current date)
  available: { type: Boolean, default: true }, // Availability status
});

// POST endpoint to add a new product to the database
app.post("/addproduct", async (req, res) => {
  // Input validation (ensure all required fields are provided)
  if (
    !req.body.name ||
    !req.body.image ||
    !req.body.category ||
    !req.body.new_prices ||
    !req.body.old_price
  ) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields",
    });
  }

  // Auto-generate a unique product ID
  let products = await Product.find({});
  let id = products.length > 0 ? products[products.length - 1].id + 1 : 1;

  // Create a new product document
  const product = new Product({
    id: id,
    name: req.body.name,
    image: req.body.image,
    category: req.body.category,
    new_prices: req.body.new_prices,
    old_price: req.body.old_price,
  });

  try {
    // Save the product to MongoDB
    await product.save();
    console.log("Product saved!");
    res.json({
      success: true,
      name: req.body.name,
    });
  } catch (error) {
    console.error("Error while saving product: ", error);
    res.status(500).json({
      success: false,
      message: "Failed to save product",
    });
  }
});

// POST endpoint to remove a product by ID
app.post("/removeproduct", async (req, res) => {
  try {
    const result = await Product.findOneAndDelete({ id: req.body.id });
    if (result) {
      res.json({ success: true, message: "Product removed successfully" });
    } else {
      res.status(404).json({ success: false, message: "Product not found" });
    }
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to remove product" });
  }
});

// GET endpoint to fetch all products
app.get("/allproducts", async (req, res) => {
  let products = await Product.find({});
  res.send(products);
});

// Schema creation for user model
const Users = mongoose.model("Users", {
  name: { type: String },
  email: { type: String, unique: true },
  password: { type: String },
  cartData: { type: Object },
  date: { type: Date, default: Date.now },
});

// POST endpoint for registering a user
app.post("/signup", async (req, res) => {
  // Check if a user already exists with the same email
  let check = await Users.findOne({ email: req.body.email });
  if (check) {
    return res.status(400).json({
      success: false,
      errors: "Existing user found with the same email address",
    });
  }

  // Initialize an empty cart with 300 items
  let cart = {};
  for (let i = 0; i < 300; i++) {
    cart[i] = 0; // Initialize all items to quantity 0
  }

  // Create a new user document
  const user = new Users({
    name: req.body.username,
    email: req.body.email,
    password: req.body.password,
    cartData: cart,
  });

  await user.save();

  // Generate JWT token for the user
  const data = { user: { id: user.id } };
  const token = jwt.sign(data, "secret_ecom");
  res.json({ success: true, token });
});

// POST endpoint for user login
app.post("/login", async (req, res) => {
  let user = await Users.findOne({ email: req.body.email });
  if (user) {
    const passCompare = req.body.password === user.password;
    if (passCompare) {
      // Generate JWT token for successful login
      const data = { user: { id: user.id } };
      const token = jwt.sign(data, "secret_ecom");
      res.json({ success: true, token });
    } else {
      res.json({ success: false, errors: "Wrong Password!" });
    }
  } else {
    res.json({ success: false, errors: "Wrong Email Id!" });
  }
});

// GET endpoint for fetching new collection of products (last 8 added)
app.get("/NewCollections", async (req, res) => {
  let products = await Product.find({});
  let newcollection = products.slice(1).slice(-8);
  res.send(newcollection);
});

// GET endpoint for fetching popular products in the women category
app.get("/popularinwomen", async (req, res) => {
  let products = await Product.find({ category: "women" });
  let popular_in_women = products.slice(0, 4);
  res.send(popular_in_women);
});

// Middleware to authenticate user using JWT
const fetchUser = async (req, res, next) => {
  const token = req.header("auth-token");
  if (!token) {
    return res
      .status(401)
      .send({ errors: "Please authenticate using valid username" });
  }

  try {
    const data = jwt.verify(token, "secret_ecom");
    req.user = data.user; // Attach user data to request object
    next();
  } catch (error) {
    res
      .status(401)
      .send({ errors: "Please authenticate using valid username" });
  }
};

// POST endpoint for adding a product to the user's cart
app.post("/addtocart", fetchUser, async (req, res) => {
  let userData = await Users.findOne({ _id: req.user.id });
  userData.cartData[req.body.itemId] += 1; // Increment product quantity in cart
  await Users.findOneAndUpdate(
    { _id: req.user.id },
    { cartData: userData.cartData }
  );
  res.send("Added!");
});

// POST endpoint for removing a product from the user's cart
app.post("/removefromcart", fetchUser, async (req, res) => {
  let userData = await Users.findOne({ _id: req.user.id });
  if (userData.cartData[req.body.itemId] > 0) {
    userData.cartData[req.body.itemId] -= 1; // Decrement product quantity in cart
  }
  await Users.findOneAndUpdate(
    { _id: req.user.id },
    { cartData: userData.cartData }
  );
  res.send("Removed!");
});

// POST endpoint to get the user's cart data
app.post("/getcart", fetchUser, async (req, res) => {
  let userData = await Users.findOne({ _id: req.user.id });
  res.json(userData.cartData); // Return the user's cart data
});

// Start the server and listen on the specified port
app.listen(port, (error) => {
  if (!error) {
    console.log("Server Running On The Port: " + port);
  } else if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use.`);
  } else {
    console.error("Error: " + error);
  }
});
