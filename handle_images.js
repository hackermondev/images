const fs = require('fs')
const MongoClient = require('mongodb').MongoClient
const nanoid = require('nanoid')
const testImages = require('./test_images')

var allowed = ['jpg', 'png', 'gif', 'svg', 'jpeg']

var db = null
const dbClient = new MongoClient(process.env.mongodb, { useUnifiedTopology: true })

async function connectDatabase(){
  var client = await dbClient.connect()
  db = client.db('image-cdn')

  module.exports.db = db
  console.log(`Connected to database`)
}

connectDatabase()

async function handleImages(fileLocation, req, res, redirect){
  
  if(!req.file){
    res.status(500)
    fs.createReadStream(`static/error.html`).pipe(res)
  }

  if(!db){
    fs.unlinkSync(req.file.path)
    
    res.status(500)
    fs.createReadStream(`static/error.html`).pipe(res)
    return
  }

  var extension = req.file.mimetype.split('/')[1]
  var imageData = fs.readFileSync(req.file.path).toString('base64')

  if(!allowed.includes(extension)){
    fs.unlinkSync(req.file.path)
    res.end(`only images are allowed. ${allowed.join(',')}`)
    return
  }

  data = `data:image/${extension};base64,${imageData}`

  /* try to rebuild the image*/

  var buffer = new Buffer.from(data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/)[2], 'base64')


  // fs.writeFileSync(`test.png`, buffer)

  var c = await testImages.test(req.file.path)

  if(c == false){
    fs.unlinkSync(req.file.path)

    res.status(500)
    fs.createReadStream(`static/error.html`).pipe(res)
    return
  }

  fs.unlinkSync(req.file.path)

  var id = nanoid.nanoid(20)

  var i = await db.collection('images').find({
    imageData: data
  }).toArray()

  if(i[0] != undefined){
    if(redirect != undefined){
      res.redirect(`${redirect}?image=https://img.jdaniels.me/i/${i[0].id}`)
      return
    }

    res.redirect(`/i/${i[0].id}`)
    return
  }

  await db.collection('images').insertOne({
    id: id,
    imageData: data,
    uploadedAt: new Date().getTime(),
    views: 0
  })

  if(redirect != undefined){
    res.redirect(`${redirect}?image=https://img.jdaniels.me/i/${id}`)
    return
  }
  
  res.redirect(`/i/${id}`)
}

module.exports = {
  handleImages: handleImages,
  db: db,
  allowed: allowed
}