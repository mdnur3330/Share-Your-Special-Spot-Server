const express = require('express')
const app = express()
const cors = require('cors')
const PORT = 4000
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const  admin = require("firebase-admin");

const decoded = Buffer.from(process.env.FB_KEY_SERVICE,"base64").toString('utf8')
const serviceAccount = JSON.parse(decoded);


app.use(cors())
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.f0jnadf.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;




// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

  const verifyToken =async (req,res, next)=>{
    const authHeader = req?.headers.authorization
    if(!authHeader || !authHeader.startsWith('Bearer ')){
      return res.status(401).send({message:"UnAuthorize access"})
    }

    const token = authHeader.split(" ")[1]
    try{
      const decoded = await admin.auth().verifyIdToken(token)
      req.decoded = decoded
       next()
    }catch{
      return res.status(401).send({message: "UnAuthorize access"})
    }
   
  }


const tokenVerify = (req,res,next)=>{
  if(req.query.email !== req.decoded.email){
    return res.status(403).send({message: "forbeden access"})
  }
  next()
}

async function run() {
  try {
    //  await client.connect();
    const db = client.db('artifact')
    const artifactCollection = db.collection('artifactData')


    app.get('/artifacts',async(req,res)=>{
      const result = await artifactCollection.find().toArray()
      res.send(result)
    })


    app.get('/my-artifact',verifyToken,tokenVerify,async(req,res)=>{
      const email = req.query.email
      let query = {adderEmail: email}
      const result = await artifactCollection.find(query).toArray()
      res.send(result)
    })

    app.get('/artifacts/:id',async(req, res)=>{
      const id = req.params.id
      console.log(id);
      const query = {_id: new ObjectId(id)}
      const result = await artifactCollection.findOne(query)
      res.send(result)
    })


app.get('/liked-artifacts',verifyToken,tokenVerify, async (req, res)=>{
  const email = req.query.email
  if(!email){
    return res.status(400).send({message: "email is required"})
  }

  const myLiked = {
      likedBy:{$in :[email]}
  }

  const result = await artifactCollection.find(myLiked).toArray()
  res.send(result)
})


app.get('/search',async(req, res)=>{
  const num = req.query.name;
  const query = { name: { $regex: num, $options: 'i' } }
  const result = await artifactCollection.find(query).toArray()
  res.send(result)
})


app.get('/popular-artifacts', async (req, res) => {
      try {
        const popularArtifacts = await artifactCollection
          .aggregate([
            {
              $addFields: {
                likeCount: { $size: "$likedBy" }
              }
            },
            { $sort: { likeCount: -1 } },
            { $limit: 8 }
          ])
          .toArray();
        res.send(popularArtifacts);
      } catch (error) {
        console.error("Error in /popular-artifacts route:", error);
        res.status(500).send({ message: "Server error", error });
      }
    });




     app.post('/artifacts',verifyToken, tokenVerify, async(req, res)=>{
      const artifact = req.body;
      const result = await artifactCollection.insertOne(artifact)
      res.send(result)
    })


    app.put('/artifacts/:id',verifyToken, async(req,res)=>{
      const id = req.params.id
      const query = {_id: new ObjectId(id)}
      const artifact = req.body
      
      const updateArtifact = {
        $set: artifact
      }
      const result = await artifactCollection.updateOne(query,updateArtifact)
      res.send(result)
    })

    app.patch('/artifacts/:id',async(req,res)=>{
      const id = req.params.id
      const {email} = req.body;
      console.log(email);
      const query = {_id: new ObjectId(id)}
      const artifact = await artifactCollection.findOne(query)
      const alreadyLiked = (artifact?.likedBy || []).includes(email)

      const updateLikeOrDisLike = alreadyLiked ? {
        $pull:{
          likedBy:email
        }
      }:{
        $addToSet:{
          likedBy: email
        }
      }
      const result = await artifactCollection.updateOne(query, updateLikeOrDisLike)
      res.send({message:!alreadyLiked})
    })

    app.delete('/artifacts/:id',verifyToken, async(req, res)=>{
      const id = req.params.id
      const query = {_id: new ObjectId(id)}
      const result = await artifactCollection.deleteOne(query)
      res.send(result)
    })

// await client.db("admin").command({ ping: 1 });
//     console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    
  }
}
run().catch(console.dir);

app.get('/',(req,res)=>{
  res.send("connect")
})

app.listen(PORT, ()=>{
    console.log(`server is runig on port ${PORT}`);
})

