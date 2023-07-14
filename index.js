const express = require('express')
const cors = require('cors')
const app = express()
require('dotenv').config()
const port = process.env.PORT || 5000


app.use(cors())
app.use(express.json())


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.watftgx.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const instructorCollection = client.db("gymAiling").collection("instructors");
    const coursesCollection = client.db("gymAiling").collection("courses");
    const bookingCollection = client.db("gymAiling").collection("booking");

    app.get('/instructors', async (req, res) => {
      const result = await instructorCollection.find().toArray()
      res.send(result)
    })

    app.get('/courses', async (req, res) => {
      const result = await coursesCollection.find().toArray()
      res.send(result)
    })

    app.get('/booking',async(req,res)=>{
      const email = req.query.email;
      const query = {email:email}
      const result = await bookingCollection.find(query).toArray()
      res.send(result)
    })

   app.post('/booking',async(req,res)=>{
    const item = req.body;
    const result = await bookingCollection.insertOne(item)
    res.send(result)
   })

   app.delete('/booking/:id',async(req,res)=>{
       const id = req.params.id;
       const query = {_id: new ObjectId(id)}
       const result = await bookingCollection.deleteOne(query)
       res.send(result)
   })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('hello world')
})

app.listen(port, () => {

})