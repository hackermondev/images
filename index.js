/*

TODO:

- Add compression to images
- Add a admin panel
- Resize images

*/

const express = require('express')
const port = process.env.PORT || 3000
const fs = require('fs')
const multer = require("multer")

const download = require('image-downloader')
const nanoid = require('nanoid')
const bodyParser = require('body-parser')
const handleImages = require('./handle_images')

const testImages = require('./test_images')

app = express()
var upload = multer({
  dest: `${__dirname}/cache`
})
var toBeRemoved = []

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(express.static('static'))

app.get('/', (req, res) => {
  fs.createReadStream(`static/home.html`).pipe(res)
})

app.get('/i/:id', async (req, res) => {

  if (handleImages.db == null) {
    res.end(`not loaded yet`)
    return
  }

  var id = req.params.id.toString()

  var images = await handleImages.db.collection(`images`).find({ id: id }).toArray()

  var i = images[0]

  if (!i) {

    res.status(500)
    fs.createReadStream(`static/error.html`).pipe(res)
    return
  }

  if (i.views == undefined) {
    i.views = 0
  }

  await handleImages.db.collection(`images`).updateOne({ id: id }, { $set: { views: i.views + 1 } })
  if (fs.existsSync(`${__dirname}/cache/${id}.png`)) {
    fs.createReadStream(`${__dirname}/cache/${id}.png`).pipe(res)
    return
  }

  var buffer = new Buffer.from(i.imageData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/)[2], 'base64')

  fs.writeFileSync(`${__dirname}/cache/${id}.png`, buffer)


  fs.createReadStream(`${__dirname}/cache/${id}.png`).pipe(res)

  toBeRemoved.push(`${__dirname}/cache/${id}.png`)
})

app.get('/proxy', async (req, res) => {
  if (!handleImages.db) {
    fs.createReadStream(`static/error.html`).pipe(res)
    return
  }

  var url = req.query.url

  if (!url) {
    res.redirect('/')
    return
  }

  var error = null

  const i = await download.image({ url: url, dest: `${__dirname}/cache` }).catch((err) => {
    error = err
  })

  if (error) {
    fs.createReadStream(`static/error.html`).pipe(res)
    return
  }

  req.file = {
    path: i.filename,
    mimetype: 'image/png'
  }

  handleImages.handleImages(i.filename, req, res)
})

app.post('/upload', upload.single('image'), (req, res) => {
  var redirect = undefined

  if (req.body.redirect != undefined) {
    redirect = req.body.redirect
  }
  handleImages.handleImages(req.file.path, req, res, redirect)
})

app.post('/api/:name', async (req, res) => {
  if (req.params.name == 'post') {
    if (!handleImages.db) {
      res.json({
        ok: false,
        message: `The database hasn't full loaded. Please try again later`
      })
      return
    }

    if (!req.body.image) {
      res.json({
        ok: false,
        message: `Please send a image`
      })
      return
    }

    var i = req.body.image

    fs.writeFileSync(`cache/test.png`, new Buffer.from(`data:image/${extension};base64,${i}`.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/)[2], 'base64'))
    var c = await testImages.test(`cache/test.png`)

    if (c == false) {
      fs.unlinkSync(`cache/test.png`)
      res.json({
        ok: false,
        message: 'Corrupted image'
      })
      return
    } else {
      fs.unlinkSync(`cache/test.png`)
    }

    var extension = req.body.extension || 'png'

    if (!handleImages.allowed.includes(extension)) {
      res.json({
        ok: false,
        message: `Only images are allowed. ${handleImages.allowed.join(',')}`
      })
      return
    }

    var data = `data:image/${extension};base64,${i}`

    var i = await handleImages.db.collection('images').find({
      imageData: data
    }).toArray()

    if (i[0] != undefined) {
      res.json({
        ok: true,
        id: i[0].id,
        url: `/i/${i[0].id}`
      })
      return
    }

    var id = nanoid.nanoid(20)

    await handleImages.db.collection('images').insertOne({
      id: id,
      imageData: data,
      uploadedAt: new Date().getTime()
    })

    res.json({
      ok: true,
      id: id,
      url: `/i/${id}`
    })
  }
})

app.get('*', (req, res) => {
  res.status(404)

  fs.createReadStream(`static/404.html`).pipe(res)
})

app.post('*', (req, res) => {
  res.status(500)
  res.end(``)
})

app.listen(port, () => {
  console.log(`Listening on port ${port}`)

  setInterval(() => {
    toBeRemoved.forEach((i, n) => {
      if (fs.existsSync(i)) {
        fs.unlinkSync(i)
      }

      toBeRemoved.splice(n)
    })
  }, 10000)
})