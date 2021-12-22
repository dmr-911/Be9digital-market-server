const express = require("express");
const app = express();
const port = process.env.PORT || 5000;
require('dotenv').config();
const cors = require('cors');
const { MongoClient } = require("mongodb");

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

        // POST Methods
        app.post('/orders', async(req, res)=>{
            const item = req.body;
            const result = await orders.insertOne(item);
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
    console.log(`The server running at port : ${port}`)
})