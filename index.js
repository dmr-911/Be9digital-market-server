const express = require("express");
const app = express();
const port = process.env.PORT || 5000;
const admin = require("firebase-admin");
require('dotenv').config();
const cors = require('cors');
const { MongoClient } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET);
const fileUpload = require('express-fileupload');
const ObjectId = require('mongodb').ObjectId;

// firebase sdk 
const serviceAccount = require("./be9digital-firebase-adminsdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(fileUpload());

// Mongodb uri and client
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jycgq.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function verifyToken(req, res, next){
    if(req.headers.authorization.startsWith('Bearer ')){
        const token = req.headers.authorization.split(' ')[1];

        try{
            const decodedUser = await admin.auth().verifyIdToken(token);
            req.decodedEmail = decodedUser.email;
        }
        catch{

        }
    }
    next();
}

async function run(){
    try{
        await client.connect();
        const database = client.db("be9digital");
        const electric_products = database.collection("electric_products");
        const glasses = database.collection("glass_collection");
        const orders = database.collection("orders");
        const usersCollection = database.collection("users");
        const newOdersCollection = database.collection("newOrders");
        const reviewsCollection = database.collection("reviews");
        const aboutCollection = database.collection("about");

        //GET Methods
        app.get('/e_products', async (req, res) => {
            const search = req.query.home;
            let cursor;
            if(search){
                cursor = electric_products.find({}).limit(12);
            }
            else{
                cursor = electric_products.find({});
            }
            const products = await cursor.toArray();
            res.send(products);
        });
        app.get('/glasses', async(req, res)=>{
            const home = req.query.home;
            let cursor;
            if(home){
                cursor = glasses.find({}).limit(8);
            }else{
                cursor = glasses.find({});
            }
            const products = await cursor.toArray();
            res.json(products);
        });
        app.get('/orders', async(req, res)=>{
            const email = req.query.email;
            let cursor;
            if (email) {
              cursor = orders.find({ email: email })
            }
            else {
              cursor = orders.find({});
            }
            const result = await cursor.toArray();
            res.json(result);
        });
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            let isAdmin = false;
            if (user?.role === 'admin') {
              isAdmin = true;
            }
            res.json({ admin: isAdmin });
          });
        app.get('/reviews', async(req, res)=>{
            const cursor = reviewsCollection.find({}).limit(4);
            const result = await cursor.toArray();
            res.json(result);
        });
        app.get('/newProducts', async (req, res)=>{
          const cursor = newOdersCollection.find({});
          const result = await cursor.toArray();
          res.json(result);
        });
        app.get('/about', async(req, res)=>{
          const cursor = aboutCollection.find({});
          const result = await cursor.toArray();
          res.json(result);
        });

        // POST Methods
        app.post('/orders', async(req, res)=>{
            const item = req.body;
            const result = await orders.insertOne(item);
            res.json(result);
        });

        app.post('/addProduct', async(req,res)=>{
            const name = req.body.name;
            const price = req.body.price;
            const key = req.body.key;
            const stock = req.body.stock;
            const star = req.body.star;
            const shipping = req.body.shipping;
            
            const pic = req.files.img;
            const picData = pic.data;
            const encodedPic = picData.toString('base64');
            const imgBuffer = Buffer.from(encodedPic, 'base64');
            const product = {
                key,
                name, 
                price, 
                stock,
                star,
                shipping,
                img : imgBuffer
            };
            const result = await newOdersCollection.insertOne(product);
            res.json(result);
        })

        app.post('/users', async (req, res)=>{
            const item = req.body;
            const result = await usersCollection.insertOne(item);
            res.json(result)
        });

        // Payment
        app.post('/create-payment-intent', async (req, res)=>{
            const payInfo = req.body;
            const amount = payInfo.price * 100;
            const payIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency : 'usd',
                payment_method_types: ['card']
            });
            res.json({clientSecret : payIntent.client_secret})
        });

        app.post('/reviews', async (req, res)=>{
            const review = req.body;
            const result = await reviewsCollection.insertOne(review);
            res.json(result);
          });

        // PUT Methods
        app.put('/orders/:id', async (req, res)=>{
            const id = req.params.id;
            const payment = req.body;
            const filter = {id : id};
            const updateDoc = {
                $set: {
                    payment : payment
                }
            };
            const result = await orders.updateOne(filter, updateDoc);
            res.json(result);
        });

        app.put('/users', async (req, res) => {
            const user = req.body;
            const filter = { email: user.email };
            const options = { upsert: true };
      
            const updateDoc = {
              $set: user
            };
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            res.json(result);
          });

          app.put('/users/admin', verifyToken, async (req, res) => {
            const user = req.body;
            const requester = req.decodedEmail;
            if(requester){
                const requesterAccount = await usersCollection.findOne({email : requester});
                if(requesterAccount.role === 'admin'){
                    const filter = { email: user.email };
                    const updateDoc = { $set: { role: 'admin' } };
                    const result = await usersCollection.updateOne(filter, updateDoc);
                    res.json(result);
                }
            }
            else{
                res.status(403).json({message : 'You do not have access to make admin'})
            }

          });

          app.put('/approve/:id', async (req, res) => {
            const id = req.params.id;
            const status = req.body.status;
            const filter = { _id: ObjectId(id) };
            const updateDoc = { $set: { status: status } };
            const result = await orders.updateOne(filter, updateDoc);
            res.json(result);
          });

          app.put('/myOrders/cancel/:id', async (req, res) => {
            const id = req.params.id;
            const status = req.body.status;
            const filter = { _id: ObjectId(id) };
            const updateDoc = { $set: { status: status } };
            const result = await orders.updateOne(filter, updateDoc);
            res.json(result);
          });


          // DELETE API
          app.delete('/orders/:id', async (req, res) =>{
            const user = req.params.id;
            const query = { _id: ObjectId(user) };
            const result = await orders.deleteOne(query);
            res.json(result);
          });
          app.delete('/myOrders/:id', async (req, res) =>{
            const user = req.params.id;
            const query = { _id: ObjectId(user) };
            const result = await orders.deleteOne(query);
            res.json(result);
          });
          app.delete('/eProduct/:id', async (req, res)=> {
            const user = req.params.id;
            const query = { _id: ObjectId(user) };
            const result = await electric_products.deleteOne(query);
            res.json(result);
          });
          app.delete('/glass/:id', async (req, res)=> {
            const user = req.params.id;
            const query = { _id: ObjectId(user) };
            const result = await glasses.deleteOne(query);
            res.json(result);
          });
    }
    finally{
        // await client.close();
    }
};
run().catch(console.dir);

app.get('/', (req, res)=>{
    res.send('Hello World!')
});

app.listen(port, ()=>{
    console.log(`My server running at port : ${port}`)
})