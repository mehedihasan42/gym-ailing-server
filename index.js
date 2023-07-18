const express = require('express')
const cors = require('cors')
var jwt = require('jsonwebtoken');
const app = express()
require('dotenv').config()
const stripe = require("stripe")(process.env.Payment_Secret_key);
const port = process.env.PORT || 5000


app.use(cors())
app.use(express.json())

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' })
  }

  const token = authorization.split(' ')[1]
  jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(401).send({ message: 'unauthorized access' })
    }
    req.decoded = decoded;
    next()
  });
}


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

    const userCollection = client.db("gymAiling").collection("users");
    const instructorCollection = client.db("gymAiling").collection("instructors");
    const coursesCollection = client.db("gymAiling").collection("courses");
    const bookingCollection = client.db("gymAiling").collection("booking");
    const paymentCollection = client.db("gymAiling").collection("payment");

    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, { expiresIn: '5h' });
      res.send({ token })
    })

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await userCollection.findOne(query)
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden access' })
      }
      next()
    }

    //----------users api--------------
    app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray()
      res.send(result)
    })

    app.post('/users', async (req, res) => {
      const users = req.body;
      const query = { email: users.email }
      const exitinguser = await userCollection.findOne(query)
      if (exitinguser) {
        return res.send({ message: 'user already exit' })
      }
      const result = await userCollection.insertOne(users)
      res.send(result)
    })

    app.delete('/users/:id',verifyJWT, verifyAdmin,async(req,res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await userCollection.deleteOne(query)
      res.send(result)
    })

    app.get('/users/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(401).send({ message: 'forbidden access' })
      }

      const query = { email: email }
      const user = await userCollection.findOne(query)
      const result = { admin: user?.role === 'admin' }
      res.send(result)
    })

    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc)
      res.send(result)
    })

    //---------instructors api------------
    app.get('/instructors', async (req, res) => {
      const result = await instructorCollection.find().toArray()
      res.send(result)
    })

    //------------courses api---------
    app.get('/courses', async (req, res) => {
      const result = await coursesCollection.find().toArray()
      res.send(result)
    })

    app.post('/courses', verifyJWT, verifyAdmin, async (req, res) => {
      const newItem = req.body;
      const result = await coursesCollection.insertOne(newItem)
      res.send(result)
    })

    app.delete('/courses/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await coursesCollection.deleteOne(query)
      res.send(result)
    })

    //-------booking api------------
    app.get('/booking', verifyJWT, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      const query = { email: email }
      const result = await bookingCollection.find(query).toArray()
      res.send(result)
    })

    app.post('/booking', async (req, res) => {
      const item = req.body;
      const result = await bookingCollection.insertOne(item)
      res.send(result)
    })

    app.delete('/booking/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await bookingCollection.deleteOne(query)
      res.send(result)
    })

    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      const amount = price * 100
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: [
          "card"
        ],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      })
    })

    //---------------payment----------

    app.get('/payment',async(req,res)=>{
      const email = req.query.email;
      const query = {email:email}
      const result = await paymentCollection.find(query).toArray()
      res.send(result)
    })

    app.post('/payment',async(req,res)=>{
      const payment = req.body;
      const insertedResult = await paymentCollection.insertOne(payment);
      const query= {_id: {$in: payment.itemsId.map(id=>new ObjectId(id))}}
      const deleteResult = await bookingCollection.deleteMany(query)
      res.send({insertedResult,deleteResult})
    })

    app.get('/admin-state',async(req,res)=>{
      const users = await userCollection.estimatedDocumentCount()
      const courses = await coursesCollection.estimatedDocumentCount()
      const bookings = await bookingCollection.estimatedDocumentCount()
      const orders = await paymentCollection.estimatedDocumentCount()
      const payment = await paymentCollection.find().toArray()
      const revenue = payment.reduce((sum,total)=>sum + total.price,0)
      res.send({revenue,users,courses,bookings,orders })
    })

    app.get('/order-state',async(req,res)=>{
      const pipeline = [
        {
          $lookup: {
            from: 'courses',
            localField: 'itmesName',
            foreignField: '_id',
            as: 'itemsData'
          }
        },
        {
          $unwind: '$itemsData'
        },
        {
          $group: {
            _id: '$itemsData.courseName',
            count: { $sum: 1 },
            totalPrice: { $sum: '$itemsData.price' }
          }
        },
        {
          $project: {
            _id: 0,
            courseName: '$_id',
            count: 1,
            totalPrice: 1
          }
        }
      ];

      const result = await paymentCollection.aggregate(pipeline).toArray()
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