const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cors = require('cors');
const path = require('path'); // Import path module

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB connection
mongoose.connect('mongodb+srv://adt:adtsh@store.inpfb.mongodb.net/?retryWrites=true&w=majority&appName=store', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => console.log('Connected to MongoDB'));

// Dynamic schema model creation
const models = {};

const getOrCreateModel = (category) => {
    if (!models[category]) {
        const productSchema = new mongoose.Schema({
            name: String,
            price: Number,
            discountedPrice: Number, // Add discounted price field
            description: String,
            weight: Number,
            unit: String,
            discount: { type: Number, default: 0 }, // Optional: Store discount percentage if needed
            images: [Buffer], // Buffer to store binary image data
        });
        models[category] = mongoose.model(category, productSchema);
    }
    return models[category];
};

// Multer setup for image uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Route to fetch all categories
app.get('/categories', async (req, res) => {
    try {
        const collections = await mongoose.connection.db.listCollections().toArray();
        const categoryNames = collections.map((col) => col.name);
        res.status(200).json(categoryNames);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).send('Error fetching categories.');
    }
});

// Route to create a new category
app.post('/categories', async (req, res) => {
    const { category } = req.body;
    try {
        getOrCreateModel(category); // Ensure schema exists for the category
        res.status(201).send('Category created successfully.');
    } catch (error) {
        console.error('Error creating category:', error);
        res.status(500).send('Error creating category.');
    }
});

// Route to add a product to a category
app.post('/products/:category', upload.array('images', 10), async (req, res) => {
    const { category } = req.params;
    const { name, price, discountedPrice, description, weight, unit } = req.body;

    try {
        const ProductModel = getOrCreateModel(category);

        // Calculate discount percentage
        const discount = price && discountedPrice ? ((price - discountedPrice) / price) * 100 : 0;

        const product = new ProductModel({
            name,
            price,
            discountedPrice, // Save discounted price
            description,
            weight,
            unit,
            discount: Math.round(discount), // Save discount percentage
            images: req.files.map((file) => file.buffer), // Save images as buffer
        });

        await product.save();
        res.status(201).send('Product saved successfully.');
    } catch (error) {
        console.error('Error saving product:', error);
        res.status(500).send('Error saving product.');
    }
});

// Route to fetch products by category
app.get('/products/:category', async (req, res) => {
    try {
        const { category } = req.params;
        const ProductModel = getOrCreateModel(category);
        const products = await ProductModel.find(); // Fetch all products in the category

        // Convert buffer images to Base64
        const productsWithImages = products.map((product) => {
            const productData = product.toObject(); // Convert Mongoose object to plain object
            productData.images = product.images.map((image) => image.toString('base64')); // Convert buffer to Base64
            return productData;
        });

        res.status(200).json(productsWithImages);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).send('Error fetching products.');
    }
});

// Route to update a product
app.put('/products/:id', async (req, res) => {
    const { id } = req.params;
    const { name, price, discountedPrice, description, weight, unit, category } = req.body; // Include category

    try {
        const ProductModel = getOrCreateModel(category); // Get the model for the category
        const discount = price && discountedPrice ? ((price - discountedPrice) / price) * 100 : 0;

        const updatedProduct = await ProductModel.findByIdAndUpdate(id, {
            name,
            price,
            discountedPrice,
            description,
            weight,
            unit,
            discount: Math.round(discount),
        }, { new: true });

        if (!updatedProduct) {
            return res.status(404).send('Product not found.');
        }

        res.status(200).send('Product updated successfully.');
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).send('Error updating product.');
    }
});

// Route to delete a product
app.delete('/products/:id', async (req, res) => {
    const { id } = req.params;
    const { category } = req.body; // Include category

    try {
        const ProductModel = getOrCreateModel(category); // Get the model for the category
        const deletedProduct = await ProductModel.findByIdAndDelete(id);

        if (!deletedProduct) {
            return res.status(404).send('Product not found.');
        }

        res.status(200).send('Product deleted successfully.');
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).send('Error deleting product.');
    }
});

// Route to serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html')); // Serve index.html
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
