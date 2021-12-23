const express = require("express");
const app = express();
const port = process.env.PORT || 5000;
require('dotenv').config();
const cors = require('cors');
const { MongoClient } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET);

// Middleware
app.use(cors());
app.use(express.json());

// Mongodb uri and client
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jycgq.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function run(){
    try{
        await client.connect();
        const database = client.db("be9digital");
        const electric_products = database.collection("electric_products");
        const glasses = database.collection("glass_collection");
        const orders = database.collection("orders");
        const usersCollection = database.collection("users");

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
            const cursor = orders.find({});
            const products = await cursor.toArray();
            res.json(products);
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
          
        // POST Methods
        app.post('/orders', async(req, res)=>{
            const item = req.body;
            const result = await orders.insertOne(item);
            res.json(result);
        });

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
        })

        // PUT Methods
        app.put('/orders/:id', async (req, res)=>{
            const id = req.params.id;
            const payment = req.body;
            console.log(payment);
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

          app.put('/users/admin', async (req, res) => {
            const user = req.body;
            const filter = { email: user.email };
            const updateDoc = { $set: { role: 'admin' } };
            const result = await usersCollection.updateOne(filter, updateDoc);
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

app.get('/hello', (req, res)=>{
    res.send('Hello mizan')
})

app.listen(port, ()=>{
    console.log(`My server running at port : ${port}`)
})